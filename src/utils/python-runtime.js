import { app } from 'electron';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Same search strategy scan-handlers.js uses for scan:ml-predict, factored
// out so the training pipeline (which needs to resolve python once up front
// before spawning a long-running process) doesn't duplicate the list.
function getCandidatePaths() {
  const commonPaths = [
    'py', 'python', 'python3',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'python.exe'),
    path.join(process.env.USERPROFILE || '', 'anaconda3', 'python.exe'),
    path.join(process.env.USERPROFILE || '', 'miniconda3', 'python.exe'),
    'C:\\ProgramData\\anaconda3\\python.exe',
    'C:\\Python312\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Python39\\python.exe',
    'C:\\Python38\\python.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python39', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python38', 'python.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Launcher', 'py.exe'),
  ];

  let customPath = null;
  try {
    const customPathFile = path.join(app.getAppPath(), 'python-path.txt');
    if (existsSync(customPathFile)) {
      customPath = readFileSync(customPathFile, 'utf8').trim();
    }
  } catch (e) {}

  const candidates = [];
  if (customPath) candidates.push(customPath);
  candidates.push(
    ...commonPaths.filter((p) => p === 'py' || p === 'python' || p === 'python3' || existsSync(p))
  );
  return candidates;
}

// Resolves the first python interpreter that actually runs, so a long
// spawn()-based process (like the training pipeline) can fail fast with a
// clear message instead of erroring midway through a run.
export function resolvePythonCommand() {
  return new Promise((resolve, reject) => {
    const candidates = getCandidatePaths();

    const tryNext = (index) => {
      if (index >= candidates.length) {
        reject(
          new Error(
            "Python could not be found. To fix this, create a file named 'python-path.txt' in your cwe-checker folder containing the exact absolute path to your python.exe file."
          )
        );
        return;
      }

      execFile(candidates[index], ['--version'], (error, stdout, stderr) => {
        const isWindowsStoreAlias = stderr && stderr.includes('Python was not found');
        if (error || isWindowsStoreAlias) {
          tryNext(index + 1);
        } else {
          resolve(candidates[index]);
        }
      });
    };

    tryNext(0);
  });
}
