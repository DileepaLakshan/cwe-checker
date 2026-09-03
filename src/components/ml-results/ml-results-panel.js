import { getDOM } from '../../utils/dom-references.js';
import { calculateAIWeights } from '../../services/ai-weight-service.js';
import { TrainingPanel } from '../training/training-panel.js';
import { exportTqiReport } from '../../services/export-service.js';

// Colorblind-safe categorical palette, shared by the pie and sensitivity charts.
const CB_COLORS = ['#00429d', '#4771b2', '#a5d5d8', '#ffbcaf', '#cf3759', '#93003a'];

function toSafeId(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '-');
}

// Shared geometry for the sensitivity chart, so the slider-drag handlers (which move
// markers/lines directly via DOM, without re-rendering the SVG) use the exact same
// coordinate mapping as sensitivityChartSvg below.
const SENS_CHART = { w: 320, h: 240, padL: 32, padR: 12, padT: 14, padB: 28 };
function sensXScale(frac) {
  return SENS_CHART.padL + (frac / 2) * (SENS_CHART.w - SENS_CHART.padL - SENS_CHART.padR);
}
function sensYScale(tqi) {
  const plotH = SENS_CHART.h - SENS_CHART.padT - SENS_CHART.padB;
  return SENS_CHART.padT + plotH - (Math.min(100, Math.max(0, tqi)) / 100) * plotH;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
}

function pieSvg(slices) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return '<div class="training-no-samples">No contribution data to plot.</div>';

  const cx = 110, cy = 110, r = 95;
  let paths;

  if (slices.length === 1) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${CB_COLORS[0]}" class="pie-slice"><title>${slices[0].name}: 100%</title></circle>`;
  } else {
    let angle = 0;
    paths = slices.map((s, idx) => {
      const pct = s.value / total;
      const sweep = pct * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle;
      const d = describeArc(cx, cy, r, startAngle, endAngle);
      return `<path d="${d}" fill="${CB_COLORS[idx % CB_COLORS.length]}" class="pie-slice"><title>${s.name}: ${(pct * 100).toFixed(1)}%</title></path>`;
    }).join('');
  }

  const legend = slices.map((s, idx) => {
    const pct = (s.value / total) * 100;
    return `
      <div class="pie-legend-row">
        <span class="pie-legend-swatch" style="background:${CB_COLORS[idx % CB_COLORS.length]}"></span>
        <span class="pie-legend-label">${s.name}</span>
        <span class="pie-legend-pct">${pct.toFixed(1)}%</span>
      </div>
    `;
  }).join('');

  return `
    <div class="pie-chart-wrapper">
      <svg viewBox="0 0 220 220" class="pie-svg" role="img" aria-label="Contribution share by CWE">${paths}</svg>
      <div class="pie-legend">${legend}</div>
    </div>
  `;
}

function sensitivityChartSvg(series, currentTqi, thresholdTqi, simulatedTqi) {
  const { w, h, padL, padR, padT, padB } = SENS_CHART;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const xScale = sensXScale;
  const yScale = sensYScale;

  const yGrid = [0, 25, 50, 75, 100].map((v) => `
    <line x1="${padL}" y1="${yScale(v).toFixed(1)}" x2="${w - padR}" y2="${yScale(v).toFixed(1)}" class="sens-grid-line" />
    <text x="${padL - 4}" y="${(yScale(v) + 3).toFixed(1)}" class="mli-axis-label" text-anchor="end">${v}</text>
  `).join('');

  const xTicks = [0, 0.5, 1, 1.5, 2].map((f) => `
    <text x="${xScale(f).toFixed(1)}" y="${h - padB + 12}" class="mli-axis-label" text-anchor="middle">${Math.round(f * 100)}%</text>
  `).join('');

  const lines = series.map((s) => {
    const isVisible = s.visible !== false;
    const visibilityStyle = isVisible ? '' : 'display: none;';
    const pointsStr = s.points.map((p) => `${xScale(p.frac).toFixed(1)},${yScale(p.tqi).toFixed(1)}`).join(' ');
    const markerData = s.marker || s.points[s.points.length - 1];
    const safeId = toSafeId(s.name);
    const marker = markerData
      ? `<circle id="sens-marker-${safeId}" cx="${xScale(markerData.frac).toFixed(1)}" cy="${yScale(markerData.tqi).toFixed(1)}" r="4" fill="${s.color}" stroke="#1e293b" stroke-width="1" style="${visibilityStyle}"><title>${s.name}: ${markerData.tqi.toFixed(2)} TQI</title></circle>`
      : '';
    return `<polyline id="sens-line-${safeId}" points="${pointsStr}" fill="none" stroke="${s.color}" stroke-width="2" class="sens-line" style="${visibilityStyle}" />${marker}`;
  }).join('');

  const scoreLine = `<line x1="${padL}" y1="${yScale(currentTqi).toFixed(1)}" x2="${w - padR}" y2="${yScale(currentTqi).toFixed(1)}" class="sens-score-line" />`;
  const thresholdLine = typeof thresholdTqi === 'number'
    ? `<line x1="${padL}" y1="${yScale(thresholdTqi).toFixed(1)}" x2="${w - padR}" y2="${yScale(thresholdTqi).toFixed(1)}" class="sens-threshold-line" />`
    : '';
  const simulatedLine = typeof simulatedTqi === 'number'
    ? `<line id="sens-simulated-line" x1="${padL}" y1="${yScale(simulatedTqi).toFixed(1)}" x2="${w - padR}" y2="${yScale(simulatedTqi).toFixed(1)}" class="sens-simulated-line" />`
    : '';

  const legend = series.map((s) => `
    <div class="pie-legend-row">
      <span class="pie-legend-swatch" style="background:${s.color}"></span>
      <span class="pie-legend-label">${s.name}</span>
    </div>
  `).join('');

  return `
    <div class="sens-chart-wrapper">
      <svg viewBox="0 0 ${w} ${h}" class="sens-svg" role="img" aria-label="TQI sensitivity to CWE remediation">
        ${yGrid}
        ${xTicks}
        ${thresholdLine}
        ${scoreLine}
        ${simulatedLine}
        ${lines}
        <text x="${(padL + plotW / 2).toFixed(1)}" y="${h - 4}" class="mli-axis-label" text-anchor="middle">% of current severity remaining</text>
        <text x="10" y="${(padT + plotH / 2).toFixed(1)}" class="mli-axis-label" text-anchor="middle" transform="rotate(-90 10 ${(padT + plotH / 2).toFixed(1)})">TQI</text>
      </svg>
      <div class="pie-legend sens-legend">${legend}</div>
    </div>
  `;
}

export class MlResultsPanel {
  static mlWeights = {};
  static cweWeights = {};
  static globalTqiPenalty = 0;
  static activeInsightTab = 'contrib';
  static activeStrategy = 'fastest';
  static customBlend = 0.5;
  static targetTqi = 80;
  static whatIfFracs = {}; // { [characteristic]: fraction of current severity kept, 0-1 } for the What-If Simulator
  static visibleSensLines = {}; // { [characteristic]: boolean }

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

  // For each CWE currently affecting a model score, simulate fully remediating it
  // (zeroing its value everywhere it appears) and measure the resulting TQI gain.
  static computeCweImpact(models, predictions) {
    const { finalTqi: baseTqiStr } = MlResultsPanel.calculateTqi(models, predictions);
    const baseTqi = parseFloat(baseTqiStr);

    const cweSet = new Set();
    for (const m of models) {
      const modelData = predictions[m];
      if (modelData.error || !MlResultsPanel.cweWeights[m]) continue;
      for (const i of (modelData.inputs || [])) {
        if (i.value !== 0 && MlResultsPanel.cweWeights[m][i.cwe] !== undefined) {
          cweSet.add(i.cwe);
        }
      }
    }

    const impacts = [];
    for (const cwe of cweSet) {
      const simPredictions = {};
      for (const m of models) {
        const modelData = predictions[m];
        if (modelData.error) { simPredictions[m] = modelData; continue; }
        simPredictions[m] = {
          ...modelData,
          inputs: (modelData.inputs || []).map(i => i.cwe === cwe ? { ...i, value: 0 } : i)
        };
      }

      const { finalTqi: simTqiStr } = MlResultsPanel.calculateTqi(models, simPredictions);
      const delta = parseFloat(simTqiStr) - baseTqi;

      const affectedModels = models.filter(m =>
        !predictions[m].error && (predictions[m].inputs || []).some(i => i.cwe === cwe && i.value !== 0)
      );

      impacts.push({ cwe, delta, affectedModels });
    }

    impacts.sort((a, b) => b.delta - a.delta);
    return { impacts, baseTqi };
  }

  // For each quality characteristic (model) currently dragging TQI down, simulate that
  // characteristic scoring perfectly (every CWE it scanned fully remediated) and measure
  // the resulting TQI gain. Coarser-grained sibling of computeCweImpact — one row per
  // characteristic (Security, Maintainability, ...) instead of one row per CWE.
  static computeCharacteristicImpact(models, predictions) {
    const { finalTqi: baseTqiStr } = MlResultsPanel.calculateTqi(models, predictions);
    const baseTqi = parseFloat(baseTqiStr);

    const impacts = [];
    for (const m of models) {
      const modelData = predictions[m];
      if (modelData.error) continue;
      if (!(modelData.inputs || []).some(i => i.value !== 0)) continue;

      const simPredictions = {
        ...predictions,
        [m]: { ...modelData, inputs: (modelData.inputs || []).map(i => ({ ...i, value: 0 })) }
      };
      const { finalTqi: simTqiStr } = MlResultsPanel.calculateTqi(models, simPredictions);
      const delta = parseFloat(simTqiStr) - baseTqi;

      impacts.push({ name: m, delta });
    }

    impacts.sort((a, b) => b.delta - a.delta);
    return { impacts, baseTqi };
  }

  // Resulting TQI as an entire quality characteristic's scanned CWEs are scaled from
  // their current values (frac=1) down to fully remediated (frac=0) together.
  static computeCharacteristicSensitivityCurve(models, predictions, modelName, steps = 21) {
    const points = [];
    for (let s = 0; s < steps; s++) {
      const frac = (s / (steps - 1)) * 2;
      points.push({ frac, tqi: MlResultsPanel.computeMultiCharacteristicTqi(models, predictions, { [modelName]: frac }) });
    }
    return points;
  }

  // TQI if one or more characteristics are scaled to an arbitrary fraction of their
  // current severity simultaneously (any characteristic not present in fracByModel is
  // left at its current/scanned value, i.e. fraction 1). Since each characteristic's
  // charScore only depends on its own inputs and TQI is a weighted average of charScores,
  // this is exact (no cross-characteristic interaction) — unlike CWEs sharing a model.
  static computeMultiCharacteristicTqi(models, predictions, fracByModel) {
    const simPredictions = {};
    for (const m of models) {
      const modelData = predictions[m];
      if (modelData.error) { simPredictions[m] = modelData; continue; }
      const frac = fracByModel[m] !== undefined ? fracByModel[m] : 1;
      simPredictions[m] = { ...modelData, inputs: (modelData.inputs || []).map(i => ({ ...i, value: i.value * frac })) };
    }
    const { finalTqi } = MlResultsPanel.calculateTqi(models, simPredictions);
    return parseFloat(finalTqi);
  }

  // Raw scanned severity summed across every model a CWE appears in — a rough
  // "how much code/how many instances need touching" proxy for remediation effort.
  static computeCweEffort(models, predictions, cwe) {
    let total = 0;
    for (const m of models) {
      const modelData = predictions[m];
      if (modelData.error) continue;
      for (const i of (modelData.inputs || [])) {
        if (i.cwe === cwe) total += i.value;
      }
    }
    return total;
  }

  // Greedy full remediation plan: repeatedly fix whichever remaining CWE gives the
  // largest marginal TQI gain right now. Unlike the independent per-CWE deltas in
  // computeCweImpact, this captures diminishing returns when two CWEs share a
  // characteristic model, since charScore decays exponentially in the summed input.
  static computeGreedyRemediationOrder(models, predictions) {
    let working = {};
    for (const m of models) {
      const modelData = predictions[m];
      working[m] = modelData.error ? modelData : { ...modelData, inputs: (modelData.inputs || []).map(i => ({ ...i })) };
    }

    const remaining = new Set();
    for (const m of models) {
      if (working[m].error || !MlResultsPanel.cweWeights[m]) continue;
      for (const i of working[m].inputs || []) {
        if (i.value !== 0 && MlResultsPanel.cweWeights[m][i.cwe] !== undefined) remaining.add(i.cwe);
      }
    }

    const order = [];
    let currentTqi = parseFloat(MlResultsPanel.calculateTqi(models, working).finalTqi);

    while (remaining.size > 0) {
      let best = null;
      for (const cwe of remaining) {
        const sim = {};
        for (const m of models) {
          sim[m] = working[m].error ? working[m] : { ...working[m], inputs: working[m].inputs.map(i => i.cwe === cwe ? { ...i, value: 0 } : i) };
        }
        const simTqi = parseFloat(MlResultsPanel.calculateTqi(models, sim).finalTqi);
        const delta = simTqi - currentTqi;
        if (!best || delta > best.delta) best = { cwe, delta, simTqi, sim };
      }
      order.push({ cwe: best.cwe, delta: best.delta });
      working = best.sim;
      currentTqi = best.simTqi;
      remaining.delete(best.cwe);
    }

    return order;
  }

  // Reorders (and annotates) the impact list according to the selected remediation strategy.
  static rankByStrategy(impacts, models, predictions, strategy, customBlend) {
    const affectedByCwe = {};
    impacts.forEach(i => { affectedByCwe[i.cwe] = i.affectedModels; });

    if (strategy === 'lowest') {
      const order = MlResultsPanel.computeGreedyRemediationOrder(models, predictions);
      return order.map(o => ({ cwe: o.cwe, delta: o.delta, affectedModels: affectedByCwe[o.cwe] || [] }));
    }

    const withEffort = impacts.map(i => ({ ...i, effort: MlResultsPanel.computeCweEffort(models, predictions, i.cwe) }));

    if (strategy === 'lowestEffort') {
      withEffort.forEach(i => { i.roi = i.delta / Math.max(i.effort, 0.0001); });
      return withEffort.sort((a, b) => b.roi - a.roi);
    }

    if (strategy === 'custom') {
      const maxDelta = Math.max(...withEffort.map(i => i.delta), 0.0001);
      const maxEffort = Math.max(...withEffort.map(i => i.effort), 0.0001);
      withEffort.forEach(i => {
        const normDelta = i.delta / maxDelta;
        const normEffortInv = 1 - i.effort / maxEffort;
        i.customScore = customBlend * normDelta + (1 - customBlend) * normEffortInv;
      });
      return withEffort.sort((a, b) => b.customScore - a.customScore);
    }

    // 'fastest' (default): biggest independent single-fix win first
    return withEffort.sort((a, b) => b.delta - a.delta);
  }

  static renderContributionPie(impacts) {
    if (impacts.length === 0) {
      return '<div class="training-no-samples">No quality characteristic currently reduces TQI enough to chart.</div>';
    }
    const top = impacts.slice(0, 6);
    const rest = impacts.slice(6);
    const slices = top.map(i => ({ name: i.name, value: i.delta }));
    if (rest.length > 0) {
      slices.push({ name: `Other (${rest.length})`, value: rest.reduce((s, i) => s + i.delta, 0) });
    }
    return pieSvg(slices);
  }

  static renderSensitivityTab(impacts, models, predictions, baseTqi) {
    if (impacts.length === 0) {
      return '<div class="training-no-samples">No quality characteristic currently reduces TQI enough to chart.</div>';
    }
    const top = impacts.slice(0, 6);

    // Each characteristic's slider defaults to 100% (current/unfixed) until the user drags it.
    const fracByModel = {};
    top.forEach(item => {
      fracByModel[item.name] = MlResultsPanel.whatIfFracs[item.name] !== undefined ? MlResultsPanel.whatIfFracs[item.name] : 1;
    });

    const series = top.map((item, idx) => {
      const frac = fracByModel[item.name];
      return {
        name: item.name,
        color: CB_COLORS[idx % CB_COLORS.length],
        visible: MlResultsPanel.visibleSensLines[item.name] !== false,
        points: MlResultsPanel.computeCharacteristicSensitivityCurve(models, predictions, item.name),
        // Marker sits at this slider's own frac, holding every other characteristic at
        // its current value — an isolated view of "if only this one changes".
        marker: { frac, tqi: MlResultsPanel.computeMultiCharacteristicTqi(models, predictions, { [item.name]: frac }) }
      };
    });

    // The simulated line reflects every slider at once — exact, since characteristics
    // don't interact (see computeMultiCharacteristicTqi).
    const simulatedTqi = MlResultsPanel.computeMultiCharacteristicTqi(models, predictions, fracByModel);
    const chartHtml = sensitivityChartSvg(series, baseTqi, MlResultsPanel.targetTqi, simulatedTqi);

    const sliderRows = top.map((item, idx) => {
      const color = CB_COLORS[idx % CB_COLORS.length];
      const safeId = toSafeId(item.name);
      const frac = fracByModel[item.name];
      const pct = Math.round(frac * 100);
      const rawScore = MlResultsPanel.getModelScore(item.name, predictions) * frac;
      const isVisible = MlResultsPanel.visibleSensLines[item.name] !== false;
      return `
        <div class="mli-sim-row">
          <input type="checkbox" class="mli-sim-toggle" data-model="${item.name}" ${isVisible ? 'checked' : ''} title="Toggle line visibility" style="cursor:pointer; margin-right:4px;">
          <span class="pie-legend-swatch" style="background:${color}"></span>
          <span class="mli-sim-name">${item.name}</span>
          <input type="range" class="mli-sim-slider" id="mli-sim-slider-${safeId}" min="0" max="200" step="1" value="${pct}" data-model="${item.name}">
          <span class="mli-sim-pct" id="mli-sim-pct-${safeId}">${rawScore.toFixed(2)}</span>
        </div>
      `;
    }).join('');

    const delta = simulatedTqi - baseTqi;
    const deltaClass = delta > 0.005 ? 'mli-sim-delta-up' : (delta < -0.005 ? 'mli-sim-delta-down' : '');
    const deltaSign = delta > 0 ? '+' : '';

    return `
      ${chartHtml}
      <div class="mli-whatif">
        <div class="mli-whatif-header">
          <h4>What-If Simulator</h4>
          <button id="mli-sim-reset" class="mli-sim-reset" type="button">Reset</button>
        </div>
        <div class="mli-sim-rows">${sliderRows}</div>
        <div class="mli-sim-readout">
          Simulated TQI: <span id="mli-sim-tqi-value">${simulatedTqi.toFixed(2)}</span>
          <span id="mli-sim-tqi-delta" class="${deltaClass}">(${deltaSign}${delta.toFixed(2)})</span>
        </div>
      </div>
    `;
  }

  static renderImpactRows(ranked) {
    const maxDelta = Math.max(...ranked.map(i => i.delta), 0.0001);
    return ranked.slice(0, 10).map((item, idx) => {
      const rank = idx + 1;
      const pct = Math.max(2, (item.delta / maxDelta) * 100);
      const badges = (item.affectedModels || []).map(m => `<span class="cwe-priority-badge">${m}</span>`).join('');
      const roiTag = typeof item.roi === 'number' ? `<span class="cwe-priority-sub">ROI ${item.roi.toFixed(2)}</span>` : '';
      return `
        <div class="cwe-priority-row">
          <div class="cwe-priority-rank">#${rank}</div>
          <div class="cwe-priority-main">
            <div class="cwe-priority-label">
              <span class="cwe-priority-cwe">${item.cwe}</span>
              <span class="cwe-priority-value">+${item.delta.toFixed(2)} TQI ${roiTag}</span>
            </div>
            <div class="cwe-priority-bar-track">
              <div class="cwe-priority-bar-fill rank-${Math.min(rank, 5)}" style="width: ${pct.toFixed(1)}%;"></div>
            </div>
            <div class="cwe-priority-badges">${badges}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  static renderImpactsTab(impacts, models, predictions) {
    if (impacts.length === 0) {
      return '<div class="training-no-samples">No CWE currently reduces TQI enough to prioritize — nice work.</div>';
    }

    const strategy = MlResultsPanel.activeStrategy;
    const ranked = MlResultsPanel.rankByStrategy(impacts, models, predictions, strategy, MlResultsPanel.customBlend);

    const blendRowHtml = strategy === 'custom' ? `
      <div class="mli-blend-row">
        <span class="mli-blend-end">Effort-efficient</span>
        <input type="range" id="mli-custom-blend" min="0" max="1" step="0.05" value="${MlResultsPanel.customBlend}">
        <span class="mli-blend-end">Highest impact</span>
        <span id="mli-custom-blend-val">${Math.round(MlResultsPanel.customBlend * 100)}%</span>
      </div>
    ` : '';

    const rows = MlResultsPanel.renderImpactRows(ranked);

    return `
      <div class="mli-strategy-row">
        <label for="mli-strategy-select">Strategy</label>
        <select id="mli-strategy-select">
          <option value="fastest" ${strategy === 'fastest' ? 'selected' : ''}>Fastest — biggest single win</option>
          <option value="lowest" ${strategy === 'lowest' ? 'selected' : ''}>Lowest Risk — best full remediation order</option>
          <option value="lowestEffort" ${strategy === 'lowestEffort' ? 'selected' : ''}>Lowest Effort — best ROI</option>
          <option value="custom" ${strategy === 'custom' ? 'selected' : ''}>Custom Blend</option>
        </select>
      </div>
      ${blendRowHtml}
      <div class="cwe-priority-list" id="mli-impacts-rows">${rows}</div>
    `;
  }

  static renderInsightsSection(models, predictions) {
    // Impacts tab stays CWE-grained (you remediate individual CWEs). Contributions and
    // Sensitivity are aggregated to the quality-characteristic level (Security,
    // Maintainability, ...) since those answer "which characteristic to focus on", not
    // "which line of code to fix".
    const { impacts: cweImpacts } = MlResultsPanel.computeCweImpact(models, predictions);
    const positiveCweImpacts = cweImpacts.filter(i => i.delta > 0.0001);

    const { impacts: charImpacts, baseTqi } = MlResultsPanel.computeCharacteristicImpact(models, predictions);
    const positiveCharImpacts = charImpacts.filter(i => i.delta > 0.0001);

    const tab = MlResultsPanel.activeInsightTab;
    const pieHtml = tab === 'contrib' ? MlResultsPanel.renderContributionPie(positiveCharImpacts) : '';
    const sensitivityHtml = tab === 'sensitivity' ? MlResultsPanel.renderSensitivityTab(positiveCharImpacts, models, predictions, baseTqi) : '';
    const impactsHtml = tab === 'impacts' ? MlResultsPanel.renderImpactsTab(positiveCweImpacts, models, predictions) : '';

    return `
      <div class="ml-insights-section" id="ml-insights-section">
        <div class="ml-insights-header">
          <h3>🎯 Fix Prioritization</h3>
          <p>Which quality characteristics and CWEs to address, and in what order, to move TQI the most.</p>
          <div class="mli-target-row">
            <label for="mli-target-tqi">Target TQI</label>
            <input type="number" id="mli-target-tqi" min="0" max="100" step="1" value="${MlResultsPanel.targetTqi}">
          </div>
        </div>
        <div class="mli-tablist" role="tablist">
          <button class="mli-tab ${tab === 'contrib' ? 'active' : ''}" data-tab="contrib" type="button">Contributions</button>
          <button class="mli-tab ${tab === 'sensitivity' ? 'active' : ''}" data-tab="sensitivity" type="button">Sensitivity</button>
          <button class="mli-tab ${tab === 'impacts' ? 'active' : ''}" data-tab="impacts" type="button">Impacts</button>
        </div>
        <div class="mli-tabpanel ${tab === 'contrib' ? '' : 'hidden'}" data-panel="contrib">
          <p class="mli-tab-desc">Share of the total fixable TQI gain each quality characteristic (Security, Maintainability, ...) currently accounts for.</p>
          ${pieHtml}
        </div>
        <div class="mli-tabpanel ${tab === 'sensitivity' ? '' : 'hidden'}" data-panel="sensitivity">
          <p class="mli-tab-desc">Drag a slider to see what happens to TQI as that characteristic's severity changes. Dotted black = current TQI, dashed red = target, solid blue = your simulated scenario.</p>
          ${sensitivityHtml}
        </div>
        <div class="mli-tabpanel ${tab === 'impacts' ? '' : 'hidden'}" data-panel="impacts">
          ${impactsHtml}
        </div>
      </div>
    `;
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
          <button id="export-report-btn" class="adjust-weights-btn" style="margin-right: 10px; background-color: #f59e0b;">Export Report</button>
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
                <div class="ml-input-node-wrapper" style="cursor: pointer;" data-cwe="${i.cwe}">
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

        ${MlResultsPanel.renderInsightsSection(models, predictions)}

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

    // Add click listeners to navigate to scanner results for CWE nodes
    mlResultsPanel.querySelectorAll('.ml-input-node-wrapper').forEach(wrapper => {
      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        const cweLabel = wrapper.getAttribute('data-cwe');
        if (cweLabel) {
          import('../../services/editor-service.js').then(module => {
            module.openScanResultsTab();
            setTimeout(() => {
              const scanPanel = document.getElementById('scan-results-panel');
              if (scanPanel) {
                const cards = scanPanel.querySelectorAll('.result-card');
                for (const card of cards) {
                  const vulnIdSpan = card.querySelector('.vuln-id');
                  if (vulnIdSpan && vulnIdSpan.textContent.includes(cweLabel)) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const originalBg = card.style.backgroundColor;
                    const originalTransition = card.style.transition;
                    card.style.transition = 'background-color 0.3s ease';
                    card.style.backgroundColor = 'rgba(234, 179, 8, 0.2)'; // Highlight color
                    setTimeout(() => {
                      card.style.backgroundColor = originalBg;
                      setTimeout(() => { card.style.transition = originalTransition; }, 300);
                    }, 1500);
                    break;
                  }
                }
              }
            }, 100);
          });
        }
      });
    });

    // Export Report
    const exportReportBtn = mlResultsPanel.querySelector('#export-report-btn');
    if (exportReportBtn) {
      exportReportBtn.addEventListener('click', async () => {
        const originalText = exportReportBtn.textContent;
        exportReportBtn.disabled = true;
        exportReportBtn.textContent = 'Exporting...';
        try {
          await exportTqiReport(models, predictions);
        } finally {
          exportReportBtn.disabled = false;
          exportReportBtn.textContent = originalText;
        }
      });
    }

    // Inject initial math calculation
    const mathBreakdownNode = mlResultsPanel.querySelector('#tqi-math-breakdown');
    if (mathBreakdownNode) {
      mathBreakdownNode.innerHTML = `<b>Calculation:</b> ${mathString} = <b style="color: #28a745;">${tqiScore}</b>`;
    }

    // Attaches listeners to the "Fix Prioritization" tabs/strategy/blend/target controls.
    // Called once after the initial render, and again after every refreshInsightsSection()
    // replaces the section's markup (outerHTML swaps destroy previously bound listeners).
    const wireInsightsSection = () => {
      const section = mlResultsPanel.querySelector('#ml-insights-section');
      if (!section) return;

      section.querySelectorAll('.mli-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          MlResultsPanel.activeInsightTab = btn.dataset.tab;
          refreshInsightsSection();
        });
      });

      const strategySelect = section.querySelector('#mli-strategy-select');
      if (strategySelect) {
        strategySelect.addEventListener('change', (e) => {
          MlResultsPanel.activeStrategy = e.target.value;
          refreshInsightsSection();
        });
      }

      const blendSlider = section.querySelector('#mli-custom-blend');
      if (blendSlider) {
        // Updates the ranked list + label in place rather than calling refreshInsightsSection(),
        // which would replace this slider's own DOM node mid-drag and cut the drag short.
        blendSlider.addEventListener('input', (e) => {
          MlResultsPanel.customBlend = parseFloat(e.target.value);

          const valLabel = section.querySelector('#mli-custom-blend-val');
          if (valLabel) valLabel.textContent = `${Math.round(MlResultsPanel.customBlend * 100)}%`;

          const { impacts: cweImpacts } = MlResultsPanel.computeCweImpact(models, predictions);
          const positiveCweImpacts = cweImpacts.filter(i => i.delta > 0.0001);
          const ranked = MlResultsPanel.rankByStrategy(positiveCweImpacts, models, predictions, 'custom', MlResultsPanel.customBlend);

          const rowsContainer = section.querySelector('#mli-impacts-rows');
          if (rowsContainer) rowsContainer.innerHTML = MlResultsPanel.renderImpactRows(ranked);
        });
      }

      const targetInput = section.querySelector('#mli-target-tqi');
      if (targetInput) {
        targetInput.addEventListener('input', (e) => {
          MlResultsPanel.targetTqi = parseFloat(e.target.value) || 0;
          refreshInsightsSection();
        });
      }

      // What-If Simulator: drags directly move the chart's markers/simulated line and
      // update the readouts in place — never rebuilds the section (that would drop the drag).
      const simSliders = section.querySelectorAll('.mli-sim-slider');
      simSliders.forEach((slider) => {
        slider.addEventListener('input', (e) => {
          const modelName = e.target.getAttribute('data-model');
          const frac = parseFloat(e.target.value) / 100;
          MlResultsPanel.whatIfFracs[modelName] = frac;

          const safeId = modelName.replace(/[^a-zA-Z0-9_-]/g, '-');

          const rawScore = MlResultsPanel.getModelScore(modelName, predictions) * frac;
          const pctLabel = section.querySelector(`#mli-sim-pct-${safeId}`);
          if (pctLabel) pctLabel.textContent = rawScore.toFixed(2);

          // Move this characteristic's own marker (holding every other characteristic at current).
          const singleTqi = MlResultsPanel.computeMultiCharacteristicTqi(models, predictions, { [modelName]: frac });
          const marker = section.querySelector(`#sens-marker-${safeId}`);
          if (marker) {
            marker.setAttribute('cx', sensXScale(frac).toFixed(1));
            marker.setAttribute('cy', sensYScale(singleTqi).toFixed(1));
            const title = marker.querySelector('title');
            if (title) title.textContent = `${modelName}: ${singleTqi.toFixed(2)} TQI`;
          }

          // Recompute the combined effect of every slider currently on screen.
          const fracByModel = {};
          simSliders.forEach((s) => { fracByModel[s.getAttribute('data-model')] = parseFloat(s.value) / 100; });
          const simulatedTqi = MlResultsPanel.computeMultiCharacteristicTqi(models, predictions, fracByModel);

          const simLine = section.querySelector('#sens-simulated-line');
          if (simLine) {
            const y = sensYScale(simulatedTqi).toFixed(1);
            simLine.setAttribute('y1', y);
            simLine.setAttribute('y2', y);
          }

          const baseTqi = parseFloat(MlResultsPanel.calculateTqi(models, predictions).finalTqi);
          const delta = simulatedTqi - baseTqi;

          const tqiValueEl = section.querySelector('#mli-sim-tqi-value');
          if (tqiValueEl) tqiValueEl.textContent = simulatedTqi.toFixed(2);

          const deltaEl = section.querySelector('#mli-sim-tqi-delta');
          if (deltaEl) {
            deltaEl.textContent = `(${delta > 0 ? '+' : ''}${delta.toFixed(2)})`;
            deltaEl.className = delta > 0.005 ? 'mli-sim-delta-up' : (delta < -0.005 ? 'mli-sim-delta-down' : '');
          }
        });
      });
      section.querySelectorAll('.mli-sim-toggle').forEach((toggle) => {
        toggle.addEventListener('change', (e) => {
          const modelName = e.target.getAttribute('data-model');
          const isVisible = e.target.checked;
          MlResultsPanel.visibleSensLines[modelName] = isVisible;
          const safeId = modelName.replace(/[^a-zA-Z0-9_-]/g, '-');
          
          const line = section.querySelector(`#sens-line-${safeId}`);
          if (line) line.style.display = isVisible ? '' : 'none';
          
          const marker = section.querySelector(`#sens-marker-${safeId}`);
          if (marker) marker.style.display = isVisible ? '' : 'none';
        });
      });

      const simResetBtn = section.querySelector('#mli-sim-reset');
      if (simResetBtn) {
        simResetBtn.addEventListener('click', () => {
          simSliders.forEach((s) => { delete MlResultsPanel.whatIfFracs[s.getAttribute('data-model')]; });
          refreshInsightsSection();
        });
      }
    };

    // Keeps the "Fix Prioritization" panel in sync whenever a weight/penalty edit changes TQI,
    // and whenever the user switches tabs/strategy/blend/target within the panel itself.
    const refreshInsightsSection = () => {
      const section = mlResultsPanel.querySelector('#ml-insights-section');
      if (!section) return;
      section.outerHTML = MlResultsPanel.renderInsightsSection(models, predictions);
      wireInsightsSection();
    };

    wireInsightsSection();

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

            refreshInsightsSection();

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

        refreshInsightsSection();
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

        refreshInsightsSection();
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

        refreshInsightsSection();
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

