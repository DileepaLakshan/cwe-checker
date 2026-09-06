/**
 * Sidebar Component
 */
export class Sidebar {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
    this.attachEventListeners();
  }

  static getTemplate() {
    return `
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <span>MY PROJECT FILES</span>
          <div class="sidebar-actions" id="sidebar-actions">
            <button title="New File" id="action-new-file">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <path d="M9 15h6"/>
              </svg>
            </button>
            <button title="New Folder" id="action-new-folder">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
                <path d="M12 10v6"/>
                <path d="M9 13h6"/>
              </svg>
            </button>
            <button title="Collapse All" id="action-collapse-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="sidebar-content">
          <div class="no-folder-state" id="no-folder-state">
            <div class="no-folder-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
              </svg>
            </div>
            <p>No folder opened</p>
            <button class="btn btn-primary" id="btn-open-folder">Open Folder</button>
          </div>
          <div class="workspace-header" id="workspace-header" style="display: none;">
            <span id="workspace-name">WORKSPACE</span>
          </div>
          <div class="file-tree" id="file-tree" style="display: none;"></div>
        </div>
      </div>
    `;
  }

  static attachEventListeners() {
    const eventBus = window.EventBus;
    if (!eventBus) return;

    document.getElementById('btn-open-folder')?.addEventListener('click', () => {
      eventBus.emit('folder:open');
    });

    document.getElementById('action-new-file')?.addEventListener('click', () => {
      eventBus.emit('file:create', { type: 'file' });
    });

    document.getElementById('action-new-folder')?.addEventListener('click', () => {
      eventBus.emit('file:create', { type: 'folder' });
    });

    document.getElementById('action-collapse-all')?.addEventListener('click', () => {
      eventBus.emit('filetree:collapseAll');
    });
  }
}