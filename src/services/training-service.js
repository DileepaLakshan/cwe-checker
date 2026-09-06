import { PipelineStatus } from '../components/training/pipeline-status.js';
import { TrainingResults } from '../components/training/training-results.js';

// Orchestrates a training run from the renderer side: subscribes to the
// main process's NDJSON progress stream, drives the pipeline-status stepper,
// keeps the status bar showing ambient progress while the modal is closed
// (training keeps running in the background), and hands off to the results
// view on completion. Mirrors how scan-service.js drives ScanResultsPanel.
export class TrainingService {
  static running = false;
  static unsubscribe = null;
  static _lastResult = null;
  static statusBarClickCallback = null;

  static isRunning() {
    return TrainingService.running;
  }

  static lastResult() {
    return TrainingService._lastResult;
  }

  static onStatusBarClick(callback) {
    TrainingService.statusBarClickCallback = callback;
    const modeEl = document.getElementById('status-mode');
    if (modeEl) {
      modeEl.addEventListener('click', () => {
        if (TrainingService.running || TrainingService._lastResult) {
          TrainingService.statusBarClickCallback();
        }
      });
    }
  }

  static setStatusBar(text, isError = false) {
    const modeEl = document.getElementById('status-mode');
    if (!modeEl) return;
    modeEl.innerHTML = `<span class="status-dot ${isError ? 'error' : ''}"></span> ${text}`;
    modeEl.style.cursor = 'pointer';
  }

  static resetStatusBar() {
    const modeEl = document.getElementById('status-mode');
    if (!modeEl) return;
    modeEl.innerHTML = `<span class="status-dot"></span> Ready`;
    modeEl.style.cursor = '';
  }

  static async startTraining(datasetPath, characteristics) {
    TrainingService.running = true;
    TrainingService._lastResult = null;
    TrainingService.setStatusBar(`Training: starting (${characteristics.length} model${characteristics.length > 1 ? 's' : ''})`);

    TrainingService.unsubscribe = window.trainingAPI.onProgress((evt) => {
      PipelineStatus.applyEvent(evt);
      TrainingService.updateStatusBarFromEvent(evt, characteristics.length);
    });

    try {
      const { runId, results } = await window.trainingAPI.start(datasetPath, characteristics);
      TrainingService._lastResult = { runId, results };

      const anyDone = Object.values(results).some((r) => r.status === 'done');
      TrainingService.setStatusBar(anyDone ? 'Training complete - review results' : 'Training finished with errors', !anyDone);

      const registry = await window.trainingAPI.listVersions();
      await TrainingResults.render(runId, results, registry);
    } catch (e) {
      console.error('Training run failed:', e);
      const message = e.message || String(e);
      PipelineStatus.appendLog(`Run failed: ${message}`);
      PipelineStatus.showFatalError(message);
      TrainingService.setStatusBar('Training failed - see log', true);
    } finally {
      TrainingService.running = false;
      if (TrainingService.unsubscribe) {
        TrainingService.unsubscribe();
        TrainingService.unsubscribe = null;
      }
    }
  }

  static updateStatusBarFromEvent(evt, total) {
    if (evt.stage === 'train_model' && evt.status === 'running' && evt.characteristic) {
      TrainingService.setStatusBar(`Training: ${evt.characteristic}`);
    } else if (evt.stage && evt.status === 'running') {
      const labels = {
        value_report: 'Value report',
        feature_matrix: 'Feature matrix',
        normalize: 'Normalizing',
        categorize: 'Categorizing',
        target_and_update: `Preparing ${evt.characteristic || ''}`,
      };
      TrainingService.setStatusBar(`Training: ${labels[evt.stage] || evt.stage}`);
    }
  }
}
