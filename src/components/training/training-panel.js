import { PipelineStatus } from './pipeline-status.js';
import { TrainingResults } from './training-results.js';
import { TrainingService } from '../../services/training-service.js';

// Mirrors categorize.py's ALL_CHARACTERISTICS - the 8 quality
// characteristics the pipeline can split a dataset into and train a model
// for.
export const ALL_CHARACTERISTICS = [
  'Security',
  'Confidentiality',
  'Access Control',
  'Integrity',
  'Availability',
  'Non-Repudiation',
  'Maintainability',
  'Usability',
];

export class TrainingPanel {
  static selectedDataset = null;

  static init() {
    const modal = document.getElementById('training-modal');
    const closeBtn = document.getElementById('training-modal-close');
    if (!modal) return; // Not injected in DOM yet

    if (closeBtn) {
      // Closing the modal never cancels a run - it just hides the panel.
      closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    TrainingService.onStatusBarClick(() => {
      modal.classList.remove('hidden');
    });

    // Always-available entry point: the Activity Bar icon exists from app
    // startup, independent of whether a project has ever been scanned - you
    // shouldn't need scan results on screen just to import a training set.
    const activityBtn = document.getElementById('train-model-activity-btn');
    if (activityBtn) {
      activityBtn.addEventListener('click', () => TrainingPanel.open());
    }

    TrainingPanel.wireEntryButton();
  }

  // #train-model-btn lives inside ml-results-panel.js's innerHTML, which is
  // rebuilt from scratch on every scan - so this must be re-run after each
  // render (MlResultsPanel.render calls it) rather than once at startup.
  static wireEntryButton() {
    const openBtn = document.getElementById('train-model-btn');
    if (!openBtn) return;
    openBtn.addEventListener('click', () => TrainingPanel.open());
  }

  static open() {
    const modal = document.getElementById('training-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Reopening mid-run should land wherever the run currently is, not
    // reset back to setup - training keeps going in the background.
    if (!TrainingService.isRunning() && !TrainingService.lastResult()) {
      TrainingPanel.renderSetup();
    }
  }

  static async renderSetup() {
    const container = document.getElementById('training-setup-step');
    if (!container) return;

    document.getElementById('training-progress-step')?.classList.add('hidden');
    document.getElementById('training-results-step')?.classList.add('hidden');
    container.classList.remove('hidden');

    let versions = {};
    try {
      versions = await window.trainingAPI.listVersions();
    } catch (e) {
      console.error('Failed to load model versions:', e);
    }

    container.innerHTML = `
      <p class="training-intro">
        Import a labeled dataset (a folder with one subfolder per repo, each containing a
        <code>report.txt</code> - the same shape as <code>Batch_Results/</code>) and retrain
        one or more of the quality-characteristic models. You'll be able to compare the new
        model against the one currently in use before deciding to apply it.
      </p>

      <div class="training-dataset-picker">
        <button id="training-pick-dataset" class="vc-btn-primary">Choose Dataset Folder</button>
        <div id="training-dataset-preview" class="training-dataset-preview"></div>
      </div>

      <div class="training-characteristics">
        <h4>Characteristics to retrain</h4>
        <div id="training-characteristics-list" class="training-characteristics-list">
          ${ALL_CHARACTERISTICS.map((c) => {
            const hasProduction = !!(versions[c] && versions[c].production);
            return `
              <label class="training-characteristic-row">
                <input type="checkbox" value="${c}" ${hasProduction ? 'checked' : ''}>
                <span>${c}</span>
                ${hasProduction ? '<span class="training-badge">has a live model</span>' : '<span class="training-badge training-badge-new">no live model yet</span>'}
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <div class="vc-modal-actions">
        <button id="training-start-btn" class="vc-btn-primary" disabled>Start Training</button>
      </div>
    `;

    const pickBtn = container.querySelector('#training-pick-dataset');
    const preview = container.querySelector('#training-dataset-preview');
    const startBtn = container.querySelector('#training-start-btn');
    const checkboxes = container.querySelectorAll('.training-characteristics-list input[type="checkbox"]');

    const updateStartEnabled = () => {
      const anyChecked = Array.from(checkboxes).some((cb) => cb.checked);
      startBtn.disabled = !(TrainingPanel.selectedDataset && anyChecked);
    };
    checkboxes.forEach((cb) => cb.addEventListener('change', updateStartEnabled));

    const applyDatasetResult = (result) => {
      TrainingPanel.selectedDataset = result.path;

      const lowCountWarning =
        !result.suggestion && result.repoCount > 0 && result.repoCount < 10
          ? `<div class="training-dataset-warning">Only ${result.repoCount} repo(s) here - the pipeline typically needs 10+ labeled
             projects per characteristic to train a usable model. Training will likely fail with "not enough labeled projects".</div>`
          : '';

      const suggestionHtml = result.suggestion
        ? `<div class="training-dataset-warning">
             Only ${result.repoCount} repo(s) found directly in this folder, but
             <strong>${result.suggestion.repoCount}</strong> were found in a subfolder. Did you mean to pick that one?
             <div><button id="training-use-suggestion" class="vc-btn-secondary" data-path="${result.suggestion.path}" style="margin-top:8px;">
               Use <code>${result.suggestion.path}</code> instead
             </button></div>
           </div>`
        : '';

      preview.innerHTML = `
        ${suggestionHtml}
        ${lowCountWarning}
        <div class="training-dataset-ok">
          <strong>${result.repoCount}</strong> repo(s) found in <code>${result.path}</code>
          <div class="training-dataset-repos">${result.repoNames.slice(0, 12).join(', ')}${result.repoNames.length > 12 ? ', ...' : ''}</div>
        </div>
      `;

      const useSuggestionBtn = preview.querySelector('#training-use-suggestion');
      if (useSuggestionBtn) {
        useSuggestionBtn.addEventListener('click', async () => {
          useSuggestionBtn.disabled = true;
          useSuggestionBtn.textContent = 'Switching...';
          try {
            const nested = await window.trainingAPI.describeDataset(useSuggestionBtn.dataset.path);
            applyDatasetResult(nested);
          } catch (e) {
            preview.innerHTML = `<div class="training-dataset-error">${e.message || e}</div>`;
            TrainingPanel.selectedDataset = null;
          } finally {
            updateStartEnabled();
          }
        });
      }
    };

    pickBtn.addEventListener('click', async () => {
      try {
        pickBtn.disabled = true;
        pickBtn.textContent = 'Choosing...';
        const result = await window.trainingAPI.selectDataset();
        if (result) applyDatasetResult(result);
      } catch (e) {
        preview.innerHTML = `<div class="training-dataset-error">${e.message || e}</div>`;
        TrainingPanel.selectedDataset = null;
      } finally {
        pickBtn.disabled = false;
        pickBtn.textContent = 'Choose Dataset Folder';
        updateStartEnabled();
      }
    });

    startBtn.addEventListener('click', () => {
      const characteristics = Array.from(checkboxes)
        .filter((cb) => cb.checked)
        .map((cb) => cb.value);
      if (!TrainingPanel.selectedDataset || characteristics.length === 0) return;

      document.getElementById('training-setup-step').classList.add('hidden');
      PipelineStatus.reset(characteristics);
      PipelineStatus.show();
      TrainingService.startTraining(TrainingPanel.selectedDataset, characteristics);
    });
  }
}
