import path from 'node:path';
import { app } from 'electron';

export function getBinaryPath(binaryName) {
  const baseDir = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin', 'win') 
    : path.join(__dirname, '..', '..', 'bin', 'win'); 
    
  return path.join(baseDir, binaryName);
}