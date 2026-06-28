import path from 'node:path';
import { promises as fs } from 'node:fs';
import { cwePatterns } from '../config/cwe-patterns';

export async function generateCweRules(cweIds, rulesDir) {
  const rules = [];
  
  for (const cweId of cweIds) {
    const patterns = cwePatterns[cweId];
    if (patterns) {
      const ruleYaml = `rules:
  - id: ${patterns.name}
    message: "Potential ${cweId} vulnerability detected"
    severity: ${patterns.severity}
    languages: [${[...new Set(patterns.patterns.map(p => p.language))].join(', ')}]
    metadata:
      cwe: "${cweId}"
      category: security
      confidence: MEDIUM
    patterns:
      - pattern-either:
${patterns.patterns.map(p => `          - pattern: "${p.pattern}"`).join('\n')}
    paths:
      include:
        - "*.js"
        - "*.ts"
        - "*.jsx"
        - "*.tsx"
        - "*.py"
        - "*.java"
        - "*.php"
        - "*.rb"
        - "*.go"
        - "*.vue"
        - "*.html"
        - "*.css"
`;

      const rulePath = path.join(rulesDir, `${patterns.name}.yaml`);
      await fs.writeFile(rulePath, ruleYaml, 'utf8');
      rules.push(rulePath);
      console.log(`[cwe-rules] Generated rule for ${cweId}: ${rulePath}`);
    } else {
      console.log(`[cwe-rules] No custom patterns defined for ${cweId}, will rely on auto config`);
    }
  }
  
  return rules;
}