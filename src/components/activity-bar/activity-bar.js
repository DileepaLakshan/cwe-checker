/**
 * Activity Bar Component
 */
export class ActivityBar {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
    this.attachEventListeners(container);
  }

  static getTemplate() {
    return `
      <div class="activity-bar">
        <div class="top-icons">
          <button class="activity-btn active" title="Explorer" data-action="explorer">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M9 3v18"/>
            </svg>
          </button>
          <button class="activity-btn" title="Search" data-action="search">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </button>
          <button class="activity-btn" title="History & Compare" id="history-compare-btn" data-action="history">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
        </div>
        <div class="bottom-icons">
          <button class="activity-btn" title="Theme" data-action="theme">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  static attachEventListeners(container) {
    container.querySelectorAll('.activity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        // Handle different actions
        console.log(`Activity: ${action}`);
      });
    });
  }
}