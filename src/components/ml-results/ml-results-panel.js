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
    
    // Calculate TQI
    let sumScore = 0;
    let validModelCount = 0;
    
    for (const modelName of models) {
      const modelData = predictions[modelName];
      if (!modelData.error && typeof modelData.score === 'number') {
        sumScore += modelData.score;
        validModelCount++;
      }
    }
    
    const tqiScore = validModelCount > 0 ? (sumScore / validModelCount).toFixed(4) : "0.0000";

    let html = `
      <div class="ml-results-container">
        <div class="ml-header">
          <svg class="ml-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2>ML INTEGRATION</h2>
        </div>
        
        <div class="ml-tqi-tree">
          <!-- TQI Root Node -->
          <div class="ml-output-node tqi-node">
            <div class="ml-score">${tqiScore}</div>
            <div class="ml-model-name">TQI</div>
          </div>
          
          <div class="ml-tqi-edges">
            <div class="ml-models-row">
    `;

    for (const modelName of models) {
      const modelData = predictions[modelName];
      // Format modelName id to be safe for HTML ID attributes
      const safeModelId = modelName.replace(/[^a-zA-Z0-9_-]/g, '-');
      
      html += `<div class="ml-model-wrapper">`;
      
      if (modelData.error) {
        html += `
          <div class="ml-output-node error">
            <div class="ml-score">Error</div>
            <div class="ml-model-name">${modelName}</div>
          </div>
        </div>`;
        continue;
      }

      const score = typeof modelData.score === 'number' ? modelData.score.toFixed(4) : modelData.score;
      const inputs = modelData.inputs || [];
      
      const validInputs = inputs.filter(i => i.value !== 0);
      if (validInputs.length > 0) {
        const equationString = validInputs.map(i => `${i.cwe}(${i.value.toFixed(4)} * ${i.weight.toFixed(4)})`).join(' + ');
        console.log(`${modelName} ml output = ${equationString}`);
      }
      
      // Keep only inputs with a weight strictly greater than 0 and a non-zero value
      let topInputs = inputs
          .filter(i => i.weight > 0 && i.value !== 0);

      let edgesHtml = '';
      if (topInputs.length > 0) {
        edgesHtml = `
          <div class="ml-edges hidden" id="edges-${safeModelId}">
            <!-- Connecting lines handled by CSS pseudo-elements -->
            <div class="ml-weights-box">
              ${topInputs.map(i => `<span class="ml-weight">${i.weight.toFixed(4)}</span>`).join('')}
            </div>
            
            <div class="ml-inputs-row">
              ${topInputs.map(i => `
                <div class="ml-input-node-wrapper">
                  <div class="ml-input-node">
                    <div class="ml-input-value">${i.value.toFixed(4)}</div>
                  </div>
                  <div class="ml-input-label">${i.cwe}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      html += `
          <!-- ML Model Node -->
          <div class="ml-output-node ml-node-clickable" data-model-id="edges-${safeModelId}">
            <div class="ml-score">${score}</div>
            <div class="ml-model-name">${modelName}</div>
          </div>
          ${edgesHtml}
        </div>
      `;
    }

    html += `
            </div>
          </div>
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
    
    // Add interactivity
    const clickableNodes = mlResultsPanel.querySelectorAll('.ml-node-clickable');
    clickableNodes.forEach(node => {
      node.addEventListener('click', (e) => {
        const targetId = node.getAttribute('data-model-id');
        const edgesContainer = mlResultsPanel.querySelector('#' + targetId);
        if (edgesContainer) {
          edgesContainer.classList.toggle('hidden');
        }
      });
    });

  }
}
