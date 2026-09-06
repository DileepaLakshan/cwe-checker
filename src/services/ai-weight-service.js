import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

// Kept intentionally short: this static text is sent on every single call, and its
// token cost stacks with maxTokens against the model's tokens-per-minute rate limit
// (a verbose Frame-1..8 version of this prompt previously pushed requests over
// openai/gpt-oss-120b's 8000 TPM cap on the on-demand tier).
const systemPrompt = `
You are a software quality assurance expert in software architecture, secure development, and vulnerability analysis.

Task: analyze the described software application, determine its domain, then rank and weight the given quality characteristics for that domain. Every recommendation must cite an authoritative standard or framework (e.g. ISO/IEC 25010, ISO/IEC 27001, NIST CSF/SSDF, OWASP ASVS/Top 10, GDPR, or a relevant domain-specific regulation) — never assume importance without justification.

Rules:
- First identify the application's primary domain (e.g. Government, Healthcare, Financial, E-commerce, CMS, IoT, etc.) from the project description. If it spans multiple domains, pick the dominant business purpose rather than merging requirements.
- Government and critical-infrastructure systems (identity, tax, health, judicial, elections, etc.) generally demand very high Security, Integrity, Availability and Confidentiality — weigh accordingly when the domain warrants it.
- Evaluate and weight EVERY ONE of these characteristics: {models}
- Rank all characteristics globally 1 (most critical) to N (least critical), no ties, and assign weights consistent with that ranking.
- For EACH characteristic, give at least 3 distinct evidence-based reasons, each with its own global rank across all reasons, a supporting authority/standard, and any affected/representative CWEs.
- If specific found CWEs are especially critical for this domain, list them with a weight-reduction penalty.
- ALWAYS include the 'cwePenalties' key. If there are no penalties, provide an empty array [].
- ALWAYS output valid JSON matching the schema perfectly. Do NOT include random strings like "reasons" or ":" outside of standard key-value pairs.

CRITICAL: Your output must strictly follow this JSON structure for EVERY characteristic:
{{
  "domain": "...",
  "characteristics": [
    {{
      "name": "Characteristic Name",
      "global_rank": 1,
      "priority": "High",
      "weight": 2.5,
      "reasons": [
        {{
          "reason": "...",
          "global_rank": 1,
          "authority": "...",
          "affected_cwes": ["CWE-1"],
          "representative_cwes": ["CWE-1"]
        }}
      ]
    }}
    // ... MUST output an object like above for EACH evaluated characteristic
  ],
  "cwePenalties": []
}}

PROJECT DESCRIPTION:
{projectDescription}

FOUND CWES (comma separated):
{foundCwes}
`;

const outputSchema = z.object({
  domain: z.string().describe("The categorized domain of the project"),
  characteristics: z.array(
    z.object({
      name: z.string().describe("The name of the qualitative characteristic (e.g. Security, Maintainability)"),
      global_rank: z.number().describe("The global ranking of this characteristic from 1 (most critical) to N (least critical). No duplicates allowed."),
      priority: z.enum(["Critical", "High", "Medium", "Low"]).describe("Priority level"),
      weight: z.number().describe("The assigned mathematical weight for this characteristic (e.g. 1.0 to 3.0)"),
      reasons: z.array(
        z.object({
          reason: z.string().describe("Evidence-based reason"),
          global_rank: z.number().describe("The global priority rank of this specific reason across ALL reasons (e.g., 1 is the most critical reason overall)"),
          authority: z.string().describe("Supporting Authority or Standard"),
          affected_cwes: z.array(z.string()).describe("Affected CWE Categories"),
          representative_cwes: z.array(z.string()).describe("Representative CWE IDs")
        })
      ).describe("Three evidence-based reasons explaining why this is important, globally ranked.")
    })
  ).describe("List of qualitative characteristics evaluated"),
  cwePenalties: z.array(
    z.object({
      cweId: z.string().describe("The CWE ID, e.g. CWE-79"),
      penalty: z.number().describe("The weight reduction penalty, e.g. 0.5")
    })
  ).optional().default([]).describe("List of specific CWE IDs and their weight reductions/penalties (can be empty)")
});

export async function calculateAIWeights(projectDescription, foundCwes = [], models = []) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error("Groq API Key is missing. Please set VITE_GROQ_API_KEY in the .env file.");
  }

  // Use temperature 0.1 for stability with complex tool calls
  const llm = new ChatGroq({
    apiKey: apiKey,
    // gpt-oss-20b hit strict-schema validation failures (json_validate_failed) on this
    // schema's nested arrays/enums — too complex for a 20B model's constrained decoding
    // to satisfy reliably. Back to gpt-oss-120b, which handles it correctly; the earlier
    // 8000 TPM cap is now avoided by the trimmed prompt + lower maxTokens below
    // (~400 + 6000 = ~6400, comfortably under the limit) rather than by a smaller model.
    model: "openai/gpt-oss-120b",
    temperature: 0.1,
    maxTokens: 6000,
    timeout: 120000, // gpt-oss models reason before answering; the default 60s client timeout isn't always enough
  });

  // withStructuredOutput uses Groq's native json_schema response format for
  // openai/gpt-oss models, which strictly enforces the schema server-side instead of
  // relying on the model to emit unfenced JSON that a text parser then has to guess at
  // (that approach broke when the model wrapped its answer in ```json fences).
  const structuredLlm = llm.withStructuredOutput(outputSchema);

  const prompt = PromptTemplate.fromTemplate(systemPrompt);

  const chain = prompt.pipe(structuredLlm);

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await chain.invoke({
        projectDescription,
        foundCwes: foundCwes.length > 0 ? foundCwes.join(", ") : "None",
        models: models.length > 0 ? models.join(", ") : "Security, Maintainability, Reliability, Performance Efficiency, Usability, Portability, Functional Suitability",
      });
      return response;
    } catch (e) {
      lastError = e;
      console.warn(`[AI Weight Service] Attempt ${attempt} failed:`, e.message);
      if (attempt === 3) {
        throw new Error(`Failed to generate valid AI weights after 3 attempts: ${e.message}`);
      }
      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
