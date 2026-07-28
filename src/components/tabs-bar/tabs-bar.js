/**
 * Tabs Bar Component
 */
export class TabsBar {
  static init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = this.getTemplate();
  }

  static getTemplate() {
    return `
      <div class="tabs-bar" id="tabs-bar"></div>
    `;
  }

  static render(tabs, activeTab) {
    const container = document.getElementById('tabs-bar');
    if (!container) return;
    
    container.innerHTML = '';
    
    tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${activeTab === tab.path ? 'active' : ''}`;
      tabEl.setAttribute('data-path', tab.path);
      
      tabEl.innerHTML = `
        <span class="tab-title" title="${tab.path}">${tab.name}</span>
        ${tab.isDirty ? '<span class="tab-dirty-dot"></span>' : ''}
        <span class="tab-close">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </span>
      `;
      
      container.appendChild(tabEl);
    });
  }
}