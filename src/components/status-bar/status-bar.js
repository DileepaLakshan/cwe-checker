/**
 * Status Bar Component
 */
export class StatusBar {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
  }

  static getTemplate() {
    return `
      <div class="status-bar">
        <div class="status-left">
          <span id="status-mode"><span class="status-dot"></span> Ready</span>
          <span id="status-folder-path">No Workspace</span>
        </div>
        <div class="status-right">
          <span id="status-line-col" style="display:none;">Ln 1, Col 1</span>
        </div>
      </div>
    `;
  }

  static updateFolderPath(path) {
    const el = document.getElementById('status-folder-path');
    if (el) {
      el.textContent = path;
      el.title = path;
    }
  }

  static updateMode(message, isError = false) {
    const el = document.getElementById('status-mode');
    if (el) {
      el.innerHTML = `<span class="status-dot ${isError ? 'error' : ''}"></span> ${message}`;
    }
  }

  static updateLineCol(line, col) {
    const el = document.getElementById('status-line-col');
    if (el) {
      el.style.display = 'flex';
      el.innerText = `Ln ${line}, Col ${col}`;
    }
  }

  static hideLineCol() {
    const el = document.getElementById('status-line-col');
    if (el) el.style.display = 'none';
  }
}