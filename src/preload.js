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
  locateCweFindings: (projectPath, cweIds) => ipcRenderer.invoke('scan:cwe-locate', projectPath, cweIds),
  runMLPredict: (featuresData) => ipcRenderer.invoke('scan:ml-predict', featuresData)
});

contextBridge.exposeInMainWorld('trainingAPI', {
  selectDataset: () => ipcRenderer.invoke('training:selectDataset'),
  describeDataset: (datasetPath) => ipcRenderer.invoke('training:describeDataset', { datasetPath }),
  start: (datasetPath, characteristics) => ipcRenderer.invoke('training:start', { datasetPath, characteristics }),
  cancel: () => ipcRenderer.invoke('training:cancel'),
  listVersions: () => ipcRenderer.invoke('training:listVersions'),
  promote: (characteristic, runId) => ipcRenderer.invoke('training:promote', { characteristic, runId }),
  discard: (characteristic, runId) => ipcRenderer.invoke('training:discard', { characteristic, runId }),
  restore: (characteristic, versionId) => ipcRenderer.invoke('training:restore', { characteristic, versionId }),
  revealLog: (runId) => ipcRenderer.invoke('training:revealLog', { runId }),
  readLog: (runId) => ipcRenderer.invoke('training:readLog', { runId }),
  // Push channel: main process streams one event per pipeline stage while
  // training:start's promise is still pending. Returns an unsubscribe fn.
  onProgress: (callback) => {
    const listener = (event, payload) => callback(payload);
    ipcRenderer.on('training:progress', listener);
    return () => ipcRenderer.removeListener('training:progress', listener);
  },
});