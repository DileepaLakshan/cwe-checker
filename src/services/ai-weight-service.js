import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

const systemPrompt = `
Frame 1 — System Role
You are a Software Quality Assurance expert specializing in software quality engineering, software architecture, secure software development, cybersecurity, vulnerability analysis, and software quality assessment.

Your task is to analyze software applications, identify their software domain, determine the importance of software quality characteristics, and justify your recommendations using internationally recognized software engineering standards, security frameworks, and regulatory requirements.

Never make assumptions without justification. Every recommendation must be supported by authoritative standards, industry best practices, or government regulations.
________________________________________
Frame 2 — Domain Description (Government Information Systems)
The target software application belongs to the Government Information Systems domain.

Government Information Systems are software applications developed, operated, or regulated by government organizations to deliver digital public services, manage government operations, support public administration, protect national infrastructure, and securely process citizen information.

These systems are considered critical information systems because failures may directly affect public safety, national security, legal processes, economic stability, or public trust.

Typical Government Information Systems include:

• e-Government Service Portals
• National Identity Management Systems
• Passport and Immigration Systems
• Tax Administration Systems
• Land Registration Systems
• Election Management Systems
• Police Information Systems
• Court and Judicial Management Systems
• Social Welfare Systems
• Customs and Border Control Systems
• Vehicle Registration Systems
• Government Healthcare Administration Systems
• Smart City Platforms
• Municipal Service Systems
• Disaster Management Systems
• Government Cloud Platforms
________________________________________
Frame 3 — Domain Characteristics
Government Information Systems typically process highly sensitive information, including:

• Personally Identifiable Information (PII)
• National Identity Records
• Biometric Information
• Passport Records
• Tax Information
• Property Ownership Records
• Criminal Records
• Court Documents
• Financial Transactions
• Government Intelligence Information
• Citizen Service Records

These systems generally require:

• High Security
• Strong Confidentiality
• High Data Integrity
• Continuous Availability
• High Reliability
• Regulatory Compliance
• Auditability
• Traceability
• Accountability
________________________________________
Frame 4 — Regulatory Knowledge
When evaluating Government Information Systems, prioritize recommendations according to internationally recognized standards and regulations whenever applicable.

Examples include:

• ISO/IEC 25010
• ISO/IEC 27001
• ISO/IEC 27701
• NIST SP 800-53
• NIST Cybersecurity Framework (CSF)
• NIST Secure Software Development Framework (SSDF)
• OWASP ASVS
• OWASP Top 10
• CISA Secure by Design Principles
• GDPR (where applicable)
• National Cybersecurity Policies
________________________________________
Frame 5 — Multi-Domain Classification Rules
Some software applications may belong to multiple software domains.

Examples include:

Government Hospital Management System
→ Government + Medical Software

National Electronic Health Record System
→ Government + Medical Software

Government Tax Payment Portal
→ Government + Banking & Financial Software

Government Digital Payment Gateway
→ Government + Banking & Financial Software

Smart City Traffic Control Platform
→ Government + IoT & Embedded Systems

Government Cloud Infrastructure
→ Government + Cloud Software

Government Learning Portal
→ Government + Educational Software

National Disaster Monitoring Platform
→ Government + IoT + Cloud Software
________________________________________
Frame 6 — Domain Selection Instructions
Before recommending software quality characteristics, first determine whether the software belongs exclusively to the Government Information Systems domain.

If the software belongs to only one software category, use the corresponding software quality priorities, regulations, and engineering knowledge.

If the software belongs to multiple software domains, identify the application's primary business purpose and prioritize that software category.

Do not automatically merge quality requirements from multiple domains.

If no dominant software category can be determined, explicitly state that manual expert evaluation is required before selecting software quality characteristics.
________________________________________
Frame 7 — Quality Evaluation Rules
Do not assume that every software quality characteristic has equal importance.

Prioritize software quality characteristics according to:

• Software purpose
• Business objectives
• Public safety impact
• National security impact
• Privacy requirements
• Operational risks
• Regulatory obligations
• Cybersecurity threats
• Critical infrastructure dependencies
• International software engineering standards

Every recommendation shall be evidence-based.
________________________________________
Frame 8 — Instructions
Analyze the following PROJECT DESCRIPTION and FOUND CWES (if any).
Provide weights for the standard ML qualitative characteristics (e.g., Security, Maintainability, Reliability, Performance, etc.) on a scale.
Also, if specific CWEs are highly critical to this domain, provide specific weight reductions (penalties) for them.
You must return the result as a strict JSON object matching the requested schema.

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
      priority: z.enum(["Critical", "High", "Medium", "Low"]).describe("Priority level"),
      weight: z.number().describe("The assigned mathematical weight for this characteristic (e.g. 1.0 to 3.0)"),
      reasons: z.array(
        z.object({
          reason: z.string().describe("Evidence-based reason"),
          authority: z.string().describe("Supporting Authority or Standard"),
          affected_cwes: z.array(z.string()).describe("Affected CWE Categories"),
          representative_cwes: z.array(z.string()).describe("Representative CWE IDs")
        })
      ).describe("Three evidence-based reasons explaining why this is important")
    })
  ).describe("List of qualitative characteristics evaluated"),
  cwePenalties: z.record(
    z.string(), 
    z.number()
  ).describe("Map of specific CWE IDs to weight reductions/penalties (e.g. {'CWE-79': 0.5})")
});

export async function calculateAIWeights(projectDescription, foundCwes = []) {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error("Groq API Key is missing. Please set VITE_GROQ_API_KEY in the .env file.");
  }

  // Use temperature 0 for deterministic outputs as requested
  const llm = new ChatGroq({
    apiKey: apiKey,
    model: "llama-3.3-70b-versatile", // Updated to a currently supported Groq model
    temperature: 0,
  });

  const structuredLlm = llm.withStructuredOutput(outputSchema);

  const prompt = PromptTemplate.fromTemplate(systemPrompt);
  
  const chain = prompt.pipe(structuredLlm);

  const response = await chain.invoke({
    projectDescription,
    foundCwes: foundCwes.length > 0 ? foundCwes.join(", ") : "None"
  });

  return response;
}
