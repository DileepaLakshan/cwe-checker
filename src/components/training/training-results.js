import { TrainingPanel } from './training-panel.js';

function metricBar(label, candidateVal, productionVal, higherIsBetter) {
  const safeCandidate = typeof candidateVal === 'number' ? candidateVal : 0;
  const safeProduction = typeof productionVal === 'number' ? productionVal : null;
  
  let defaultScale = 1.0;
  if (!higherIsBetter) {
    defaultScale = Math.max(1.0, Math.abs(safeCandidate) * 2);
  }
  
  const max = Math.max(Math.abs(safeCandidate), Math.abs(safeProduction || 0), defaultScale);

  const candidatePct = Math.min(100, (Math.abs(safeCandidate) / max) * 100);
  const productionPct = safeProduction !== null ? Math.min(100, (Math.abs(safeProduction) / max) * 100) : null;

  const betterClass = (a, b) => {
    if (b === null) return '';
    if (higherIsBetter) return a >= b ? 'metric-better' : 'metric-worse';
    return a <= b ? 'metric-better' : 'metric-worse';
  };

  return `
    <div class="metric-bar-row">
      <div class="metric-bar-label" title="${label}">${label}</div>
      <div class="metric-bar-track">
        <div class="metric-bar-fill candidate ${betterClass(safeCandidate, safeProduction)}" style="width:${candidatePct}%"></div>
      </div>
      <div class="metric-bar-value">${safeCandidate.toFixed(3)}</div>
      ${
        productionPct !== null
          ? `
      <div class="metric-bar-track baseline">
        <div class="metric-bar-fill production" style="width:${productionPct}%"></div>
      </div>
      <div class="metric-bar-value baseline">${safeProduction.toFixed(3)}</div>`
          : '<div class="metric-bar-track baseline" style="background: transparent;"></div><div class="metric-bar-value baseline">-</div>'
      }
    </div>
  `;
}

function scatterSvg(samples) {
  if (!samples || samples.length === 0) return '<div class="training-no-samples">No held-out samples to plot.</div>';

  const w = 260;
  const h = 200;
  const pad = 28;
  const all = samples.flatMap((s) => [s.actual, s.predicted]);
  const min = Math.min(0, ...all);
  const max = Math.max(...all, 0.01);
  const scale = (v) => pad + ((v - min) / (max - min)) * (w - pad * 2);
  const scaleY = (v) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);

  const points = samples
    .map((s) => `<circle cx="${scale(s.actual)}" cy="${scaleY(s.predicted)}" r="3.5" class="scatter-point" />`)
    .join('');

  const lineStart = scale(min);
  const lineEnd = scale(max);

  return `
    <svg viewBox="0 0 ${w} ${h}" class="training-scatter" role="img" aria-label="Predicted vs actual scores for held-out projects">
      <line x1="${lineStart}" y1="${h - pad}" x2="${lineEnd}" y2="${pad}" class="scatter-diagonal" />
      ${points}
      <text x="${w / 2}" y="${h - 6}" class="scatter-axis-label" text-anchor="middle">Actual</text>
      <text x="10" y="${h / 2}" class="scatter-axis-label" text-anchor="middle" transform="rotate(-90 10 ${h / 2})">Predicted</text>
    </svg>
  `;
}

function histogramSvg(values, xLabel) {
  if (!values || values.length === 0) return '<div class="training-no-samples">No score data to plot.</div>';

  const w = 260;
  const h = 200;
  const pad = 28;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 0.0001);
  const binCount = Math.min(16, Math.max(5, Math.round(Math.sqrt(values.length))));
  const binWidth = (max - min) / binCount;
  const bins = new Array(binCount).fill(0);
  values.forEach((v) => {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx]++;
  });
  const maxCount = Math.max(...bins, 1);
  const plotW = w - pad * 2;
  const plotH = h - pad * 2;
  const barGap = 1;
  const barWidth = plotW / binCount - barGap;

  const bars = bins
    .map((count, i) => {
      const barH = (count / maxCount) * plotH;
      const x = pad + i * (plotW / binCount);
      const y = h - pad - barH;
      return `<rect x="${x}" y="${y}" width="${Math.max(barWidth, 1)}" height="${barH}" class="histogram-bar" />`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" class="training-scatter" role="img" aria-label="Distribution of ${xLabel} across ${values.length} projects">
      ${bars}
      <text x="${w / 2}" y="${h - 6}" class="scatter-axis-label" text-anchor="middle">${xLabel} (${min.toFixed(2)}-${max.toFixed(2)})</text>
      <text x="10" y="${h / 2}" class="scatter-axis-label" text-anchor="middle" transform="rotate(-90 10 ${h / 2})">Frequency</text>
    </svg>
  `;
}

function errorScatterSvg(samples) {
  if (!samples || samples.length === 0) return '<div class="training-no-samples">No held-out samples to plot.</div>';

  const w = 260;
  const h = 200;
  const pad = 28;
  const predicted = samples.map((s) => s.predicted);
  const errors = samples.map((s) => s.actual - s.predicted);

  const xMin = Math.min(...predicted);
  const xMax = Math.max(...predicted, xMin + 0.0001);
  const errMax = Math.max(...errors.map((e) => Math.abs(e)), 0.0001);

  const scaleX = (v) => pad + ((v - xMin) / (xMax - xMin)) * (w - pad * 2);
  const zeroY = h / 2;
  const scaleY = (err) => zeroY - (err / errMax) * (zeroY - pad / 2);

  const points = samples
    .map((s) => {
      const err = s.actual - s.predicted;
      return `<circle cx="${scaleX(s.predicted)}" cy="${scaleY(err)}" r="3.5" class="scatter-point error-point" />`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" class="training-scatter" role="img" aria-label="Prediction error versus predicted value for held-out projects">
      <line x1="${pad}" y1="${zeroY}" x2="${w - pad}" y2="${zeroY}" class="scatter-diagonal" />
      ${points}
      <text x="${w / 2}" y="${h - 6}" class="scatter-axis-label" text-anchor="middle">Predicted</text>
      <text x="10" y="${h / 2}" class="scatter-axis-label" text-anchor="middle" transform="rotate(-90 10 ${h / 2})">Prediction Error</text>
    </svg>
  `;
}

export class TrainingResults {
  static runId = null;
  static results = {};

  static async render(runId, results, registry) {
    TrainingResults.runId = runId;
    TrainingResults.results = results;

    document.getElementById('training-setup-step')?.classList.add('hidden');
    document.getElementById('training-progress-step')?.classList.add('hidden');
    const container = document.getElementById('training-results-step');
    if (!container) return;
    container.classList.remove('hidden');

    const characteristics = Object.keys(results);

    const cards = characteristics
      .map((characteristic) => {
        const result = results[characteristic];
        const production = registry[characteristic] && registry[characteristic].production;
        const prodMetrics = production && production.metrics;

        if (result.status !== 'done') {
          return `
            <div class="training-result-card error">
              <div class="training-result-header">
                <h4>${characteristic}</h4>
                <span class="training-badge training-badge-error">failed</span>
              </div>
              <p class="training-error-message">${result.message || 'Training failed for this characteristic.'}</p>
            </div>
          `;
        }

        const m = result.metrics;
        return `
          <div class="training-result-card" data-characteristic="${characteristic}">
            <div class="training-result-header">
              <h4>${characteristic}</h4>
            </div>

            <div class="training-metrics">
              ${metricBar('Overall Accuracy (R²)', m.r2, prodMetrics ? prodMetrics.r2 : null, true)}
              ${metricBar('Avg Error (MAE)', m.mae, prodMetrics ? prodMetrics.mae : null, false)}
              ${metricBar('Large Error Penalty (RMSE)', m.rmse, prodMetrics ? prodMetrics.rmse : null, false)}
              ${metricBar('Reliability (CV mean)', m.cv_mean, prodMetrics ? prodMetrics.cv_mean : null, true)}
            </div>

            <div class="training-result-body">
              <div class="training-scatter-wrapper">
                <div class="training-scatter-title">Model Accuracy (Prediction vs Reality)</div>
                <div style="font-size: 11px; color: hsl(var(--text-muted)); margin-bottom: 8px;">Comparing our model's guesses against real known values. Points closer to the diagonal line mean better accuracy.</div>
                ${scatterSvg(result.samples)}
              </div>
              <div class="training-importances">
                <div class="training-scatter-title">Most Important Factors</div>
                <div style="font-size: 11px; color: hsl(var(--text-muted)); margin-bottom: 8px;">The key factors the model found most useful for making its predictions.</div>
                ${result.featureImportances
                  .slice(0, 6)
                  .map(
                    (f) => `
                  <div class="importance-row">
                    <span class="importance-label">${f.feature.replace('_area_area', '')}</span>
                    <div class="importance-track"><div class="importance-fill" style="width:${Math.min(100, f.importance * 100)}%"></div></div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div class="training-result-body">
              <div class="training-scatter-wrapper">
                <div class="training-scatter-title">Score Distribution</div>
                <div style="font-size: 11px; color: hsl(var(--text-muted)); margin-bottom: 8px;">How common are different scores for ${characteristic}? This shows the spread of the data.</div>
                ${histogramSvg(result.yDistribution, 'Score')}
              </div>
              <div class="training-scatter-wrapper">
                <div class="training-scatter-title">Where the Model Makes Mistakes</div>
                <div style="font-size: 11px; color: hsl(var(--text-muted)); margin-bottom: 8px;">Shows if the model tends to over-predict or under-predict for certain values. A flat spread around the center line is ideal.</div>
                ${errorScatterSvg(result.samples)}
              </div>
            </div>

            <div class="training-result-actions">
              <button class="vc-btn-secondary training-discard-btn" data-characteristic="${characteristic}">Discard</button>
              <button class="vc-btn-primary training-apply-btn" data-characteristic="${characteristic}">Apply to Production</button>
            </div>
          </div>
        `;
      })
      .join('');

    container.innerHTML = `
      <div class="training-results-grid">${cards}</div>
      <div class="vc-modal-actions">
        <button id="training-done-btn" class="vc-btn-secondary">Back to Setup</button>
      </div>
    `;

    container.querySelectorAll('.training-apply-btn').forEach((btn) => {
      btn.addEventListener('click', () => TrainingResults.handleApply(btn.dataset.characteristic, btn));
    });
    container.querySelectorAll('.training-discard-btn').forEach((btn) => {
      btn.addEventListener('click', () => TrainingResults.handleDiscard(btn.dataset.characteristic, btn));
    });

    const doneBtn = container.querySelector('#training-done-btn');
    doneBtn.addEventListener('click', () => {
      container.classList.add('hidden');
      TrainingPanel.renderSetup();
    });
  }

  static async handleApply(characteristic, btn) {
    const card = btn.closest('.training-result-card');
    const applyBtn = card.querySelector('.training-apply-btn');
    const discardBtn = card.querySelector('.training-discard-btn');
    applyBtn.disabled = true;
    discardBtn.disabled = true;
    applyBtn.textContent = 'Applying...';

    try {
      await window.trainingAPI.promote(characteristic, TrainingResults.runId);
      applyBtn.textContent = 'Applied';
      card.classList.add('applied');
    } catch (e) {
      applyBtn.disabled = false;
      discardBtn.disabled = false;
      applyBtn.textContent = 'Apply to Production';
      alert(`Failed to apply ${characteristic}: ${e.message || e}`);
    }
  }

  static async handleDiscard(characteristic, btn) {
    const card = btn.closest('.training-result-card');
    const applyBtn = card.querySelector('.training-apply-btn');
    const discardBtn = card.querySelector('.training-discard-btn');
    applyBtn.disabled = true;
    discardBtn.disabled = true;
    discardBtn.textContent = 'Discarding...';

    try {
      await window.trainingAPI.discard(characteristic, TrainingResults.runId);
      discardBtn.textContent = 'Discarded';
      card.classList.add('discarded');
    } catch (e) {
      applyBtn.disabled = false;
      discardBtn.disabled = false;
      discardBtn.textContent = 'Discard';
      alert(`Failed to discard ${characteristic}: ${e.message || e}`);
    }
  }
}
