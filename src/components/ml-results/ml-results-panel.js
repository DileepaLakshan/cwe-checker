import { getDOM } from '../../utils/dom-references.js';

export class MlResultsPanel {
  static mlWeights = {};
  static cweWeights = {};

  static getModelScore(modelName, predictions) {
    const modelData = predictions[modelName];
    if (modelData.error) return 0;
    
    if (!MlResultsPanel.cweWeights[modelName]) {
      MlResultsPanel.cweWeights[modelName] = {};
      const inputs = modelData.inputs || [];
      for (const i of inputs) {
        if (i.value !== 0 && i.weight !== 0) {
          MlResultsPanel.cweWeights[modelName][i.cwe] = i.weight;
        }
      }
    }
    
    let sum = 0;
    const inputs = modelData.inputs || [];
    for (const i of inputs) {
      if (i.value !== 0 && MlResultsPanel.cweWeights[modelName][i.cwe] !== undefined) {
        sum += i.value * MlResultsPanel.cweWeights[modelName][i.cwe];
      }
    }
    return sum;
  }

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
        if (MlResultsPanel.mlWeights[modelName] === undefined) {
          MlResultsPanel.mlWeights[modelName] = 1.0;
        }
        const dynamicScore = MlResultsPanel.getModelScore(modelName, predictions);
        sumScore += dynamicScore * MlResultsPanel.mlWeights[modelName];
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
          <button id="adjust-weights-btn" class="adjust-weights-btn">Adjust Weights</button>
        </div>
        
        <!-- Weights Control Panel (hidden by default) -->
        <div id="weights-panel" class="weights-panel hidden">
          <h3>Adjust ML Model Weights</h3>
          <div class="weights-grid">
            ${models.map(m => {
              if (predictions[m].error || typeof predictions[m].score !== 'number') return '';
              const safeM = m.replace(/[^a-zA-Z0-9_-]/g, '-');
              return `
                <div class="weight-control-row">
                  <label for="weight-${safeM}">${m}</label>
                  <input type="range" id="weight-${safeM}" data-model="${m}" min="0" max="2" step="0.1" value="${MlResultsPanel.mlWeights[m]}">
                  <span id="weight-val-${safeM}">${MlResultsPanel.mlWeights[m].toFixed(1)}</span>
                </div>
              `;
            }).join('')}
          </div>
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

      const score = typeof modelData.score === 'number' ? MlResultsPanel.getModelScore(modelName, predictions).toFixed(4) : modelData.score;
      const inputs = modelData.inputs || [];
      
      const validInputs = inputs.filter(i => i.value !== 0);
      if (validInputs.length > 0) {
        const equationString = validInputs.map(i => `${i.cwe}(${i.value.toFixed(4)} * ${i.weight.toFixed(4)})`).join(' + ');
        console.log(`${modelName} ml output = ${equationString}`);
      }
      
      // Keep only inputs with a weight strictly greater than 0 and a non-zero value
      let topInputs = inputs
          .filter(i => i.value !== 0 && MlResultsPanel.cweWeights[modelName][i.cwe] !== undefined);

      let edgesHtml = '';
      if (topInputs.length > 0) {
        edgesHtml = `
          <div class="ml-edges hidden" id="edges-${safeModelId}">
            <!-- Connecting lines handled by CSS pseudo-elements -->
            <div class="ml-weights-box">
              ${topInputs.map(i => `
                <div class="ml-cwe-weight-input-wrapper">
                  <input type="number" 
                         class="ml-cwe-weight-input" 
                         data-model="${modelName}" 
                         data-cwe="${i.cwe}" 
                         step="0.0001" 
                         value="${MlResultsPanel.cweWeights[modelName][i.cwe].toFixed(4)}">
                </div>
              `).join('')}
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

    // Weights panel toggle
    const adjustBtn = mlResultsPanel.querySelector('#adjust-weights-btn');
    const weightsPanel = mlResultsPanel.querySelector('#weights-panel');
    if (adjustBtn && weightsPanel) {
      adjustBtn.addEventListener('click', () => {
        weightsPanel.classList.toggle('hidden');
      });
    }

    // Weight sliders
    const weightInputs = mlResultsPanel.querySelectorAll('.weight-control-row input[type="range"]');
    weightInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const modelName = e.target.getAttribute('data-model');
        const newVal = parseFloat(e.target.value);
        MlResultsPanel.mlWeights[modelName] = newVal;
        
        // Update label
        const safeId = modelName.replace(/[^a-zA-Z0-9_-]/g, '-');
        const valSpan = mlResultsPanel.querySelector('#weight-val-' + safeId);
        if (valSpan) valSpan.textContent = newVal.toFixed(1);
        
        // Recalculate TQI
        let newSum = 0;
        let validCount = 0;
        for (const m of models) {
          if (!predictions[m].error && typeof predictions[m].score === 'number') {
            const mScore = MlResultsPanel.getModelScore(m, predictions);
            newSum += mScore * MlResultsPanel.mlWeights[m];
            validCount++;
          }
        }
        const newTqi = validCount > 0 ? (newSum / validCount).toFixed(4) : "0.0000";
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = newTqi;
      });
    });

    // CWE Weight inputs
    const cweWeightInputs = mlResultsPanel.querySelectorAll('.ml-cwe-weight-input');
    cweWeightInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const modelName = e.target.getAttribute('data-model');
        const cweName = e.target.getAttribute('data-cwe');
        const newVal = parseFloat(e.target.value) || 0;
        
        MlResultsPanel.cweWeights[modelName][cweName] = newVal;
        
        // Recalculate Model Score
        const newModelScore = MlResultsPanel.getModelScore(modelName, predictions);
        
        // Update Model Score Node
        const safeModelId = modelName.replace(/[^a-zA-Z0-9_-]/g, '-');
        const modelNode = mlResultsPanel.querySelector(`[data-model-id="edges-${safeModelId}"] .ml-score`);
        if (modelNode) {
          modelNode.textContent = newModelScore.toFixed(4);
        }
        
        // Recalculate TQI
        let newTqiSum = 0;
        let validCount = 0;
        for (const m of models) {
          if (!predictions[m].error && typeof predictions[m].score === 'number') {
            const mScore = MlResultsPanel.getModelScore(m, predictions);
            newTqiSum += mScore * MlResultsPanel.mlWeights[m];
            validCount++;
          }
        }
        const newTqi = validCount > 0 ? (newTqiSum / validCount).toFixed(4) : "0.0000";
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = newTqi;
      });
    });

  }
}
