import { ipcMain, app } from 'electron';
import path from 'node:path';
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { getBinaryPath } from '../utils/binary-path';
import { runCweLocate } from '../services/cwe-scanner';

export function registerScanHandlers() {
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

  // Handler to run Trivy (SCA) with CWE-to-source location mapping
  ipcMain.handle('scan:cwe-locate', async (event, projectPath, cweIds) => {
    return runCweLocate(projectPath, cweIds);
  });
}