import { dialog, ipcMain } from 'electron';
import path from 'node:path';

export function registerDialogHandlers() {
  // Allow the user to select a project folder to scan
  ipcMain.handle('dialog:openProject', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // Register IPC handler for directory selection
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
}