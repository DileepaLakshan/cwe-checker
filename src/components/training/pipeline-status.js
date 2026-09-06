const GLOBAL_STAGES = [
  { key: 'value_report', label: 'Value Report' },
  { key: 'feature_matrix', label: 'Feature Matrix' },
  { key: 'normalize', label: 'Normalize (KDE)' },
  { key: 'categorize', label: 'Categorize' },
  { key: 'train_models', label: 'Train Models' },
];

const ICONS = {
  idle: '&#9675;', // circle
  running: '&#9679;', // filled circle (spins via CSS)
  done: '&#10003;', // check
  error: '&#10007;', // x
};

export class PipelineStatus {
  static stageState = {};
  static subState = {};
  static log = [];
  static characteristics = [];
  static runId = null;
  static fatalError = null;

  static reset(characteristics, runId = null) {
    PipelineStatus.characteristics = characteristics;
    PipelineStatus.runId = runId;
    PipelineStatus.fatalError = null;
    PipelineStatus.stageState = {};
    GLOBAL_STAGES.forEach((s) => (PipelineStatus.stageState[s.key] = 'idle'));
    PipelineStatus.subState = {};
    characteristics.forEach((c) => (PipelineStatus.subState[c] = { status: 'idle', message: '' }));
    PipelineStatus.log = [];
    PipelineStatus.render();
  }

  static show() {
    document.getElementById('training-progress-step')?.classList.remove('hidden');
  }

  static hide() {
    document.getElementById('training-progress-step')?.classList.add('hidden');
  }

  static appendLog(text) {
    const time = new Date().toLocaleTimeString();
    PipelineStatus.log.push(`[${time}] ${text}`);
    if (PipelineStatus.log.length > 300) PipelineStatus.log.shift();
    const logEl = document.getElementById('training-log');
    if (logEl) {
      logEl.textContent = PipelineStatus.log.join('\n');
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  static applyEvent(evt) {
    if (!evt || !evt.stage) return;
    if (evt.runId) PipelineStatus.runId = evt.runId;

    if (GLOBAL_STAGES.some((s) => s.key === evt.stage)) {
      PipelineStatus.stageState[evt.stage] = evt.status === 'error' ? 'error' : evt.status;
      if (evt.status === 'running') PipelineStatus.appendLog(`${evt.stage}: running`);
      if (evt.status === 'done') {
        const extra = evt.project_count !== undefined ? ` (${evt.project_count} projects)` : '';
        PipelineStatus.appendLog(`${evt.stage}: done${extra}`);
      }
      if (evt.status === 'error') PipelineStatus.appendLog(`${evt.stage}: ERROR - ${evt.message || ''}`);
    } else if (evt.stage === 'target_and_update' || evt.stage === 'train_model') {
      PipelineStatus.stageState.train_models = 'running';
      const sub = PipelineStatus.subState[evt.characteristic] || { status: 'idle' };

      if (evt.stage === 'target_and_update' && evt.status === 'running') {
        sub.status = 'preparing';
      } else if (evt.stage === 'train_model' && evt.status === 'running') {
        sub.status = 'training';
      } else if (evt.stage === 'train_model' && evt.status === 'done') {
        sub.status = 'done';
        sub.metrics = evt.metrics;
        PipelineStatus.appendLog(`${evt.characteristic}: trained (R2=${evt.metrics.r2.toFixed(3)})`);
      } else if (evt.status === 'error') {
        sub.status = 'error';
        sub.message = evt.message;
        PipelineStatus.appendLog(`${evt.characteristic}: ERROR - ${evt.message || ''}`);
      }
      PipelineStatus.subState[evt.characteristic] = sub;
    } else if (evt.stage === 'complete') {
      const anyError = Object.values(PipelineStatus.subState).some((s) => s.status === 'error');
      PipelineStatus.stageState.train_models = anyError ? 'error' : 'done';
      PipelineStatus.appendLog('Pipeline complete.');
    } else if (evt.stage === 'fatal') {
      const runningStage = GLOBAL_STAGES.find((s) => PipelineStatus.stageState[s.key] === 'running');
      if (runningStage) PipelineStatus.stageState[runningStage.key] = 'error';
      PipelineStatus.appendLog(`FATAL: ${evt.message || 'training failed'}`);
      PipelineStatus.showFatalError(evt.message || 'Training failed.');
    }

    PipelineStatus.updateDOM();
  }

  // Called both for a 'fatal' NDJSON event and for training-service.js's
  // catch block (e.g. the process crashed before emitting any JSON, or
  // python couldn't be found at all) - either way the goal is the same:
  // put the real error where it can't be missed, with a way to pull the
  // full log instead of just whatever fit on one line.
  static showFatalError(message) {
    PipelineStatus.fatalError = message;
    const banner = document.getElementById('training-error-banner');
    if (banner) {
      banner.textContent = message;
      banner.classList.remove('hidden');
    }
  }

  static render() {
    const container = document.getElementById('training-progress-step');
    if (!container) return;

    container.innerHTML = `
      <div id="training-error-banner" class="training-error-banner hidden"></div>
      <div class="pipeline-stepper" id="pipeline-stepper"></div>
      <div class="pipeline-log-wrapper">
        <div class="pipeline-log-title">Log</div>
        <pre id="training-log" class="pipeline-log"></pre>
      </div>
      <div class="vc-modal-actions">
        <button id="training-reveal-log-btn" class="vc-btn-secondary">Reveal Log File</button>
        <button id="training-cancel-btn" class="vc-btn-secondary">Cancel Training</button>
      </div>
    `;

    const cancelBtn = container.querySelector('#training-cancel-btn');
    cancelBtn.addEventListener('click', async () => {
      cancelBtn.disabled = true;
      cancelBtn.textContent = 'Cancelling...';
      await window.trainingAPI.cancel();
    });

    const revealBtn = container.querySelector('#training-reveal-log-btn');
    revealBtn.addEventListener('click', async () => {
      try {
        await window.trainingAPI.revealLog(PipelineStatus.runId);
      } catch (e) {
        PipelineStatus.appendLog(`Could not open log file: ${e.message || e}`);
      }
    });

    if (PipelineStatus.fatalError) {
      PipelineStatus.showFatalError(PipelineStatus.fatalError);
    }

    PipelineStatus.updateDOM();
  }

  static updateDOM() {
    const stepper = document.getElementById('pipeline-stepper');
    if (!stepper) return;

    stepper.innerHTML = GLOBAL_STAGES.map((s) => {
      const status = PipelineStatus.stageState[s.key] || 'idle';
      const isTrainStage = s.key === 'train_models';
      const subRows = isTrainStage
        ? PipelineStatus.characteristics
            .map((c) => {
              const sub = PipelineStatus.subState[c] || { status: 'idle' };
              const subClass = sub.status === 'error' ? 'error' : sub.status === 'done' ? 'done' : sub.status === 'idle' ? 'idle' : 'running';
              const subIcon = sub.status === 'error' ? ICONS.error : sub.status === 'done' ? ICONS.done : sub.status === 'idle' ? ICONS.idle : ICONS.running;
              return `
                <div class="pipeline-substep ${subClass}">
                  <span class="pipeline-substep-icon">${subIcon}</span>
                  <span class="pipeline-substep-label">${c}</span>
                  <span class="pipeline-substep-status">${sub.status}</span>
                </div>
              `;
            })
            .join('')
        : '';

      return `
        <div class="pipeline-stage ${status}">
          <div class="pipeline-stage-header">
            <span class="pipeline-stage-icon">${ICONS[status] || ICONS.idle}</span>
            <span class="pipeline-stage-label">${s.label}</span>
          </div>
          ${subRows ? `<div class="pipeline-substeps">${subRows}</div>` : ''}
        </div>
      `;
    }).join('');
  }
}
