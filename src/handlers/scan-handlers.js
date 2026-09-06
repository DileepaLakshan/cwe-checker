import { ipcMain, app } from 'electron';
import path from 'node:path';
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { getBinaryPath } from '../utils/binary-path';
import { runCweLocate } from '../services/cwe-scanner';
import { getProductionDir, ensureSeeded } from '../services/model-store';

export function registerScanHandlers() {
  // Handler to run OpenGrep (SAST)
  ipcMain.handle('scan:sast', async (event, targetFolder) => {
    const opengrepPath = getBinaryPath('opengrep_windows_x86.exe'); 
    const outputPath = path.join(app.getPath('userData'), 'sast-results.json');
    
    // Delete old results file to prevent reading stale data if scan fails
    if (existsSync(outputPath)) {
      try { require('node:fs').unlinkSync(outputPath); } catch (e) {}
    }
    
    const command = `"${opengrepPath}" scan --config "p/default" --config "p/java" --config "p/javascript" --config "p/secrets" --json --output "${outputPath}" "${targetFolder}"`;

    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (existsSync(outputPath)) {
          const rawData = readFileSync(outputPath, 'utf8');
          resolve(JSON.parse(rawData));
        } else {
          reject("Failed to generate SAST results: " + (error ? error.message : stderr));
        }
      });
    });
  });

  // Handler to run Trivy (SCA)
  ipcMain.handle('scan:sca', async (event, targetFolder) => {
    const trivyPath = getBinaryPath('trivy.exe');
    const outputPath = path.join(app.getPath('userData'), 'sca-results.json');
    
    // Delete old results file to prevent reading stale data if scan fails
    if (existsSync(outputPath)) {
      try { require('node:fs').unlinkSync(outputPath); } catch (e) {}
    }
    
    const command = `"${trivyPath}" fs --scanners vuln --offline-scan --timeout 15m --format json --output "${outputPath}" "${targetFolder}"`;

    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (existsSync(outputPath)) {
          const rawData = readFileSync(outputPath, 'utf8'); 
          resolve(JSON.parse(rawData));
        } else {
          reject("Failed to generate SCA results: " + (error ? error.message : stderr));
        }
      });
    });
  });

  // Handler to run Trivy (SCA) with CWE-to-source location mapping
  ipcMain.handle('scan:cwe-locate', async (event, projectPath, cweIds) => {
    return runCweLocate(projectPath, cweIds);
  });

  // Handler to run ML predictions
  ipcMain.handle('scan:ml-predict', async (event, featuresData) => {
    await ensureSeeded();
    const modelsDir = getProductionDir();

    return new Promise((resolve, reject) => {
      const pythonScriptPath = path.join(app.getAppPath(), 'ml_models', 'predict.py');
      const args = JSON.stringify(featuresData).replace(/"/g, '\\"');

      const commonPaths = [
        'py', 'python', 'python3',
        path.join(app.getAppPath(), 'python-path.txt'), // Check if user provided a custom path file
        path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'python.exe'),
        path.join(process.env.USERPROFILE || '', 'anaconda3', 'python.exe'),
        path.join(process.env.USERPROFILE || '', 'miniconda3', 'python.exe'),
        'C:\\\\ProgramData\\\\anaconda3\\\\python.exe',
        'C:\\\\Python312\\\\python.exe',
        'C:\\\\Python311\\\\python.exe',
        'C:\\\\Python310\\\\python.exe',
        'C:\\\\Python39\\\\python.exe',
        'C:\\\\Python38\\\\python.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python39', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python38', 'python.exe'),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Launcher', 'py.exe')
      ];
      
      let customPath = null;
      try {
        const customPathFile = path.join(app.getAppPath(), 'python-path.txt');
        if (require('node:fs').existsSync(customPathFile)) {
          customPath = require('node:fs').readFileSync(customPathFile, 'utf8').trim();
        }
      } catch (e) {}

      const commandsToTry = [];
      if (customPath) commandsToTry.push(customPath);
      
      commandsToTry.push(...commonPaths.filter(p => p === 'py' || p === 'python' || p === 'python3' || (typeof p === 'string' && require('node:fs').existsSync(p) && !p.endsWith('python-path.txt'))));
      
      const tryExecute = (index) => {
        if (index >= commandsToTry.length) {
          reject("Python could not be found. To fix this, create a file named 'python-path.txt' in your cwe-checker folder containing the exact absolute path to your python.exe file.");
          return;
        }

        const cmd = commandsToTry[index];
        const command = `"${cmd}" "${pythonScriptPath}" "${args}" "${modelsDir}"`;
        
        exec(command, (error, stdout, stderr) => {
          const isWindowsStoreAliasError = stderr && stderr.includes("Python was not found");
          
          if (error || isWindowsStoreAliasError) {
            if (error && error.code === 'ENOENT' || isWindowsStoreAliasError || (stderr && stderr.includes('not recognized'))) {
              tryExecute(index + 1);
            } else {
              console.error("ML Predict Error:", error);
              console.error("ML Predict Stderr:", stderr);
              reject("Failed to run ML model: " + (error ? error.message : stderr));
            }
            return;
          }
          
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (e) {
            reject("Failed to parse ML output: " + e.message + "\\nOutput: " + stdout);
          }
        });
      };

      tryExecute(0);
    });
  });
}