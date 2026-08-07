import { getDOM } from '../../utils/dom-references.js';
import { calculateAIWeights } from '../../services/ai-weight-service.js';
import { TrainingPanel } from '../training/training-panel.js';

export class MlResultsPanel {
  static mlWeights = {};
  static cweWeights = {};
  static globalTqiPenalty = 0;

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

  static calculateTqi(models, predictions) {
    let tqiSum = 0;
    let sumSquaredWeights = 0;
    let validCount = 0;
    let mathString = "TQI = [ ";
    
    for (const m of models) {
      if (!predictions[m].error && typeof predictions[m].score === 'number') {
        const mScore = MlResultsPanel.getModelScore(m, predictions);
        const w = MlResultsPanel.mlWeights[m] !== undefined ? MlResultsPanel.mlWeights[m] : 1.0;
        
        // Exponential decay: Score drops from 100 to 0 exponentially as penalty increases.
        // Divided by 8 to gently scale massive enterprise projects (like Ghost CMS).
        const charScore = 100 * Math.exp(-mScore / 8);
        
        // Squared weight for massive impact
        const wSquared = w * w;
        
        tqiSum += charScore * wSquared;
        sumSquaredWeights += wSquared;
        validCount++;
        
        mathString += `${m}(${charScore.toFixed(2)} * ${wSquared.toFixed(2)}) + `;
      }
    }
    
    let finalTqi = "0.0000";
    if (validCount > 0) {
      mathString = mathString.slice(0, -3); // remove last " + "
      const divisor = sumSquaredWeights > 0 ? sumSquaredWeights : 1;
      mathString += ` ] / ${divisor.toFixed(2)}`;
      
      if (MlResultsPanel.globalTqiPenalty > 0) {
        mathString += ` - ${MlResultsPanel.globalTqiPenalty.toFixed(4)} (Penalties)`;
      }
      
      let tqiRaw = (tqiSum / divisor);
      tqiRaw = Math.max(0, tqiRaw - MlResultsPanel.globalTqiPenalty);
      finalTqi = tqiRaw.toFixed(4);
    } else {
      mathString = "No models available for calculation.";
    }
    
    return { finalTqi, mathString };
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
    for (const modelName of models) {
      if (MlResultsPanel.mlWeights[modelName] === undefined) {
         MlResultsPanel.mlWeights[modelName] = 1.0;
      }
    }
    const { finalTqi: tqiScore, mathString } = MlResultsPanel.calculateTqi(models, predictions);

    let html = `
      <div class="ml-results-container">
        <div class="ml-header">
          <svg class="ml-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2>ML INTEGRATION</h2>
          <button id="train-model-btn" class="adjust-weights-btn" style="margin-right: 10px; background-color: #2563eb;">Train Model</button>
          <button id="save-snapshot-btn" class="adjust-weights-btn" style="margin-right: 10px; background-color: #10b981;">Save Snapshot</button>
          <button id="ai-panel-btn" class="adjust-weights-btn" style="margin-right: 10px; background-color: #8b5cf6;">AI Weights</button>
          <button id="adjust-weights-btn" class="adjust-weights-btn" style="margin-left: 0;">Manual Weights</button>
        </div>
        
        <!-- AI Control Panel -->
        <div id="ai-panel" class="weights-panel hidden" style="border-color: #c4b5fd; background-color: #f5f3ff;">
          <h3 style="color: #6d28d9; border-bottom-color: #ddd6fe;">Generate Weights with AI</h3>
          <p style="font-size: 13px; color: #5b21b6; margin-bottom: 12px;">Ensure VITE_GROQ_API_KEY is set in your .env file.</p>
          <textarea id="ai-project-desc" placeholder="Describe the project (e.g. Government Tax Administration System)" style="width: 100%; min-height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #c4b5fd; margin-bottom: 12px; font-family: inherit; font-size: 14px; resize: vertical;"></textarea>
          <div style="display: flex; justify-content: flex-end; align-items: center; gap: 15px;">
             <span id="ai-status" style="font-size: 13px; color: #d97706; font-weight: 500;"></span>
             <button id="ai-generate-btn" class="adjust-weights-btn" style="background-color: #7c3aed;">Generate with Groq</button>
          </div>
          <div id="ai-reasoning" class="hidden" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd6fe; font-size: 13px; color: #4c1d95; max-height: 300px; overflow-y: auto; white-space: pre-wrap;"></div>
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
                  <input type="range" id="weight-${safeM}" data-model="${m}" min="0" max="4" step="0.1" value="${MlResultsPanel.mlWeights[m]}">
                  <span id="weight-val-${safeM}">${MlResultsPanel.mlWeights[m].toFixed(1)}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between;">
             <label for="global-penalty-input" style="color: #dc2626; font-weight:bold; font-size: 14px;">Global TQI Penalty</label>
             <input type="number" id="global-penalty-input" min="0" step="0.1" value="${MlResultsPanel.globalTqiPenalty.toFixed(4)}" style="width: 80px; padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: right;">
          </div>
        </div>
        
        <div class="ml-tqi-tree">
          <!-- TQI Root Node -->
          <div class="ml-output-node tqi-node">
            <div class="ml-score">${tqiScore}</div>
            <div class="ml-model-name">TQI (0-100 Scale)</div>
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

          <div id="tqi-math-breakdown" style="margin-top: 30px; font-family: monospace; font-size: 13px; color: #475569; background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #cbd5e1; max-width: 800px; text-align: center; line-height: 1.5; word-wrap: break-word;">
            <!-- Math string injected here -->
          </div>

        </div>
        
        <div class="ml-scanner-footer">
          <div class="ml-scanner-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-search"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>Scanner</span>
          </div>
        </div>
      </div>
      
      <!-- Save Snapshot Modal -->
      <div id="vc-save-modal" class="vc-modal-overlay hidden">
        <div class="vc-modal-content">
          <div class="vc-modal-header">
            <h3 class="vc-modal-title">Save Analysis Snapshot</h3>
            <button id="vc-save-close" class="vc-btn-close">&times;</button>
          </div>
          <div class="vc-form-group">
            <label>Project Name</label>
            <input type="text" id="vc-project-name" list="vc-project-list" placeholder="e.g., WebGoat">
            <datalist id="vc-project-list"></datalist>
          </div>
          <div class="vc-form-group">
            <label>Version / Snapshot Name</label>
            <input type="text" id="vc-version-name" placeholder="e.g., v1.0 Pre-Patch">
          </div>
          <div class="vc-modal-actions">
            <button id="vc-save-cancel" class="vc-btn-secondary">Cancel</button>
            <button id="vc-save-confirm" class="vc-btn-primary">Save Snapshot</button>
          </div>
        </div>
      </div>

    `;

    mlResultsPanel.innerHTML = html;

    TrainingPanel.wireEntryButton();

    // Inject initial math calculation
    const mathBreakdownNode = mlResultsPanel.querySelector('#tqi-math-breakdown');
    if (mathBreakdownNode) {
      mathBreakdownNode.innerHTML = `<b>Calculation:</b> ${mathString} = <b style="color: #28a745;">${tqiScore}</b>`;
    }
    
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

    // Weights panels toggle
    const adjustBtn = mlResultsPanel.querySelector('#adjust-weights-btn');
    const aiBtn = mlResultsPanel.querySelector('#ai-panel-btn');
    const weightsPanel = mlResultsPanel.querySelector('#weights-panel');
    const aiPanel = mlResultsPanel.querySelector('#ai-panel');
    
    if (adjustBtn && weightsPanel) {
      adjustBtn.addEventListener('click', () => {
        weightsPanel.classList.toggle('hidden');
        if (aiPanel) aiPanel.classList.add('hidden');
      });
    }
    
    if (aiBtn && aiPanel) {
      aiBtn.addEventListener('click', () => {
        aiPanel.classList.toggle('hidden');
        if (weightsPanel) weightsPanel.classList.add('hidden');
      });
    }

    // AI Generation
    const aiGenerateBtn = mlResultsPanel.querySelector('#ai-generate-btn');
    if (aiGenerateBtn) {
      aiGenerateBtn.addEventListener('click', async () => {
        const descInput = mlResultsPanel.querySelector('#ai-project-desc');
        const statusEl = mlResultsPanel.querySelector('#ai-status');
        const reasoningEl = mlResultsPanel.querySelector('#ai-reasoning');
        
        const description = descInput.value.trim();
        if (!description) {
          statusEl.textContent = "Please enter a project description.";
          return;
        }

        try {
          aiGenerateBtn.disabled = true;
          statusEl.textContent = "Analyzing project via Groq API...";
          statusEl.style.color = "#d97706";
          
          // Collect found CWEs
          const foundCwes = [];
          for (const m of models) {
             if (predictions[m].inputs) {
               for (const i of predictions[m].inputs) {
                 if (i.value > 0 && !foundCwes.includes(i.cwe)) {
                   foundCwes.push(i.cwe);
                 }
               }
             }
          }

          const aiResult = await calculateAIWeights(description, foundCwes, models);
          
          // Apply results to ML model weights
          if (aiResult.characteristics && Array.isArray(aiResult.characteristics)) {
            // Sort by global rank so the UI prints them in order
            aiResult.characteristics.sort((a, b) => a.global_rank - b.global_rank);
            
            let logHtml = `<b>Categorized Domain:</b> ${aiResult.domain}\n\n`;
            for (const char of aiResult.characteristics) {
              const mName = char.name; // e.g. "Security"
              if (MlResultsPanel.mlWeights[mName] !== undefined) {
                MlResultsPanel.mlWeights[mName] = char.weight;
                
                // Update manual sliders to match AI output
                const safeId = mName.replace(/[^a-zA-Z0-9_-]/g, '-');
                const slider = mlResultsPanel.querySelector('#weight-' + safeId);
                const valSpan = mlResultsPanel.querySelector('#weight-val-' + safeId);
                if (slider) slider.value = char.weight;
                if (valSpan) valSpan.textContent = char.weight.toFixed(1);
              }
              
              logHtml += `<b>${char.global_rank}. ${char.name} (${char.priority}) - Weight: ${char.weight}</b>\n`;
              char.reasons.forEach((r) => {
                logHtml += `  - [Global Rank ${r.global_rank}] ${r.reason} (Authority: ${r.authority})\n`;
                if (r.affected_cwes.length) logHtml += `     Affected: ${r.affected_cwes.join(', ')}\n`;
              });
              logHtml += '\n';
            }
            
            // Apply CWE penalties
            if (aiResult.cwePenalties && aiResult.cwePenalties.length > 0) {
               let totalPenalty = 0;
               logHtml += `<b>CWE Penalties Applied (Direct TQI Deductions):</b>\n`;
               for (const pObj of aiResult.cwePenalties) {
                  logHtml += `  ${pObj.cweId}: -${pObj.penalty}\n`;
                  totalPenalty += pObj.penalty;
               }
               MlResultsPanel.globalTqiPenalty = totalPenalty;
            } else {
               MlResultsPanel.globalTqiPenalty = 0;
            }

            reasoningEl.innerHTML = logHtml;
            reasoningEl.classList.remove('hidden');
            
            // Recalculate and update all individual model scores and the global TQI
            for (const m of models) {
              if (!predictions[m].error && typeof predictions[m].score === 'number') {
                const newModelScore = MlResultsPanel.getModelScore(m, predictions);
                const safeModelId = m.replace(/[^a-zA-Z0-9_-]/g, '-');
                const modelNode = mlResultsPanel.querySelector(`[data-model-id="edges-${safeModelId}"] .ml-score`);
                if (modelNode) {
                  modelNode.textContent = newModelScore.toFixed(4);
                }
              }
            }
            
            const { finalTqi, mathString } = MlResultsPanel.calculateTqi(models, predictions);
            const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
            if (tqiScoreNode) tqiScoreNode.textContent = finalTqi;
            
            const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
            if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Exp. Calculation:</b> ${mathString} = <b style="color: #28a745;">${finalTqi}</b>`;

            statusEl.textContent = "AI Analysis Complete!";
            statusEl.style.color = "#16a34a"; // green
          }
          
        } catch (error) {
          console.error(error);
          statusEl.textContent = "Error: " + error.message;
          statusEl.style.color = "#dc2626"; // red
        } finally {
          aiGenerateBtn.disabled = false;
        }
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
        const { finalTqi, mathString } = MlResultsPanel.calculateTqi(models, predictions);
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = finalTqi;
        
        const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
        if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Exp. Calculation:</b> ${mathString} = <b style="color: #28a745;">${finalTqi}</b>`;
      });
    });

    // Global Penalty Manual Input
    const globalPenaltyInput = mlResultsPanel.querySelector('#global-penalty-input');
    if (globalPenaltyInput) {
      globalPenaltyInput.addEventListener('input', (e) => {
        MlResultsPanel.globalTqiPenalty = parseFloat(e.target.value) || 0;
        const { finalTqi, mathString } = MlResultsPanel.calculateTqi(models, predictions);
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = finalTqi;
        const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
        if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Exp. Calculation:</b> ${mathString} = <b style="color: #28a745;">${finalTqi}</b>`;
      });
    }

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
        const { finalTqi, mathString } = MlResultsPanel.calculateTqi(models, predictions);
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = finalTqi;
        
        const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
        if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Exp. Calculation:</b> ${mathString} = <b style="color: #28a745;">${finalTqi}</b>`;
      });
    });

    // --- VERSION CONTROL LOGIC ---
    const btnSaveModal = mlResultsPanel.querySelector('#save-snapshot-btn');
    const modalSave = mlResultsPanel.querySelector('#vc-save-modal');
    const btnCloseSave = mlResultsPanel.querySelector('#vc-save-close');
    const btnCancelSave = mlResultsPanel.querySelector('#vc-save-cancel');
    const btnConfirmSave = mlResultsPanel.querySelector('#vc-save-confirm');
    const inputProjectName = mlResultsPanel.querySelector('#vc-project-name');
    const inputVersionName = mlResultsPanel.querySelector('#vc-version-name');

    const datalist = mlResultsPanel.querySelector('#vc-project-list');
    if (btnSaveModal) {
      btnSaveModal.addEventListener('click', () => {
        let history = JSON.parse(localStorage.getItem('cwe-history') || '{"projects":{}}');
        datalist.innerHTML = Object.keys(history.projects).map(p => `<option value="${p}">`).join('');
        modalSave.classList.remove('hidden');
        setTimeout(() => inputProjectName.focus(), 50);
      });
    }
    const hideSaveModal = () => { modalSave.classList.add('hidden'); inputProjectName.value = ''; inputVersionName.value = ''; };
    if (btnCloseSave) btnCloseSave.addEventListener('click', hideSaveModal);
    if (btnCancelSave) btnCancelSave.addEventListener('click', hideSaveModal);

    if (btnConfirmSave) {
      btnConfirmSave.addEventListener('click', () => {
        const pName = inputProjectName.value.trim();
        const vName = inputVersionName.value.trim();
        if (!pName || !vName) { alert("Please enter both Project and Version names."); return; }

        let history = JSON.parse(localStorage.getItem('cwe-history') || '{"projects":{}}');
        if (!history.projects[pName]) history.projects[pName] = { snapshots: [] };
        
        const currentTqiNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        const cTqi = currentTqiNode ? currentTqiNode.textContent : "0.0000";
        
        const allCwes = new Set();
        document.querySelectorAll('.vuln-id').forEach(node => {
          const cweStr = node.textContent.trim();
          if (cweStr.startsWith('CWE-')) {
             allCwes.add(cweStr);
          }
        });

        const modelScores = {};
        for (const m of models) {
          if (!predictions[m].error && typeof predictions[m].score === 'number') {
            modelScores[m] = MlResultsPanel.getModelScore(m, predictions);
          }
        }

        const snapshot = {
          id: Date.now().toString(),
          versionName: vName,
          timestamp: Date.now(),
          tqiScore: cTqi,
          cwes: Array.from(allCwes),
          mlWeights: JSON.parse(JSON.stringify(MlResultsPanel.mlWeights)),
          cweWeights: JSON.parse(JSON.stringify(MlResultsPanel.cweWeights)),
          modelScores: modelScores,
          globalTqiPenalty: MlResultsPanel.globalTqiPenalty
        };

        history.projects[pName].snapshots.push(snapshot);
        localStorage.setItem('cwe-history', JSON.stringify(history));
        
        alert(`Snapshot '${vName}' saved successfully for project '${pName}'!`);
        hideSaveModal();
      });
    }

  }
}

