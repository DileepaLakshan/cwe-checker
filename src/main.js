import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { exec } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getBinaryPath(binaryName) {
  const baseDir = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin', 'win') 
    // Add an extra '..' here to step out of the .vite/build folder!
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
      // Look here: 'fs.existsSync' becomes just 'existsSync'
      if (existsSync(outputPath)) {
        const rawData = readFileSync(outputPath, 'utf8'); // 'fs.readFileSync' becomes 'readFileSync'
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
      // Look here: Removed the 'fs.' prefix
      if (existsSync(outputPath)) {
        const rawData = readFileSync(outputPath, 'utf8'); 
        resolve(JSON.parse(rawData));
      } else {
        reject("Failed to generate SCA results: " + (error || stderr));
      }
    });
  });
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
