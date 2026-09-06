import { app, dialog, ipcMain, shell } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { resolvePythonCommand } from '../utils/python-runtime';
import { NdjsonReader } from '../utils/ndjson';
import {
  discard as discardModel,
  generateRunId,
  getStagingDir,
  listRegistry,
  promote as promoteModel,
  recordStaged,
  restore as restoreModel,
} from '../services/model-store';

// Only one training run at a time - the pipeline is CPU-bound (KDE fits +
// RandomForest) and writes into a single per-run scratch directory, so
// there's no benefit to overlapping runs and real risk of confusing progress
// events if we tried.
let activeChild = null;
let activeLogPath = null;

function getLogsDir() {
  return path.join(app.getPath('userData'), 'training-logs');
}

function getLogPath(runId) {
  return path.join(getLogsDir(), `${runId}.log`);
}

async function scanForRepos(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const repos = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (existsSync(path.join(dir, entry.name, 'report.txt'))) {
      repos.push(entry.name);
    }
  }
  return repos;
}

// Shared by both the folder-picker flow and the "use this folder instead"
// suggestion click - takes a path directly, no dialog involved.
async function describeDataset(datasetPath) {
  const repoNames = await scanForRepos(datasetPath);

  // A near-empty hit at the selected level almost always means the user
  // picked the parent of the real Batch_Results-style folder (e.g. a
  // "Result01" folder that contains "Batch_Results/" alongside other
  // stuff) rather than that folder itself. Check one level down and
  // suggest the real folder instead of silently training on 1-2 repos.
  let suggestion = null;
  if (repoNames.length < 5) {
    const entries = await fs.readdir(datasetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const nestedPath = path.join(datasetPath, entry.name);
      const nestedRepos = await scanForRepos(nestedPath).catch(() => []);
      if (nestedRepos.length >= 5 && nestedRepos.length > repoNames.length) {
        suggestion = { path: nestedPath, repoCount: nestedRepos.length };
        break;
      }
    }
  }

  if (repoNames.length === 0 && !suggestion) {
    throw new Error(
      'No repo subfolders with a report.txt were found in that folder. Expected a ' +
        'Batch_Results-style folder: one subfolder per repo, each containing report.txt.'
    );
  }

  return { path: datasetPath, repoCount: repoNames.length, repoNames: repoNames.sort(), suggestion };
}

export function registerTrainingHandlers(mainWindow) {
  ipcMain.handle('training:selectDataset', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled) return null;
    return describeDataset(result.filePaths[0]);
  });

  ipcMain.handle('training:describeDataset', async (event, { datasetPath }) => {
    return describeDataset(datasetPath);
  });

  ipcMain.handle('training:start', async (event, { datasetPath, characteristics }) => {
    if (activeChild) {
      throw new Error('A training run is already in progress.');
    }
    if (!datasetPath || !Array.isArray(characteristics) || characteristics.length === 0) {
      throw new Error('A dataset folder and at least one characteristic are required.');
    }

    const runId = generateRunId();
    const runDir = path.join(app.getPath('userData'), 'training-runs', runId);
    const stagingDir = getStagingDir(runId);
    const scriptPath = path.join(app.getAppPath(), 'ml_models', 'training', 'run_pipeline.py');

    await fs.mkdir(getLogsDir(), { recursive: true });
    const logPath = getLogPath(runId);
    activeLogPath = logPath;
    await fs.writeFile(logPath, '', 'utf-8');

    const recentStderr = [];
    // Appended immediately (not buffered to flush at the end) so the log
    // file is useful to inspect - via "Reveal Log" - while a run is still
    // in progress, and still captures everything even if the process is
    // killed abruptly.
    const log = (text) => {
      const line = `[${new Date().toISOString()}] ${text}`;
      console.log(`[training:${runId}]`, text);
      fs.appendFile(logPath, line + '\n', 'utf-8').catch((e) => console.error('Failed to write training log:', e));
    };

    let pythonCmd;
    try {
      pythonCmd = await resolvePythonCommand();
    } catch (err) {
      log(`FATAL: could not resolve a python interpreter - ${err.message}`);
      throw new Error(`${err.message}\n\nLog: ${logPath}`);
    }

    const args = [
      scriptPath,
      '--dataset', datasetPath,
      '--characteristics', characteristics.join(','),
      '--run-dir', runDir,
      '--staging-dir', stagingDir,
    ];
    log(`Spawning: "${pythonCmd}" ${args.map((a) => `"${a}"`).join(' ')}`);
    log(`Log file: ${logPath}`);

    return new Promise((resolve, reject) => {
      const child = spawn(pythonCmd, args, { windowsHide: true });
      activeChild = child;

      const ndjson = new NdjsonReader();
      let finalResults = null;
      let fatalMessage = null;

      const send = (payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('training:progress', { runId, logPath, ...payload });
        }
      };

      const handleEvent = (evt) => {
        log(`event: ${JSON.stringify(evt)}`);
        send(evt);

        if (evt.stage === 'complete') {
          finalResults = evt.results;
        } else if (evt.stage === 'fatal') {
          fatalMessage = evt.message;
        } else if (evt.stage === 'train_model' && evt.status === 'done' && evt.characteristic) {
          recordStaged(runId, evt.characteristic, evt.modelFile, evt.metrics).catch((err) =>
            console.error('Failed to record staged model:', err)
          );
        }
      };

      child.stdout.on('data', (chunk) => {
        for (const evt of ndjson.push(chunk.toString())) {
          handleEvent(evt);
        }
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        // Split into lines so each shows up as its own timestamped log entry
        // rather than one giant blob - stack traces are much easier to read
        // this way in both the log file and the main process console.
        text.split(/\r?\n/).filter(Boolean).forEach((line) => {
          recentStderr.push(line);
          if (recentStderr.length > 40) recentStderr.shift();
          log(`stderr: ${line}`);
        });
      });

      child.on('error', (err) => {
        log(`FATAL: failed to spawn python process - ${err.message}`);
        activeChild = null;
        reject(new Error(`Failed to start training process: ${err.message}. See log: ${logPath}`));
      });

      // Wait for 'close' (all stdio streams fully flushed), not 'exit' -
      // 'exit' can fire before the last stderr chunk has been delivered,
      // which was silently truncating the real error on a crash.
      child.on('close', (code) => {
        log(`process closed with exit code ${code}`);
        activeChild = null;
        // activeLogPath deliberately stays set after the run ends (success
        // or failure) so "Reveal Log" still works for the run that just
        // finished - it's only replaced when the next run starts.

        if (code === 0 && finalResults) {
          resolve({ runId, results: finalResults, logPath });
        } else {
          const reason = fatalMessage || recentStderr.join('\n') || `Training process exited with code ${code}`;
          reject(new Error(`${reason}\n\nFull log: ${logPath}`));
        }
      });
    });
  });

  ipcMain.handle('training:cancel', async () => {
    if (activeChild) {
      activeChild.kill();
      activeChild = null;
      return true;
    }
    return false;
  });

  ipcMain.handle('training:revealLog', async (event, { runId } = {}) => {
    const logPath = runId ? getLogPath(runId) : activeLogPath;
    if (!logPath || !existsSync(logPath)) {
      throw new Error('No log file available for this run yet.');
    }
    shell.showItemInFolder(logPath);
    return logPath;
  });

  ipcMain.handle('training:readLog', async (event, { runId } = {}) => {
    const logPath = runId ? getLogPath(runId) : activeLogPath;
    if (!logPath || !existsSync(logPath)) {
      return '';
    }
    return fs.readFile(logPath, 'utf-8');
  });

  ipcMain.handle('training:listVersions', async () => {
    return listRegistry();
  });

  ipcMain.handle('training:promote', async (event, { characteristic, runId }) => {
    return promoteModel(characteristic, runId);
  });

  ipcMain.handle('training:discard', async (event, { characteristic, runId }) => {
    await discardModel(characteristic, runId);
    return true;
  });

  ipcMain.handle('training:restore', async (event, { characteristic, versionId }) => {
    return restoreModel(characteristic, versionId);
  });
}
