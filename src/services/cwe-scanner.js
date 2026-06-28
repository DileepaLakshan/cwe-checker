import path from 'node:path';
import { app } from 'electron';
import { exec } from 'node:child_process';
import { existsSync, readFileSync, promises as fs } from 'node:fs';
import { getBinaryPath } from '../utils/binary-path';
import { generateCweRules } from './cwe-rule-generator';
import { parseCweResults } from '../utils/cwe-parser';

export async function runCweLocate(projectPath, cweIds) {
  const opengrepPath = getBinaryPath('opengrep_windows_x86.exe');
  const outputPath = path.join(app.getPath('userData'), 'cwe-locate-results.json');
  const rulesDir = path.join(app.getPath('userData'), 'cwe-rules');
  
  const ids = Array.isArray(cweIds)
    ? [...new Set(cweIds
      .filter(Boolean)
      .map(id => String(id).trim().replace(/^CWE[-_:\s]*/i, ''))
      .filter(Boolean))]
    : [];

  const requestedCwes = ids.map(id => `CWE-${id}`);
  console.log('[scan:cwe-locate] projectPath=', projectPath, 'requested CWEs=', requestedCwes);

  if (requestedCwes.length === 0) {
    console.log('[scan:cwe-locate] no CWE IDs provided, returning empty locate result');
    return {};
  }

  // Step 1: Generate custom CWE-specific rules
  await fs.mkdir(rulesDir, { recursive: true });
  const customRules = await generateCweRules(requestedCwes, rulesDir);
  
  // Step 2: Build OpenGrep command with custom rules and auto config
  let configPath = 'auto';
  if (customRules.length > 0) {
    configPath = rulesDir;
    console.log(`[scan:cwe-locate] Using ${customRules.length} custom CWE rules`);
  }
  
  const command = `"${opengrepPath}" scan --config "${configPath}" --json --output "${outputPath}" "${projectPath}"`;
  console.log('[scan:cwe-locate] running OpenGrep scan with command=', command);

  // Step 3: Execute OpenGrep with custom rules
  await new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      console.log('[scan:cwe-locate] OpenGrep finished; error=', error ? error.message : 'none');
      console.log('[scan:cwe-locate] stdout length=', stdout?.length ?? 0, 'stderr length=', stderr?.length ?? 0);
      if (existsSync(outputPath)) {
        console.log('[scan:cwe-locate] output file exists at', outputPath);
        resolve();
      } else {
        console.error('[scan:cwe-locate] missing output file; stderr=', stderr);
        reject(`Failed to generate CWE locate results: ${error || stderr || 'No output file'}`);
      }
    });
  });

  // Step 4: Parse and return results
  const rawData = readFileSync(outputPath, 'utf8');
  return parseCweResults(rawData, requestedCwes, customRules, projectPath);
}