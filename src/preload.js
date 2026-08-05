import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  readDirectory: (dirPath) => ipcRenderer.invoke('fs:readDirectory', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:saveFile', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('fs:createFile', filePath),
  createDirectory: (dirPath) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  deletePath: (targetPath) => ipcRenderer.invoke('fs:deletePath', targetPath),
  selectDataset: () => ipcRenderer.invoke('dialog:openDataset'),
  startRetraining: (datasetPath) => ipcRenderer.invoke('ml:startRetraining', datasetPath),
  applyStagedModels: () => ipcRenderer.invoke('ml:applyStagedModels'),
  onRetrainProgress: (callback) => ipcRenderer.on('ml:retrainProgress', (event, data) => callback(data))
});


contextBridge.exposeInMainWorld('scannerAPI', {
  selectProject: () => ipcRenderer.invoke('dialog:openProject'),
  runSAST: (folderPath) => ipcRenderer.invoke('scan:sast', folderPath),
  runSCA: (folderPath) => ipcRenderer.invoke('scan:sca', folderPath),
  locateCweFindings: (projectPath, cweIds) => ipcRenderer.invoke('scan:cwe-locate', projectPath, cweIds),
  runMLPredict: (featuresData) => ipcRenderer.invoke('scan:ml-predict', featuresData)
});