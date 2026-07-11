/**
 * Scan Results Panel Component
 */
export class ScanResultsPanel {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
    this.attachEventListeners();
  }

  static getTemplate() {
    return `
      <div class="scan-results-panel" id="scan-results-panel" style="display: none;">
        <div class="results-header">
          <h2>Scan Results</h2>
          <button id="btn-close-results" class="btn-secondary">Close Results</button>
        </div>
        
        <div id="scan-loading-container" style="display: none; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px;">
          <span class="scan-spinner"></span>
          <p style="margin-top: 24px; color: hsl(var(--text-muted)); font-size: 15px; font-weight: 500;">Scanning project for vulnerabilities...</p>
        </div>

        <div id="scan-content-container" style="display: none;">
          <div class="results-summary" id="results-summary"></div>

          <div class="results-section">
            <h3>Source Code CWEs (OpenGrep)</h3>
            <div id="sast-results-container" class="results-list"></div>
          </div>

          <div class="results-section">
            <h3>Dependency CWEs (Trivy)</h3>
            <div id="sca-results-container" class="results-list"></div>
          </div>

          <div class="results-section">
            <h3>Located CWE Source Matches</h3>
            <div id="cwe-location-results-container" class="results-list"></div>
          </div>
        </div>
      </div>
    `;
  }

  static attachEventListeners() {
    document.getElementById('btn-close-results')?.addEventListener('click', () => {
      window.EventBus?.emit('view:showWelcome');
    });
  }

  static show() {
    const panel = document.getElementById('scan-results-panel');
    if (panel) panel.style.display = 'block';
  }

  static hide() {
    const panel = document.getElementById('scan-results-panel');
    if (panel) panel.style.display = 'none';
  }

  static showLoading() {
    const loadingContainer = document.getElementById('scan-loading-container');
    const contentContainer = document.getElementById('scan-content-container');
    if (loadingContainer) loadingContainer.style.display = 'flex';
    if (contentContainer) contentContainer.style.display = 'none';
  }

  static hideLoading() {
    const loadingContainer = document.getElementById('scan-loading-container');
    const contentContainer = document.getElementById('scan-content-container');
    if (loadingContainer) loadingContainer.style.display = 'none';
    if (contentContainer) contentContainer.style.display = 'block';
  }

  static updateSummary(sastCount, scaCount) {
    const summary = document.getElementById('results-summary');
    if (summary) {
      summary.innerHTML = `
        <span class="badge">OpenGrep CWE Findings: ${sastCount}</span>
        <span class="badge">Trivy CWE Issues: ${scaCount}</span>
      `;
    }
  }

  static renderSASTResults(cweIssues) {
    const container = document.getElementById('sast-results-container');
    if (!container) return;

    if (cweIssues.length === 0) {
      container.innerHTML = '<div class="no-issues">No source code CWE findings found!</div>';
      return;
    }

    container.innerHTML = cweIssues.map(hit => `
      <div class="result-card sast-card">
        <div class="card-header">
          <span class="severity warning">Warning</span>
          <span class="vuln-id">${hit.CweID}</span>
        </div>
        <p class="file-path">File: ${hit.path} (Line: ${hit.start?.line || 'unknown'})</p>
        <p class="vuln-desc"><b>Reason:</b> ${hit.extra?.message || 'No reason provided by the OpenGrep rule.'}</p>
        <p class="vuln-desc"><b>Rule:</b> ${hit.check_id}</p>
      </div>
    `).join('');
  }

  static renderSCAResults(cweIssues, totalVulnerabilities = 0) {
    const container = document.getElementById('sca-results-container');
    if (!container) return;

    if (cweIssues.length === 0) {
      container.innerHTML = `<div class="no-issues">${
        totalVulnerabilities === 0
          ? 'No dependency CWE issues found!'
          : `Trivy found ${totalVulnerabilities} dependency vulnerabilities, but no CWE mappings were included.`
      }</div>`;
      return;
    }

    container.innerHTML = cweIssues.map(vuln => `
      <div class="result-card sca-card">
        <div class="card-header">
          <span class="severity ${vuln.Severity ? vuln.Severity.toLowerCase() : 'low'}">${vuln.Severity || 'UNKNOWN'}</span>
          <span class="vuln-id">${vuln.CweID}</span>
        </div>
        <p class="file-path">Package: <b>${vuln.PkgName}</b> (Installed: ${vuln.InstalledVersion})</p>
        <p class="vuln-desc"><b>Reason:</b> ${vuln.Title || vuln.Description || 'No reason provided by Trivy.'}</p>
        <p class="vuln-desc"><b>Fixed version:</b> ${vuln.FixedVersion || 'Not available'}</p>
        <p class="vuln-desc"><b>Source vulnerability:</b> ${vuln.VulnerabilityID || 'Not available'}</p>
      </div>
    `).join('');
  }

  static renderCWELocations(html) {
    const container = document.getElementById('cwe-location-results-container');
    if (container) container.innerHTML = html;
  }
}