import { getDOM } from '../../utils/dom-references.js';
import { calculateAIWeights } from '../../services/ai-weight-service.js';

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
    let mathString = "TQI = [ ";
    
    for (const modelName of models) {
      const modelData = predictions[modelName];
      if (!modelData.error && typeof modelData.score === 'number') {
        if (MlResultsPanel.mlWeights[modelName] === undefined) {
          MlResultsPanel.mlWeights[modelName] = 1.0;
        }
        const dynamicScore = MlResultsPanel.getModelScore(modelName, predictions);
        const weight = MlResultsPanel.mlWeights[modelName];
        sumScore += (10 - dynamicScore) * weight;
        mathString += `(10 - ${dynamicScore.toFixed(4)}) * ${weight.toFixed(1)} + `;
        validModelCount++;
      }
    }
    
    if (validModelCount > 0) {
      mathString = mathString.slice(0, -3); // remove last " + "
      mathString += ` ] / ${validModelCount}`;
      if (MlResultsPanel.globalTqiPenalty > 0) {
        mathString += ` - ${MlResultsPanel.globalTqiPenalty.toFixed(4)} (Penalties)`;
      }
    } else {
      mathString = "No models available for calculation.";
    }
    
    let tqiRaw = validModelCount > 0 ? (sumScore / validModelCount) : 0;
    tqiRaw = Math.max(0, tqiRaw - MlResultsPanel.globalTqiPenalty);
    const tqiScore = tqiRaw.toFixed(4);

    let html = `
      <div class="ml-results-container">
        <div class="ml-header">
          <svg class="ml-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h2>ML INTEGRATION</h2>
          <button id="history-compare-btn" class="adjust-weights-btn" style="margin-left: auto; margin-right: 10px; background-color: #3b82f6;">History & Compare</button>
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

          <div id="tqi-math-breakdown" style="margin-top: 30px; font-family: monospace; font-size: 13px; color: #475569; background: #f8fafc; padding: 10px 15px; border-radius: 6px; border: 1px solid #cbd5e1; max-width: 800px; text-align: center; line-height: 1.5;">
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

      <!-- History & Compare Modal -->
      <div id="vc-history-modal" class="vc-modal-overlay hidden">
        <div class="vc-modal-content" style="max-width: 1000px; padding: 0;">
          <div class="vc-modal-header" style="padding: 24px 24px 12px 24px; margin-bottom: 0;">
            <h3 class="vc-modal-title">Version Control & History</h3>
            <button id="vc-history-close" class="vc-btn-close" style="margin-top: -10px;">&times;</button>
          </div>
          
          <div class="vc-history-layout">
            <div class="vc-sidebar">
               <h4 style="margin: 15px 0 10px 15px; color: #64748b; font-size: 13px; text-transform: uppercase;">Projects</h4>
               <div id="vc-project-sidebar-list" style="padding: 0 10px;"></div>
            </div>
            
            <div class="vc-main-content">
               <div id="vc-main-empty" style="padding: 40px; text-align: center; color: #64748b;">
                  <p>Select a project from the sidebar to view its history and TQI trends.</p>
               </div>
               
               <div id="vc-main-view" class="hidden" style="padding-right: 20px; padding-top: 15px;">
                  <h3 id="vc-view-title" style="margin-top: 0;"></h3>
                  
                  <!-- SVG Graph Container -->
                  <div class="vc-svg-container">
                    <svg id="vc-tqi-graph" width="100%" height="100%"></svg>
                    <div id="vc-svg-tooltip" class="vc-svg-tooltip"></div>
                  </div>
                  
                  <h4 style="margin-top: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Version History</h4>
                  <div id="vc-version-diffs"></div>
               </div>
            </div>
          </div>
        </div>
      </div>
      
    `;

    mlResultsPanel.innerHTML = html;
    
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
            let newTqiSum = 0;
            let validCount = 0;
            let newMathString = "TQI = [ ";
            
            for (const m of models) {
              if (!predictions[m].error && typeof predictions[m].score === 'number') {
                const newModelScore = MlResultsPanel.getModelScore(m, predictions);
                const w = MlResultsPanel.mlWeights[m];
                
                // Update Model Score Node
                const safeModelId = m.replace(/[^a-zA-Z0-9_-]/g, '-');
                const modelNode = mlResultsPanel.querySelector(`[data-model-id="edges-${safeModelId}"] .ml-score`);
                if (modelNode) {
                  modelNode.textContent = newModelScore.toFixed(4);
                }

                newTqiSum += (10 - newModelScore) * w;
                newMathString += `(10 - ${newModelScore.toFixed(4)}) * ${w.toFixed(1)} + `;
                validCount++;
              }
            }
            
            if (validCount > 0) {
              newMathString = newMathString.slice(0, -3);
              newMathString += ` ] / ${validCount}`;
              if (MlResultsPanel.globalTqiPenalty > 0) {
                newMathString += ` - ${MlResultsPanel.globalTqiPenalty.toFixed(4)} (Penalties)`;
              }
            }
            
            let newTqiRaw = validCount > 0 ? (newTqiSum / validCount) : 0;
            newTqiRaw = Math.max(0, newTqiRaw - MlResultsPanel.globalTqiPenalty);
            const newTqi = newTqiRaw.toFixed(4);
            const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
            if (tqiScoreNode) tqiScoreNode.textContent = newTqi;
            
            const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
            if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Calculation:</b> ${newMathString} = <b style="color: #28a745;">${newTqi}</b>`;

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
        let newSum = 0;
        let validCount = 0;
        let newMathString = "TQI = [ ";
        for (const m of models) {
          if (!predictions[m].error && typeof predictions[m].score === 'number') {
            const mScore = MlResultsPanel.getModelScore(m, predictions);
            const w = MlResultsPanel.mlWeights[m];
            newSum += (10 - mScore) * w;
            newMathString += `(10 - ${mScore.toFixed(4)}) * ${w.toFixed(1)} + `;
            validCount++;
          }
        }
        
        if (validCount > 0) {
          newMathString = newMathString.slice(0, -3);
          newMathString += ` ] / ${validCount}`;
          if (MlResultsPanel.globalTqiPenalty > 0) {
            newMathString += ` - ${MlResultsPanel.globalTqiPenalty.toFixed(4)} (Penalties)`;
          }
        }
        
        let newTqiRaw = validCount > 0 ? (newSum / validCount) : 0;
        newTqiRaw = Math.max(0, newTqiRaw - MlResultsPanel.globalTqiPenalty);
        const newTqi = newTqiRaw.toFixed(4);
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = newTqi;
        
        const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
        if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Calculation:</b> ${newMathString} = <b style="color: #28a745;">${newTqi}</b>`;
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
        let newMathString = "TQI = [ ";
        for (const m of models) {
          if (!predictions[m].error && typeof predictions[m].score === 'number') {
            const mScore = MlResultsPanel.getModelScore(m, predictions);
            const w = MlResultsPanel.mlWeights[m];
            newTqiSum += (10 - mScore) * w;
            newMathString += `(10 - ${mScore.toFixed(4)}) * ${w.toFixed(1)} + `;
            validCount++;
          }
        }
        
        if (validCount > 0) {
          newMathString = newMathString.slice(0, -3);
          newMathString += ` ] / ${validCount}`;
          if (MlResultsPanel.globalTqiPenalty > 0) {
            newMathString += ` - ${MlResultsPanel.globalTqiPenalty.toFixed(4)} (Penalties)`;
          }
        }
        
        let newTqiRaw = validCount > 0 ? (newTqiSum / validCount) : 0;
        newTqiRaw = Math.max(0, newTqiRaw - MlResultsPanel.globalTqiPenalty);
        const newTqi = newTqiRaw.toFixed(4);
        const tqiScoreNode = mlResultsPanel.querySelector('.tqi-node .ml-score');
        if (tqiScoreNode) tqiScoreNode.textContent = newTqi;
        
        const tqiBreakdown = mlResultsPanel.querySelector('#tqi-math-breakdown');
        if (tqiBreakdown) tqiBreakdown.innerHTML = `<b>Calculation:</b> ${newMathString} = <b style="color: #28a745;">${newTqi}</b>`;
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
        Object.values(MlResultsPanel.cweWeights).forEach(cweMap => {
          Object.keys(cweMap).forEach(cwe => allCwes.add(cwe));
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

    // History & Compare logic
    const btnHistory = mlResultsPanel.querySelector('#history-compare-btn');
    const modalHistory = mlResultsPanel.querySelector('#vc-history-modal');
    const btnCloseHistory = mlResultsPanel.querySelector('#vc-history-close');
    const sidebarList = mlResultsPanel.querySelector('#vc-project-sidebar-list');
    const mainEmpty = mlResultsPanel.querySelector('#vc-main-empty');
    const mainView = mlResultsPanel.querySelector('#vc-main-view');
    const viewTitle = mlResultsPanel.querySelector('#vc-view-title');
    const svgGraph = mlResultsPanel.querySelector('#vc-tqi-graph');
    const svgTooltip = mlResultsPanel.querySelector('#vc-svg-tooltip');
    const versionDiffs = mlResultsPanel.querySelector('#vc-version-diffs');

    // Global function to restore weights from a button click
    window.restoreVcWeights = function(snapId, pName) {
      const history = JSON.parse(localStorage.getItem('cwe-history') || '{"projects":{}}');
      const snap = history.projects[pName].snapshots.find(s => s.id === snapId);
      if (!snap) return;

      if (snap.mlWeights) MlResultsPanel.mlWeights = snap.mlWeights;
      if (snap.cweWeights) MlResultsPanel.cweWeights = snap.cweWeights;
      if (snap.globalTqiPenalty !== undefined) MlResultsPanel.globalTqiPenalty = snap.globalTqiPenalty;

      // Update UI sliders and text
      Object.keys(MlResultsPanel.mlWeights).forEach(mName => {
        const safeId = mName.replace(/[^a-zA-Z0-9_-]/g, '-');
        const slider = mlResultsPanel.querySelector('#weight-' + safeId);
        const valSpan = mlResultsPanel.querySelector('#weight-val-' + safeId);
        if (slider) slider.value = MlResultsPanel.mlWeights[mName];
        if (valSpan) valSpan.textContent = MlResultsPanel.mlWeights[mName].toFixed(1);
      });
      Object.keys(MlResultsPanel.cweWeights).forEach(mName => {
         Object.keys(MlResultsPanel.cweWeights[mName]).forEach(cwe => {
             const input = mlResultsPanel.querySelector(`.ml-cwe-weight-input[data-model="${mName}"][data-cwe="${cwe}"]`);
             if (input) input.value = MlResultsPanel.cweWeights[mName][cwe].toFixed(4);
         });
      });

      // Trigger a recalculation by faking an input event on the first slider
      const firstSlider = mlResultsPanel.querySelector('.weight-control-row input[type="range"]');
      if (firstSlider) firstSlider.dispatchEvent(new Event('input'));

      alert("AI Weights and Penalties successfully restored!");
      modalHistory.classList.add('hidden');
    };

    const drawGraph = (snapshots) => {
      const w = svgGraph.clientWidth || 700;
      const h = 250;
      const padding = 30;
      const usableW = w - (padding * 2);
      const usableH = h - (padding * 2);
      
      svgGraph.innerHTML = ''; // clear

      // Draw Y axis lines and labels (0 to 10)
      for(let i=0; i<=10; i+=2) {
        const y = padding + usableH - ((i / 10) * usableH);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", padding - 5); line.setAttribute("y1", y);
        line.setAttribute("x2", w); line.setAttribute("y2", y);
        line.setAttribute("stroke", "#e2e8f0"); line.setAttribute("stroke-dasharray", "4");
        
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", 5); text.setAttribute("y", y + 4);
        text.setAttribute("font-size", "10px"); text.setAttribute("fill", "#64748b");
        text.textContent = i;
        
        svgGraph.appendChild(line);
        svgGraph.appendChild(text);
      }

      if (snapshots.length === 0) return;

      const points = [];
      snapshots.forEach((snap, idx) => {
        const x = snapshots.length === 1 ? (w/2) : padding + (idx / (snapshots.length - 1)) * usableW;
        const tqi = parseFloat(snap.tqiScore) || 0;
        const y = padding + usableH - ((tqi / 10) * usableH);
        points.push({x, y, snap, tqi});
      });

      // Draw Line
      if (points.length > 1) {
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
        polyline.setAttribute("points", pointsStr);
        polyline.setAttribute("fill", "none");
        polyline.setAttribute("stroke", "#3b82f6");
        polyline.setAttribute("stroke-width", "3");
        svgGraph.appendChild(polyline);
      }

      // Draw Points
      points.forEach((p, idx) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y);
        circle.setAttribute("r", "6");
        circle.setAttribute("fill", "#fff");
        circle.setAttribute("stroke", "#3b82f6");
        circle.setAttribute("stroke-width", "2");
        circle.style.cursor = "pointer";
        
        circle.addEventListener("mouseenter", (e) => {
           svgTooltip.style.opacity = 1;
           svgTooltip.style.left = e.pageX + 'px';
           svgTooltip.style.top = e.pageY + 'px';
           svgTooltip.innerHTML = `<b>${p.snap.versionName}</b><br/>TQI: ${p.tqi.toFixed(4)}<br/>${new Date(p.snap.timestamp).toLocaleDateString()}`;
        });
        circle.addEventListener("mouseleave", () => { svgTooltip.style.opacity = 0; });
        
        svgGraph.appendChild(circle);
      });
    };

    const renderProjectHistory = (pName, snapshots) => {
      mainEmpty.classList.add('hidden');
      mainView.classList.remove('hidden');
      viewTitle.textContent = `${pName} - History`;

      // Sort chronological
      snapshots.sort((a, b) => a.timestamp - b.timestamp);

      // Draw graph
      setTimeout(() => drawGraph(snapshots), 10); // Wait for DOM to paint so clientWidth works

      // Build Version Diffs
      versionDiffs.innerHTML = '';
      if (snapshots.length === 0) return;
      
      // Base version
      const baseSnap = snapshots[0];
      versionDiffs.innerHTML += `
        <div class="vc-version-diff" style="border-left: 4px solid #94a3b8;">
          <div class="vc-diff-header">
            <div>
               <strong>${baseSnap.versionName}</strong> (Baseline)
               <div style="font-size:12px; color:#64748b; margin-top:4px;">${new Date(baseSnap.timestamp).toLocaleString()} | Initial TQI: ${baseSnap.tqiScore}</div>
            </div>
            <button class="vc-restore-btn" onclick="restoreVcWeights('${baseSnap.id}', '${pName}')">Restore Weights</button>
          </div>
        </div>
      `;

      for (let i = 1; i < snapshots.length; i++) {
        const snapA = snapshots[i-1];
        const snapB = snapshots[i];
        
        const setA = new Set(snapA.cwes);
        const setB = new Set(snapB.cwes);
        const fixedCwes = [...setA].filter(x => !setB.has(x));
        const newCwes = [...setB].filter(x => !setA.has(x));
        
        const tqiDelta = parseFloat(snapB.tqiScore) - parseFloat(snapA.tqiScore);
        const tqiColor = tqiDelta > 0 ? '#16a34a' : (tqiDelta < 0 ? '#dc2626' : '#64748b');
        const tqiSign = tqiDelta > 0 ? '+' : '';

        let mlDiffHtml = '';
        const allModels = new Set([...Object.keys(snapA.modelScores || {}), ...Object.keys(snapB.modelScores || {})]);
        allModels.forEach(m => {
           const sA = snapA.modelScores[m] || 0;
           const sB = snapB.modelScores[m] || 0;
           if (sA !== sB) {
             const diff = sB - sA;
             const diffClass = diff < 0 ? '#16a34a' : (diff > 0 ? '#dc2626' : '#64748b');
             const diffSign = diff > 0 ? '+' : '';
             mlDiffHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;">
               <span>${m}:</span> 
               <span>${sA.toFixed(2)} &rarr; ${sB.toFixed(2)} (<strong style="color:${diffClass}">${diffSign}${diff.toFixed(2)}</strong>)</span>
             </div>`;
           }
        });
        
        let mlSection = '';
        if (mlDiffHtml) {
           mlSection = `
             <div style="margin-top: 15px; font-size: 13px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
               <strong style="color: #475569; display:block; margin-bottom: 8px;">Model Score Changes (Lower = Better Quality)</strong>
               ${mlDiffHtml}
             </div>
           `;
        }

        let diffHtml = `
          <div class="vc-version-diff" style="border-left: 4px solid #3b82f6;">
            <div class="vc-diff-header">
              <div>
                 <strong>${snapB.versionName}</strong>
                 <div style="font-size:12px; color:#64748b; margin-top:4px;">${new Date(snapB.timestamp).toLocaleString()}</div>
                 <div style="margin-top: 6px; font-weight: 500;">
                   TQI: ${snapB.tqiScore} <span style="color: ${tqiColor}">(${tqiSign}${tqiDelta.toFixed(4)})</span>
                 </div>
              </div>
              <button class="vc-restore-btn" onclick="restoreVcWeights('${snapB.id}', '${pName}')">Restore Weights</button>
            </div>
            
            <div style="display:flex; gap: 15px; margin-top: 10px;">
              <div style="flex:1; background: #ecfdf5; padding: 10px; border-radius: 6px; font-size:13px;">
                <strong style="color: #065f46;">Fixed (${fixedCwes.length})</strong>
                <div style="color: #047857; margin-top:4px;">${fixedCwes.length ? fixedCwes.join(', ') : '-'}</div>
              </div>
              <div style="flex:1; background: #fef2f2; padding: 10px; border-radius: 6px; font-size:13px;">
                <strong style="color: #991b1b;">New (${newCwes.length})</strong>
                <div style="color: #b91c1c; margin-top:4px;">${newCwes.length ? newCwes.join(', ') : '-'}</div>
              </div>
            </div>
            ${mlSection}
          </div>
        `;
        versionDiffs.innerHTML += diffHtml;
      }
    };

    if (btnHistory) {
      btnHistory.addEventListener('click', () => {
        const history = JSON.parse(localStorage.getItem('cwe-history') || '{"projects":{}}');
        sidebarList.innerHTML = '';
        mainEmpty.classList.remove('hidden');
        mainView.classList.add('hidden');
        
        if (Object.keys(history.projects).length === 0) {
          sidebarList.innerHTML = '<p style="color:#64748b; font-size:13px;">No projects saved.</p>';
        } else {
          for (const [pName, pData] of Object.entries(history.projects)) {
            const item = document.createElement('div');
            item.className = 'vc-project-item';
            item.textContent = `${pName} (${pData.snapshots.length})`;
            item.addEventListener('click', () => {
              sidebarList.querySelectorAll('.vc-project-item').forEach(el => el.classList.remove('active'));
              item.classList.add('active');
              renderProjectHistory(pName, pData.snapshots);
            });
            sidebarList.appendChild(item);
          }
        }
        modalHistory.classList.remove('hidden');
      });
    }
    if (btnCloseHistory) btnCloseHistory.addEventListener('click', () => modalHistory.classList.add('hidden'));

  }
}

