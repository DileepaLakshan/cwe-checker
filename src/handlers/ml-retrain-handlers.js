import { ipcMain, dialog } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export function registerMlRetrainHandlers() {
  ipcMain.handle('dialog:openDataset', async () => {
    return await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });
  });

  ipcMain.handle('ml:startRetraining', async (event, datasetPath) => {
    return new Promise(async (resolve) => {
      const scriptPath = path.join(process.cwd(), 'src', 'services', 'retrain_pipeline.py');
      
      let pythonExecutable = 'python';
      try {
        const pythonPathFile = path.join(process.cwd(), 'python-path.txt');
        const content = await fs.readFile(pythonPathFile, 'utf8');
        if (content.trim()) {
          pythonExecutable = content.trim();
        }
      } catch (e) {
        // Fallback to global python
      }
      
      const pythonProcess = spawn(pythonExecutable, [scriptPath, datasetPath]);
      
      let errorOutput = '';
      
      pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('PROGRESS:')) {
            const parts = line.split(':');
            if (parts.length >= 3) {
              const percentage = parseInt(parts[1], 10);
              const message = parts.slice(2).join(':');
              event.sender.send('ml:retrainProgress', { percentage, message });
            }
          }
        }
      });
      
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Python Error:', data.toString());
      });
      
      pythonProcess.on('close', async (code) => {
        if (code !== 0) {
          resolve({ success: false, error: errorOutput || 'Unknown error occurred during training.' });
          return;
        }
        
        try {
          const evalPath = path.join(process.cwd(), 'ml_models_staging', 'evaluation.json');
          const evalData = await fs.readFile(evalPath, 'utf8');
          resolve({ success: true, data: JSON.parse(evalData) });
        } catch (e) {
          resolve({ success: false, error: 'Training completed but failed to read evaluation results: ' + e.message });
        }
      });
    });
  });

  ipcMain.handle('ml:applyStagedModels', async () => {
    try {
      const stagingDir = path.join(process.cwd(), 'ml_models_staging');
      const targetDir = path.join(process.cwd(), 'ml_models');
      
      const files = await fs.readdir(stagingDir);
      for (const file of files) {
        if (file.endsWith('.pkl')) {
          await fs.copyFile(path.join(stagingDir, file), path.join(targetDir, file));
        }
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}
