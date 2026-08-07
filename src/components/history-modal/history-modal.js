import { MlResultsPanel } from '../ml-results/ml-results-panel.js';

export class HistoryModal {
  static init() {
    const btnHistory = document.getElementById('history-compare-btn');
    const modalHistory = document.getElementById('vc-history-modal');
    const btnCloseHistory = document.getElementById('vc-history-close');
    const sidebarList = document.getElementById('vc-project-sidebar-list');
    const mainEmpty = document.getElementById('vc-main-empty');
    const mainView = document.getElementById('vc-main-view');
    const viewTitle = document.getElementById('vc-view-title');
    const svgGraph = document.getElementById('vc-tqi-graph');
    const svgTooltip = document.getElementById('vc-svg-tooltip');
    const versionDiffs = document.getElementById('vc-version-diffs');

    if (!modalHistory) return; // Not injected in DOM yet

    // Global function to restore weights from a button click
    window.restoreVcWeights = function(snapId, pName) {
      const history = JSON.parse(localStorage.getItem('cwe-history') || '{"projects":{}}');
      const snap = history.projects[pName].snapshots.find(s => s.id === snapId);
      if (!snap) return;

      if (snap.mlWeights) MlResultsPanel.mlWeights = snap.mlWeights;
      if (snap.cweWeights) MlResultsPanel.cweWeights = snap.cweWeights;
      if (snap.globalTqiPenalty !== undefined) MlResultsPanel.globalTqiPenalty = snap.globalTqiPenalty;

      // Only update DOM if the ml-results panel is currently rendered
      const mlResultsPanel = document.getElementById('ml-results-component');
      if (mlResultsPanel && mlResultsPanel.innerHTML.trim() !== '') {
        // Update UI sliders and text
        Object.keys(MlResultsPanel.mlWeights).forEach(mName => {
          const safeId = mName.replace(/[^a-zA-Z0-9_-]/g, '-');
          const slider = mlResultsPanel.querySelector('#weight-' + safeId);
          const valSpan = mlResultsPanel.querySelector('#weight-val-' + safeId);
          if (slider) slider.value = MlResultsPanel.mlWeights[mName];
          if (valSpan) valSpan.textContent = MlResultsPanel.mlWeights[mName].toFixed(1);
        });
        Object.keys(MlResultsPanel.cweWeights).forEach(mName => {
           Object.keys(MlResultsPanel.cweWeights[mName] || {}).forEach(cwe => {
               const input = mlResultsPanel.querySelector(`.ml-cwe-weight-input[data-model="${mName}"][data-cwe="${cwe}"]`);
               if (input) input.value = MlResultsPanel.cweWeights[mName][cwe].toFixed(4);
           });
        });

        // Trigger a recalculation by faking an input event on the first slider
        const firstSlider = mlResultsPanel.querySelector('.weight-control-row input[type="range"]');
        if (firstSlider) firstSlider.dispatchEvent(new Event('input'));

        // Update Global Penalty manual input if it exists
        const gpInput = mlResultsPanel.querySelector('#global-penalty-input');
        if (gpInput) gpInput.value = MlResultsPanel.globalTqiPenalty.toFixed(4);
      }

      modalHistory.classList.add('hidden');
    };

    window.deleteVcSnapshot = function(snapId, pName) {
      if (!confirm("Are you sure you want to delete this snapshot?")) return;
      
      const history = JSON.parse(localStorage.getItem('cwe-history') || '{"projects":{}}');
      if (!history.projects[pName]) return;
      
      history.projects[pName].snapshots = history.projects[pName].snapshots.filter(s => s.id !== snapId);
      
      if (history.projects[pName].snapshots.length === 0) {
         delete history.projects[pName];
         localStorage.setItem('cwe-history', JSON.stringify(history));
         if (btnHistory) btnHistory.click(); // Reload sidebar
      } else {
         localStorage.setItem('cwe-history', JSON.stringify(history));
         if (btnHistory) btnHistory.click(); // Reset sidebar
         setTimeout(() => {
             const items = sidebarList.querySelectorAll('.vc-project-item');
             items.forEach(el => {
                 if (el.textContent.startsWith(pName)) el.click();
             });
         }, 10);
      }
    };

    const drawGraph = (snapshots) => {
      const w = svgGraph.clientWidth || 700;
      const h = 250;
      const padding = 30;
      const usableW = w - (padding * 2);
      const usableH = h - (padding * 2);
      
      svgGraph.innerHTML = ''; // clear

      // Draw Y axis lines and labels (0 to 100)
      for(let i=0; i<=100; i+=20) {
        const y = padding + usableH - ((i / 100) * usableH);
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
        const y = padding + usableH - ((Math.min(100, Math.max(0, tqi)) / 100) * usableH);
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
               <div style="font-size:12px; color:#64748b; margin-top:4px;">${new Date(baseSnap.timestamp).toLocaleString()} | Initial TQI: ${baseSnap.tqiScore} / 100</div>
            </div>
            <div style="display:flex; gap: 8px;">
               <button class="vc-restore-btn" onclick="restoreVcWeights('${baseSnap.id}', '${pName}')">Restore</button>
               <button class="vc-delete-btn" onclick="deleteVcSnapshot('${baseSnap.id}', '${pName}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer;">Delete</button>
            </div>
          </div>
        </div>
      `;

      for (let i = 1; i < snapshots.length; i++) {
        const snapA = snapshots[i-1];
        const snapB = snapshots[i];
        
        const setA = new Set(snapA.cwes || []);
        const setB = new Set(snapB.cwes || []);
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
               <strong style="color:#334155; display:block; margin-bottom:8px;">Model Score Changes</strong>
               ${mlDiffHtml}
             </div>
           `;
        }

        const diffHtml = `
          <div class="vc-version-diff" style="border-left: 4px solid ${tqiColor};">
            <div class="vc-diff-header">
              <div>
                 <strong>${snapB.versionName}</strong>
                 <div style="font-size:12px; color:#64748b; margin-top:4px;">${new Date(snapB.timestamp).toLocaleString()}</div>
              </div>
              <div style="display:flex; gap: 15px; align-items:center;">
                 <div style="text-align:right;">
                   <div style="font-size: 16px; font-weight: bold; color: ${tqiColor};">${snapB.tqiScore}</div>
                   <div style="font-size: 11px; color: ${tqiColor};">${tqiSign}${tqiDelta.toFixed(4)}</div>
                 </div>
                 <div style="display:flex; gap: 8px;">
                   <button class="vc-restore-btn" onclick="restoreVcWeights('${snapB.id}', '${pName}')">Restore</button>
                   <button class="vc-delete-btn" onclick="deleteVcSnapshot('${snapB.id}', '${pName}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer;">Delete</button>
                 </div>
              </div>
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
      btnHistory.onclick = () => {
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
      };
    }
    if (btnCloseHistory) {
      btnCloseHistory.onclick = () => modalHistory.classList.add('hidden');
    }

    // --- MODEL VERSIONS TAB ---
    const tabProjects = document.getElementById('vc-tab-projects');
    const tabModels = document.getElementById('vc-tab-models');
    const projectsTab = document.getElementById('vc-projects-tab');
    const modelsTab = document.getElementById('vc-models-tab');
    const modelsList = document.getElementById('vc-models-list');

    const renderModelVersions = async () => {
      if (!modelsList) return;
      modelsList.innerHTML = '<p style="color:#64748b; font-size:13px;">Loading...</p>';

      let registry = {};
      try {
        registry = await window.trainingAPI.listVersions();
      } catch (e) {
        modelsList.innerHTML = `<p style="color:#991b1b; font-size:13px;">Failed to load models: ${e.message || e}</p>`;
        return;
      }

      const characteristics = Object.keys(registry).sort();
      if (characteristics.length === 0) {
        modelsList.innerHTML = '<p style="color:#64748b; font-size:13px;">No models found yet. Train one from the ML Integration panel.</p>';
        return;
      }

      modelsList.innerHTML = characteristics
        .map((characteristic) => {
          const entry = registry[characteristic];
          const prod = entry.production;
          const history = entry.history || [];

          const prodRow = prod
            ? `
            <div class="model-version-row production">
              <div class="model-version-info">
                <div class="model-version-name">${characteristic} <span class="training-badge">live</span></div>
                <div class="model-version-meta">
                  ${prod.trainedAt ? `Trained ${new Date(prod.trainedAt).toLocaleString()}` : 'Bundled with the app'}
                  ${prod.metrics ? ` &middot; R2 ${prod.metrics.r2.toFixed(3)} &middot; MAE ${prod.metrics.mae.toFixed(3)}` : ''}
                </div>
              </div>
            </div>
          `
            : `<div class="model-version-row"><div class="model-version-info"><div class="model-version-name">${characteristic}</div><div class="model-version-meta">No live model</div></div></div>`;

          const historyRows = history
            .map(
              (v) => `
            <div class="model-version-row">
              <div class="model-version-info">
                <div class="model-version-name">${characteristic}</div>
                <div class="model-version-meta">
                  Replaced ${new Date(v.replacedAt).toLocaleString()}
                  ${v.metrics ? ` &middot; R2 ${v.metrics.r2.toFixed(3)} &middot; MAE ${v.metrics.mae.toFixed(3)}` : ''}
                </div>
              </div>
              <button class="vc-restore-btn model-restore-btn" data-characteristic="${characteristic}" data-version-id="${v.id}">Restore</button>
            </div>
          `
            )
            .join('');

          return `<div class="model-versions-group">${prodRow}${historyRows}</div>`;
        })
        .join('');

      modelsList.querySelectorAll('.model-restore-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const characteristic = btn.dataset.characteristic;
          const versionId = btn.dataset.versionId;
          if (!confirm(`Restore this earlier ${characteristic} model? The current live model will be archived, not deleted.`)) return;

          btn.disabled = true;
          btn.textContent = 'Restoring...';
          try {
            await window.trainingAPI.restore(characteristic, versionId);
            await renderModelVersions();
          } catch (e) {
            alert(`Failed to restore: ${e.message || e}`);
            btn.disabled = false;
            btn.textContent = 'Restore';
          }
        });
      });
    };

    if (tabProjects && tabModels) {
      tabProjects.addEventListener('click', () => {
        tabProjects.classList.add('active');
        tabModels.classList.remove('active');
        projectsTab.classList.remove('hidden');
        modelsTab.classList.add('hidden');
      });
      tabModels.addEventListener('click', () => {
        tabModels.classList.add('active');
        tabProjects.classList.remove('active');
        modelsTab.classList.remove('hidden');
        projectsTab.classList.add('hidden');
        renderModelVersions();
      });
    }
  }
}
