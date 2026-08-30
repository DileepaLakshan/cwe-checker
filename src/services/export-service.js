/**
 * Export Service - Builds CSV/PDF report content and hands it to the main
 * process (via window.exportAPI) to save to disk.
 */
import { getLastScanResult } from '../state/ide-state.js';
import { MlResultsPanel } from '../components/ml-results/ml-results-panel.js';
import { StatusBar } from '../components/status-bar/status-bar.js';

function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields) {
  return fields.map(csvEscape).join(',') + '\r\n';
}

function buildScanFindingsCsv(scanResult) {
  let csv = toCsvRow(['Source', 'CWE', 'Severity', 'Location', 'Details']);

  for (const hit of scanResult.sastFindings || []) {
    csv += toCsvRow([
      'SAST (OpenGrep)',
      hit.CweID,
      (hit.extra?.severity || 'WARNING').toUpperCase(),
      `${hit.path}:${hit.start?.line ?? ''}`,
      hit.extra?.message || hit.check_id || ''
    ]);
  }

  for (const vuln of scanResult.scaFindings || []) {
    csv += toCsvRow([
      'SCA (Trivy)',
      vuln.CweID,
      (vuln.Severity || 'UNKNOWN').toUpperCase(),
      `${vuln.PkgName || ''}@${vuln.InstalledVersion || ''}`,
      vuln.Title || vuln.Description || ''
    ]);
  }

  return csv;
}

export async function exportScanFindingsCsv() {
  const scanResult = getLastScanResult();
  if (!scanResult) {
    alert('Run a scan first — there are no findings to export yet.');
    return;
  }

  const csv = buildScanFindingsCsv(scanResult);
  const defaultFileName = `${scanResult.projectName || 'scan'}-findings-${new Date(scanResult.timestamp).toISOString().slice(0, 10)}.csv`;

  StatusBar.updateMode('Exporting CSV...');
  try {
    const result = await window.exportAPI.exportCSV(csv, defaultFileName);
    if (result) {
      StatusBar.updateMode('CSV exported');
      alert(`Findings exported to:\n${result.path}`);
    } else {
      StatusBar.updateMode('Scan complete');
    }
  } catch (err) {
    console.error('CSV export failed:', err);
    StatusBar.updateMode('CSV export failed', true);
    alert('Export failed: ' + (err.message || err));
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildTqiReportHtml(scanResult, models, predictions) {
  const { finalTqi, mathString } = MlResultsPanel.calculateTqi(models, predictions);
  const { impacts: charImpacts } = MlResultsPanel.computeCharacteristicImpact(models, predictions);
  const { impacts: cweImpacts } = MlResultsPanel.computeCweImpact(models, predictions);
  const topCweImpacts = cweImpacts.filter(i => i.delta > 0.0001).slice(0, 10);

  const projectName = scanResult?.projectName || 'Unknown project';
  const generatedAt = new Date().toLocaleString();
  const sastCount = scanResult?.sastFindings?.length ?? 0;
  const scaCount = scanResult?.scaFindings?.length ?? 0;

  const characteristicRows = models.map(m => {
    const data = predictions[m];
    if (data.error) return `<tr><td>${escapeHtml(m)}</td><td colspan="2">Error: ${escapeHtml(data.error)}</td></tr>`;
    const modelScore = MlResultsPanel.getModelScore(m, predictions);
    const charScore = 100 * Math.exp(-modelScore / 8);
    const weight = MlResultsPanel.mlWeights[m] !== undefined ? MlResultsPanel.mlWeights[m] : 1.0;
    return `
      <tr>
        <td>${escapeHtml(m)}</td>
        <td>${charScore.toFixed(2)} / 100</td>
        <td>${weight.toFixed(1)}&times;</td>
      </tr>
    `;
  }).join('');

  const contributionRows = charImpacts.filter(i => i.delta > 0.0001).map(i => `
    <tr>
      <td>${escapeHtml(i.name)}</td>
      <td>+${i.delta.toFixed(2)} TQI</td>
    </tr>
  `).join('') || '<tr><td colspan="2">No characteristic is currently reducing TQI.</td></tr>';

  const priorityRows = topCweImpacts.map((item, idx) => `
    <tr>
      <td>#${idx + 1}</td>
      <td>${escapeHtml(item.cwe)}</td>
      <td>+${item.delta.toFixed(2)} TQI</td>
      <td>${item.affectedModels.map(escapeHtml).join(', ')}</td>
    </tr>
  `).join('') || '<tr><td colspan="4">No CWE is currently reducing TQI enough to prioritize.</td></tr>';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>CWE Checker Report - ${escapeHtml(projectName)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #ffffff; margin: 32px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .subtitle { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  .tqi-banner { display: flex; align-items: center; gap: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
  .tqi-score { font-size: 42px; font-weight: 700; color: #16a34a; }
  .tqi-label { font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
  .tqi-math { font-family: 'Consolas', monospace; font-size: 11px; color: #475569; word-break: break-word; }
  .summary-badges { display: flex; gap: 12px; margin-bottom: 28px; }
  .badge { background: #eef2ff; color: #4338ca; padding: 6px 14px; border-radius: 16px; font-size: 13px; font-weight: 600; }
  h2 { font-size: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
  th { color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.03em; }
  footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <h1>CWE Checker — Quality Report</h1>
  <div class="subtitle">${escapeHtml(projectName)} &middot; generated ${escapeHtml(generatedAt)}</div>

  <div class="tqi-banner">
    <div>
      <div class="tqi-label">Total Quality Index</div>
      <div class="tqi-score">${finalTqi}</div>
    </div>
    <div class="tqi-math">${escapeHtml(mathString)}</div>
  </div>

  <div class="summary-badges">
    <span class="badge">${sastCount} source code (SAST) findings</span>
    <span class="badge">${scaCount} dependency (SCA) findings</span>
  </div>

  <h2>Quality Characteristic Breakdown</h2>
  <table>
    <thead><tr><th>Characteristic</th><th>Score</th><th>Weight</th></tr></thead>
    <tbody>${characteristicRows}</tbody>
  </table>

  <h2>Contributions to Lost TQI, by Characteristic</h2>
  <table>
    <thead><tr><th>Characteristic</th><th>Potential TQI gain if fully remediated</th></tr></thead>
    <tbody>${contributionRows}</tbody>
  </table>

  <h2>Fix Priority — Top CWEs by TQI Impact</h2>
  <table>
    <thead><tr><th>Rank</th><th>CWE</th><th>TQI Gain</th><th>Affects</th></tr></thead>
    <tbody>${priorityRows}</tbody>
  </table>

  <footer>Generated by CWE Checker</footer>
</body>
</html>`;
}

export async function exportTqiReport(models, predictions) {
  const scanResult = getLastScanResult();
  const html = buildTqiReportHtml(scanResult, models, predictions);
  const projectName = scanResult?.projectName || 'project';
  const defaultFileName = `${projectName}-quality-report-${new Date().toISOString().slice(0, 10)}.pdf`;

  StatusBar.updateMode('Exporting report...');
  try {
    const result = await window.exportAPI.exportPDF(html, defaultFileName);
    if (result) {
      StatusBar.updateMode('Report exported');
      alert(`Report exported to:\n${result.path}`);
    } else {
      StatusBar.updateMode('Scan complete');
    }
  } catch (err) {
    console.error('PDF export failed:', err);
    StatusBar.updateMode('Report export failed', true);
    alert('Export failed: ' + (err.message || err));
  }
}
