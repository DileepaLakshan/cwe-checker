/**
 * Legacy Results Panel Component
 */
export class ResultsPanelLegacy {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
    this.attachEventListeners();
  }

  static getTemplate() {
    return `
      <div class="results-panel" id="results-panel">
        <div class="results-header">
          <h2>Scan Results</h2>
          <button class="back-btn" id="backToWelcomeBtn">← Back to Editor</button>
        </div>
        <div class="results-tabs">
          <button class="result-tab active" id="tab-sast">SAST (Semgrep-style)</button>
          <button class="result-tab" id="tab-sca">SCA (Trivy-style)</button>
        </div>
        <div id="results-content">
          <!-- dynamic results inserted here -->
        </div>
      </div>
    `;
  }

  static attachEventListeners() {
    document.getElementById('backToWelcomeBtn')?.addEventListener('click', () => {
      window.EventBus?.emit('view:showWelcome');
    });

    document.getElementById('tab-sast')?.addEventListener('click', () => {
      window.EventBus?.emit('results:switchTab', { tab: 'sast' });
    });

    document.getElementById('tab-sca')?.addEventListener('click', () => {
      window.EventBus?.emit('results:switchTab', { tab: 'sca' });
    });
  }

  static show() {
    const panel = document.getElementById('results-panel');
    if (panel) panel.style.display = 'block';
  }

  static hide() {
    const panel = document.getElementById('results-panel');
    if (panel) panel.style.display = 'none';
  }
}