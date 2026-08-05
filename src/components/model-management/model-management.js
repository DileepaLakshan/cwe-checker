/**
 * Model Management Component
 */
export class ModelManagement {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    this.container = container;
    this.container.innerHTML = this.getTemplate();
    this.attachEventListeners();
    this.subscribeToEvents();
    
    this.resultsData = null;
  }

  static getTemplate() {
    return `
      <div class="model-management-panel" style="padding: 24px; color: var(--text-primary); max-width: 800px; margin: 0 auto;">
        <h2 style="margin-top: 0; margin-bottom: 20px; font-weight: 500;">Model Management</h2>
        
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 20px; margin-bottom: 24px;">
          <h3 style="margin-top: 0; font-size: 16px; margin-bottom: 12px;">Retrain Machine Learning Models</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px; line-height: 1.5;">
            Select a new dataset (Feature Matrix CSV or Batch_Results directory) to retrain the Random Forest models for all quality characteristics.
          </p>
          
          <div style="display: flex; gap: 12px; margin-bottom: 20px;">
            <button id="btn-select-dataset" class="btn btn-secondary" style="padding: 8px 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); cursor: pointer; border-radius: 4px;">Select Dataset...</button>
            <span id="selected-dataset-path" style="color: var(--text-secondary); font-size: 13px; align-self: center; font-family: monospace;">No dataset selected</span>
          </div>
          
          <button id="btn-start-retrain" class="btn btn-primary" style="padding: 8px 16px; background: var(--accent-color, #3b82f6); border: none; color: white; cursor: pointer; border-radius: 4px; font-weight: 500;" disabled>Start Retraining</button>
        </div>
        
        <div id="retrain-progress-container" style="display: none; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span id="retrain-status-text" style="font-size: 14px; font-weight: 500;">Initializing...</span>
            <span id="retrain-percentage" style="font-size: 14px; color: var(--text-secondary);">0%</span>
          </div>
          <div style="width: 100%; height: 8px; background: var(--bg-tertiary); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
            <div id="retrain-progress-bar" style="width: 0%; height: 100%; background: var(--accent-color, #3b82f6); transition: width 0.3s ease;"></div>
          </div>
        </div>
        
        <div id="retrain-results-container" style="display: none; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 20px;">
          <h3 style="margin-top: 0; font-size: 16px; margin-bottom: 16px; color: var(--success-color, #10b981);">Training Completed Successfully</h3>
          
          <div id="retrain-metrics-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <!-- Metrics will be injected here -->
          </div>
          
          <div style="border-top: 1px solid var(--border-color); padding-top: 20px; display: flex; justify-content: flex-end;">
             <button id="btn-apply-models" class="btn btn-primary" style="padding: 8px 16px; background: var(--success-color, #10b981); border: none; color: white; cursor: pointer; border-radius: 4px; font-weight: 500;">Update Models (Apply)</button>
          </div>
        </div>
      </div>
    `;
  }

  static attachEventListeners() {
    let selectedPath = null;
    
    document.getElementById('btn-select-dataset')?.addEventListener('click', async () => {
      if (window.api && window.api.selectDataset) {
        const result = await window.api.selectDataset();
        if (result && !result.canceled && result.filePaths.length > 0) {
          selectedPath = result.filePaths[0];
          document.getElementById('selected-dataset-path').textContent = selectedPath;
          document.getElementById('btn-start-retrain').disabled = false;
        }
      }
    });

    document.getElementById('btn-start-retrain')?.addEventListener('click', async () => {
      if (!selectedPath) return;
      
      // Reset UI
      document.getElementById('retrain-results-container').style.display = 'none';
      document.getElementById('retrain-progress-container').style.display = 'block';
      document.getElementById('btn-start-retrain').disabled = true;
      document.getElementById('btn-select-dataset').disabled = true;
      
      this.updateProgress(0, 'Starting pipeline...');
      
      if (window.api && window.api.startRetraining) {
        try {
          const result = await window.api.startRetraining(selectedPath);
          if (result.success) {
            this.resultsData = result.data;
            this.showResults();
          } else {
            alert(`Retraining failed: ${result.error}`);
            document.getElementById('retrain-progress-container').style.display = 'none';
          }
        } catch (e) {
          alert(`Error during retraining: ${e.message}`);
          document.getElementById('retrain-progress-container').style.display = 'none';
        } finally {
          document.getElementById('btn-start-retrain').disabled = false;
          document.getElementById('btn-select-dataset').disabled = false;
        }
      }
    });
    
    document.getElementById('btn-apply-models')?.addEventListener('click', async () => {
      if (window.api && window.api.applyStagedModels) {
        const btn = document.getElementById('btn-apply-models');
        btn.disabled = true;
        btn.textContent = 'Applying...';
        
        const result = await window.api.applyStagedModels();
        if (result.success) {
          alert('Models updated successfully! They will be used for future predictions.');
          btn.textContent = 'Models Applied';
        } else {
          alert(`Failed to apply models: ${result.error}`);
          btn.textContent = 'Update Models (Apply)';
          btn.disabled = false;
        }
      }
    });
  }

  static subscribeToEvents() {
    if (window.api && window.api.onRetrainProgress) {
      window.api.onRetrainProgress((data) => {
        this.updateProgress(data.percentage, data.message);
      });
    }
  }

  static updateProgress(percentage, message) {
    const bar = document.getElementById('retrain-progress-bar');
    const text = document.getElementById('retrain-status-text');
    const pct = document.getElementById('retrain-percentage');
    
    if (bar) bar.style.width = `${percentage}%`;
    if (text) text.textContent = message;
    if (pct) pct.textContent = `${percentage}%`;
  }
  
  static showResults() {
    document.getElementById('retrain-progress-container').style.display = 'none';
    const resultsContainer = document.getElementById('retrain-results-container');
    const metricsList = document.getElementById('retrain-metrics-list');
    
    if (!resultsContainer || !metricsList || !this.resultsData) return;
    
    let html = '';
    for (const [category, data] of Object.entries(this.resultsData)) {
      if (data.status === 'success') {
        html += `
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color);">
            <div style="font-weight: 500; margin-bottom: 8px; font-size: 14px;">${category}</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">R² Score: <span style="color: var(--text-primary); float: right;">${data.metrics.r2}</span></div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">MAE: <span style="color: var(--text-primary); float: right;">${data.metrics.mae}</span></div>
            <div style="font-size: 12px; color: var(--text-secondary);">RMSE: <span style="color: var(--text-primary); float: right;">${data.metrics.rmse}</span></div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 8px; opacity: 0.7;">Samples: ${data.samples}</div>
          </div>
        `;
      } else {
        html += `
          <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 4px; border: 1px dashed var(--border-color); opacity: 0.7;">
            <div style="font-weight: 500; margin-bottom: 8px; font-size: 14px;">${category}</div>
            <div style="font-size: 12px; color: var(--error-color, #ef4444);">Skipped: ${data.reason}</div>
          </div>
        `;
      }
    }
    
    metricsList.innerHTML = html;
    
    const btn = document.getElementById('btn-apply-models');
    if (btn) {
      btn.textContent = 'Update Models (Apply)';
      btn.disabled = false;
    }
    
    resultsContainer.style.display = 'block';
  }
}
