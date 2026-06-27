import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { exec } from 'node:child_process';
import { existsSync, readFileSync, promises as fs } from 'node:fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.openDevTools();
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getBinaryPath(binaryName) {
  const baseDir = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin', 'win') 
    : path.join(__dirname, '..', '..', 'bin', 'win'); 
    
  return path.join(baseDir, binaryName);
}

// Allow the user to select a project folder to scan
ipcMain.handle('dialog:openProject', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// Handler to run OpenGrep (SAST)
ipcMain.handle('scan:sast', async (event, targetFolder) => {
  const opengrepPath = getBinaryPath('opengrep_windows_x86.exe'); 
  const outputPath = path.join(app.getPath('userData'), 'sast-results.json');
  const command = `"${opengrepPath}" scan --config auto --json --output "${outputPath}" "${targetFolder}"`;

  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (existsSync(outputPath)) {
        const rawData = readFileSync(outputPath, 'utf8');
        resolve(JSON.parse(rawData));
      } else {
        reject("Failed to generate SAST results: " + (error || stderr));
      }
    });
  });
});

// Handler to run Trivy (SCA)
ipcMain.handle('scan:sca', async (event, targetFolder) => {
  const trivyPath = getBinaryPath('trivy.exe');
  const outputPath = path.join(app.getPath('userData'), 'sca-results.json');
  const command = `"${trivyPath}" fs --format json --output "${outputPath}" "${targetFolder}"`;

  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (existsSync(outputPath)) {
        const rawData = readFileSync(outputPath, 'utf8'); 
        resolve(JSON.parse(rawData));
      } else {
        reject("Failed to generate SCA results: " + (error || stderr));
      }
    });
  });
});

// Generate custom OpenGrep rules for specific CWE patterns
async function generateCweRules(cweIds, rulesDir) {
  const rules = [];
  
  // Define CWE-to-pattern mappings for high-value vulnerabilities
  const cwePatterns = {
    'CWE-78': { // OS Command Injection
      name: 'cwe-78-os-command-injection',
      severity: 'ERROR',
      patterns: [
        { pattern: 'exec\\(', language: 'javascript' },
        { pattern: 'child_process', language: 'javascript' },
        { pattern: 'spawn\\(', language: 'javascript' },
        { pattern: 'eval\\(', language: 'javascript' },
        { pattern: 'system\\(', language: 'python' },
        { pattern: 'os\\.system', language: 'python' },
        { pattern: 'subprocess\\.call', language: 'python' },
        { pattern: 'Runtime\\.getRuntime\\(\\)\\.exec', language: 'java' },
        { pattern: 'ProcessBuilder', language: 'java' },
      ]
    },
    'CWE-79': { // Cross-site Scripting (XSS)
      name: 'cwe-79-xss',
      severity: 'ERROR',
      patterns: [
        { pattern: 'innerHTML', language: 'javascript' },
        { pattern: 'document\\.write\\(', language: 'javascript' },
        { pattern: 'dangerouslySetInnerHTML', language: 'javascript' },
        { pattern: 'v-html', language: 'vue' },
        { pattern: '\\$\\{.*\\}', language: 'javascript' },
        { pattern: 'eval\\(', language: 'javascript' },
        { pattern: 'setAttribute\\(.*innerHTML', language: 'javascript' },
      ]
    },
    'CWE-89': { // SQL Injection
      name: 'cwe-89-sql-injection',
      severity: 'ERROR',
      patterns: [
        { pattern: '(query|execute)\\(.*\\+.*\\)', language: 'javascript' },
        { pattern: '(query|execute)\\(.*\\$\\{.*\\}\\)', language: 'javascript' },
        { pattern: 'string concatenat.*sql', language: 'generic' },
        { pattern: 'SELECT.*\\+.*FROM', language: 'javascript' },
        { pattern: 'cursor\\.execute\\(.*%', language: 'python' },
        { pattern: 'Statement\\.executeQuery', language: 'java' },
        { pattern: 'createQuery\\(.*\\+', language: 'java' },
      ]
    },
    'CWE-352': { // Cross-Site Request Forgery (CSRF)
      name: 'cwe-352-csrf',
      severity: 'WARNING',
      patterns: [
        { pattern: 'csrf.*disable', language: 'generic' },
        { pattern: 'csrf.*false', language: 'generic' },
        { pattern: 'without.*csrf', language: 'generic' },
        { pattern: 'exempt.*csrf', language: 'python' },
        { pattern: 'csrf_exempt', language: 'python' },
      ]
    },
    'CWE-434': { // Unrestricted File Upload
      name: 'cwe-434-file-upload',
      severity: 'ERROR',
      patterns: [
        { pattern: 'multer\\(', language: 'javascript' },
        { pattern: 'upload.*file', language: 'generic' },
        { pattern: 'formidable', language: 'javascript' },
        { pattern: 'move_uploaded_file', language: 'php' },
        { pattern: '\\$_FILES', language: 'php' },
        { pattern: 'request\\.files', language: 'python' },
      ]
    },
    'CWE-502': { // Deserialization of Untrusted Data
      name: 'cwe-502-deserialization',
      severity: 'ERROR',
      patterns: [
        { pattern: 'JSON\\.parse\\(', language: 'javascript' },
        { pattern: 'pickle\\.load', language: 'python' },
        { pattern: 'yaml\\.load\\(', language: 'python' },
        { pattern: 'ObjectInputStream', language: 'java' },
        { pattern: 'unserialize\\(', language: 'php' },
        { pattern: 'Marshal\\.load', language: 'ruby' },
      ]
    },
    'CWE-601': { // Open Redirect
      name: 'cwe-601-open-redirect',
      severity: 'WARNING',
      patterns: [
        { pattern: 'redirect\\(.*req\\.', language: 'javascript' },
        { pattern: 'window\\.location', language: 'javascript' },
        { pattern: 'redirect\\(.*request\\.', language: 'python' },
        { pattern: 'HttpResponseRedirect', language: 'python' },
        { pattern: 'response\\.sendRedirect', language: 'java' },
      ]
    },
    'CWE-798': { // Hard-coded Credentials
      name: 'cwe-798-hardcoded-credentials',
      severity: 'ERROR',
      patterns: [
        { pattern: 'password\\s*=\\s*["\']', language: 'generic' },
        { pattern: 'api_key\\s*=\\s*["\']', language: 'generic' },
        { pattern: 'secret\\s*=\\s*["\']', language: 'generic' },
        { pattern: 'token\\s*=\\s*["\']', language: 'generic' },
        { pattern: 'apiKey\\s*=\\s*["\']', language: 'generic' },
        { pattern: 'passwd\\s*=\\s*["\']', language: 'generic' },
        { pattern: 'SECRET_KEY\\s*=\\s*["\']', language: 'python' },
      ]
    },
    'CWE-918': { // Server-Side Request Forgery (SSRF)
      name: 'cwe-918-ssrf',
      severity: 'ERROR',
      patterns: [
        { pattern: 'http\\.get\\(.*req\\.', language: 'javascript' },
        { pattern: 'requests\\.get\\(.*request\\.', language: 'python' },
        { pattern: 'urllib\\.request', language: 'python' },
        { pattern: 'HttpURLConnection', language: 'java' },
        { pattern: 'file_get_contents\\(.*\\$', language: 'php' },
      ]
    },
    'CWE-200': { // Information Exposure
      name: 'cwe-200-info-exposure',
      severity: 'WARNING',
      patterns: [
        { pattern: 'console\\.log\\(.*password', language: 'javascript' },
        { pattern: 'console\\.log\\(.*secret', language: 'javascript' },
        { pattern: 'print\\(.*password', language: 'python' },
        { pattern: 'console\\.log\\(.*token', language: 'javascript' },
        { pattern: 'System\\.out\\.println.*password', language: 'java' },
        { pattern: 'error.*stack', language: 'generic' },
      ]
    },
    'CWE-22': { // Path Traversal
      name: 'cwe-22-path-traversal',
      severity: 'ERROR',
      patterns: [
        { pattern: 'path\\.join\\(.*req\\.', language: 'javascript' },
        { pattern: 'file\\(.*req\\.', language: 'generic' },
        { pattern: 'readFile\\(.*req\\.', language: 'javascript' },
        { pattern: 'open\\(.*request\\.', language: 'python' },
        { pattern: 'include\\(.*\\$', language: 'php' },
        { pattern: '../', language: 'generic' },
      ]
    },
  };

  // Generate OpenGrep rule files for requested CWEs
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

// Handler to run Trivy (SCA) with CWE-to-source location mapping
ipcMain.handle('scan:cwe-locate', async (event, projectPath, cweIds) => {
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

  // Step 4: Parse and enhance results
  const rawData = readFileSync(outputPath, 'utf8');
  let parsed = {};
  try {
    parsed = JSON.parse(rawData);
  } catch (err) {
    console.error('[scan:cwe-locate] raw OpenGrep JSON=', rawData.slice(0, 2000));
    throw new Error(`Failed to parse OpenGrep JSON: ${err.message}`);
  }

  // Enhanced CWE extraction with confidence scoring
  const extractCweInfo = (hit) => {
    const cweInfo = new Map(); // cweId -> { confidence, source }
    const visit = (item, source) => {
      if (item == null) return;
      if (Array.isArray(item)) {
        item.forEach(i => visit(i, source));
        return;
      }
      if (typeof item === 'object') {
        Object.entries(item).forEach(([key, value]) => visit(value, `${source}.${key}`));
        return;
      }
      const matches = String(item).match(/CWE[-_:\s]*\d+/gi) || [];
      matches.forEach(match => {
        const number = match.replace(/\D/g, '');
        const cweId = `CWE-${number}`;
        const confidence = source.includes('metadata.cwe') ? 'HIGH' : 
                          source.includes('check_id') ? 'MEDIUM' : 'LOW';
        if (!cweInfo.has(cweId) || confidence === 'HIGH') {
          cweInfo.set(cweId, { confidence, source });
        }
      });
    };
    
    visit({
      check_id: hit.check_id,
      message: hit.message,
      metadata: hit.extra?.metadata,
      description: hit.extra?.description,
      category: hit.extra?.metadata?.category,
    }, 'root');
    
    return cweInfo;
  };

  const resultsByCwe = Object.fromEntries(requestedCwes.map(cwe => [cwe, []]));
  const allHits = Array.isArray(parsed.results) ? parsed.results : [];
  console.log('[scan:cwe-locate] total OpenGrep hits=', allHits.length);

  // Step 5: Group and enhance results with metadata
  allHits.forEach(hit => {
    const cweInfo = extractCweInfo(hit);
    
    if (cweInfo.size === 0) return;

    requestedCwes.forEach(requestedCwe => {
      if (cweInfo.has(requestedCwe)) {
        const info = cweInfo.get(requestedCwe);
        resultsByCwe[requestedCwe].push({
          file: hit.path || hit.file || hit.filename || null,
          line: hit.start?.line || hit.line || hit.lineno || null,
          column: hit.start?.col || hit.col || null,
          message: hit.extra?.message || hit.message || hit.check_id || null,
          ruleId: hit.check_id || hit.ruleId || hit.id || null,
          severity: hit.extra?.severity || hit.severity || 'UNKNOWN',
          confidence: info.confidence,
          source: info.source,
          // Enhanced metadata
          metadata: {
            category: hit.extra?.metadata?.category || 'security',
            cwe: requestedCwe,
            language: hit.extra?.metadata?.language || 'unknown',
            owasp: hit.extra?.metadata?.owasp || 'unknown',
          }
        });
      }
    });
  });

  // Step 6: Add statistics and summary
  const summary = {
    totalHits: allHits.length,
    cwesFound: Object.entries(resultsByCwe).filter(([, hits]) => hits.length > 0).length,
    cwesNotFound: Object.entries(resultsByCwe).filter(([, hits]) => hits.length === 0).length,
    highConfidence: Object.values(resultsByCwe).flat().filter(h => h.confidence === 'HIGH').length,
    mediumConfidence: Object.values(resultsByCwe).flat().filter(h => h.confidence === 'MEDIUM').length,
    customRulesUsed: customRules.length,
    scanTimestamp: new Date().toISOString(),
  };

  console.log('[scan:cwe-locate] Summary:', summary);
  console.log('[scan:cwe-locate] Results by CWE:', Object.fromEntries(
    Object.entries(resultsByCwe).map(([id, hits]) => [id, hits.length])
  ));

  return {
    results: resultsByCwe,
    summary,
    metadata: {
      projectPath,
      requestedCwes,
      customRulesGenerated: customRules.length > 0,
    }
  };
});

// Register IPC handlers for file system access
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) return null;
  return {
    path: result.filePaths[0],
    name: path.basename(result.filePaths[0]),
  };
});

ipcMain.handle('fs:readDirectory', async (event, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const result = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;
      result.push({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
      });
    }
    return result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  } catch (err) {
    console.error('Error reading directory:', err);
    throw err;
  }
});

ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    console.error('Error reading file:', err);
    throw err;
  }
});

ipcMain.handle('fs:saveFile', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving file:', err);
    throw err;
  }
});

ipcMain.handle('fs:createFile', async (event, filePath) => {
  try {
    if (existsSync(filePath)) {
      throw new Error('File already exists');
    }
    await fs.writeFile(filePath, '', 'utf-8');
    return true;
  } catch (err) {
    console.error('Error creating file:', err);
    throw err;
  }
});

ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
  try {
    if (existsSync(dirPath)) {
      throw new Error('Directory already exists');
    }
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (err) {
    console.error('Error creating directory:', err);
    throw err;
  }
});

ipcMain.handle('fs:deletePath', async (event, targetPath) => {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.unlink(targetPath);
    }
    return true;
  } catch (err) {
    console.error('Error deleting path:', err);
    throw err;
  }
});