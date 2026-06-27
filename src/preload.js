import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:saveFile', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  deletePath: (targetPath) => ipcRenderer.invoke('fs:deletePath', targetPath),
});


contextBridge.exposeInMainWorld('scannerAPI', {
  selectProject: () => ipcRenderer.invoke('dialog:openProject'),
  runSAST: (folderPath) => ipcRenderer.invoke('scan:sast', folderPath),
  runSCA: (folderPath) => ipcRenderer.invoke('scan:sca', folderPath),
  locateCweFindings: (projectPath, cweIds) => ipcRenderer.invoke('scan:cwe-locate', projectPath, cweIds)
});