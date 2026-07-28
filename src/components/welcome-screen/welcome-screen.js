/**
 * Welcome Screen Component
 */
export class WelcomeScreen {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
    this.attachEventListeners();
  }

  static getTemplate() {
    return `
      <div class="welcome-screen" id="welcome-screen">
        <div class="welcome-logo">
          <span class="gradient-text">CWE-Checker</span>
        </div>
        <p class="welcome-subtitle">Static analysis workspace · SAST + SCA</p>
        <button id="scanBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          Select Project & Scan
        </button>
        <div class="welcome-sections">
          <div class="welcome-section">
            <h3>Start</h3>
            <div class="welcome-action-item" id="welcome-open-folder">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
              </svg>
              <span>Open Folder...</span>
            </div>
          </div>
          <div class="welcome-section">
            <h3>Recent</h3>
            <div id="recent-projects-list"></div>
          </div>
        </div>
        <div class="keyboard-shortcuts">
          <div class="shortcut-row"><span>Open Folder</span><span>Ctrl+O</span></div>
          <div class="shortcut-row"><span>Save File</span><span>Ctrl+S</span></div>
          <div class="shortcut-row"><span>New File</span><span>Ctrl+N</span></div>
          <div class="shortcut-row"><span>Close Tab</span><span>Ctrl+W</span></div>
        </div>
      </div>
    `;
  }

  static attachEventListeners() {
    document.getElementById('scanBtn')?.addEventListener('click', () => {
      window.EventBus?.emit('scan:start');
    });

    document.getElementById('welcome-open-folder')?.addEventListener('click', () => {
      console.log('welcome-screen: open folder clicked');
      window.EventBus?.emit('folder:open');
    });
  }

  static show() {
    const screen = document.getElementById('welcome-screen');
    if (screen) screen.style.display = 'flex';
  }

  static hide() {
    const screen = document.getElementById('welcome-screen');
    if (screen) screen.style.display = 'none';
  }
}