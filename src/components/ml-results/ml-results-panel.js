import { getDOM } from '../../utils/dom-references.js';

export class MlResultsPanel {
  static render(mlData) {
    const { mlResultsPanel } = getDOM();
    if (!mlResultsPanel) return;

    if (!mlData || !mlData.predictions) {
      mlResultsPanel.innerHTML = '<div class="ml-no-data">No ML data available.</div>';
      return;
    }

    const predictions = mlData.predictions;
    
    // Sort models by name
    const models = Object.keys(predictions).sort();
    
    let html = `
      <div class="ml-results-container">
        <div class="ml-header">
          <svg class="ml-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2>ML INTEGRATION</h2>
        </div>
        <div class="ml-tree-container">
    `;

    for (const modelName of models) {
      const modelData = predictions[modelName];
      if (modelData.error) {
        html += `
          <div class="ml-model-tree">
            <div class="ml-output-node error">
              <div class="ml-score">Error</div>
              <div class="ml-model-name">${modelName}</div>
            </div>
          </div>
        `;
        continue;
      }

      const score = typeof modelData.score === 'number' ? modelData.score.toFixed(2) : modelData.score;
      const inputs = modelData.inputs || [];
      
      // Filter out 0-weight and 0-value inputs to match diagram style (keep up to 4 for visual fit)
      let topInputs = inputs
          .filter(i => i.weight > 0 || i.value > 0)
          .slice(0, 4);

      if (topInputs.length === 0) {
        topInputs = inputs.slice(0, 3);
      }

      html += `
        <div class="ml-model-tree">
          <!-- Top Node (Output) -->
          <div class="ml-output-node">
            <div class="ml-score">${score}</div>
            <div class="ml-model-name">${modelName}</div>
          </div>
          
          <div class="ml-edges">
            <!-- Connecting lines handled by CSS pseudo-elements -->
            <div class="ml-weights-box">
              ${topInputs.map(i => `<span class="ml-weight">${i.weight.toFixed(2)}</span>`).join('')}
            </div>
            
            <div class="ml-inputs-row">
              ${topInputs.map(i => `
                <div class="ml-input-node-wrapper">
                  <div class="ml-input-node">
                    <div class="ml-input-value">${i.value.toFixed(2)}</div>
                  </div>
                  <div class="ml-input-label">${i.cwe}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    html += `
        </div>
        
        <div class="ml-scanner-footer">
          <div class="ml-scanner-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Scanner</span>
          </div>
        </div>
      </div>
    `;

    mlResultsPanel.innerHTML = html;
  }
}
