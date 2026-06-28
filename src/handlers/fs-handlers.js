import { ipcMain } from 'electron';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

export function registerFileSystemHandlers() {
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
}