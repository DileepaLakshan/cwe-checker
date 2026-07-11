/**
 * Tab bar component
 */
import { getDOM } from '../utils/dom-references';
import { getActiveTab, getOpenTabs } from '../state/ide-state';
import { switchTab, closeTab } from '../services/editor-service';

export function renderTabs() {
  const tabsBar = getDOM().tabsBar;
  if (!tabsBar) return;
  tabsBar.innerHTML = '';

  const openTabs = getOpenTabs();
  
  if (openTabs.length === 0) {
    showWelcomeScreen();
    return;
  }

  const activeTab = getActiveTab();
  if (activeTab === '__SCAN_RESULTS__') {
    showScanResultsScreen();
  } else {
    showEditorScreen();
  }
  
  openTabs.forEach(tab => {
    const tabItem = createTabElement(tab, activeTab);
    tabsBar.appendChild(tabItem);
  });
}

function createTabElement(tab, activeTab) {
  const tabItem = document.createElement('div');
  tabItem.className = `tab-item ${activeTab === tab.path ? 'active' : ''}`;
  tabItem.setAttribute('data-path', tab.path);

  // Tab title
  const title = document.createElement('span');
  title.className = 'tab-title';
  title.innerText = tab.name;
  title.title = tab.path;
  tabItem.appendChild(title);

  // Dirty indicator
  if (tab.isDirty) {
    const dot = document.createElement('span');
    dot.className = 'tab-dirty-dot';
    tabItem.appendChild(dot);
  }

  // Close button
  const closeBtn = document.createElement('span');
  closeBtn.className = 'tab-close';
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
  
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab.path, e);
  });
  tabItem.appendChild(closeBtn);

  // Click to switch
  tabItem.addEventListener('click', () => switchTab(tab.path));

  return tabItem;
}

function showWelcomeScreen() {
  const dom = getDOM();
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'flex';
  if (dom.editorPanel) dom.editorPanel.style.display = 'none';
  if (dom.resultsPanel) dom.resultsPanel.style.display = 'none';
  if (dom.statusLineCol) dom.statusLineCol.style.display = 'none';
  if (dom.statusSaveBtn) dom.statusSaveBtn.style.display = 'none';
}

function showEditorScreen() {
  const dom = getDOM();
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
  if (dom.resultsPanel) dom.resultsPanel.style.display = 'none';
  if (dom.editorPanel) dom.editorPanel.style.display = 'flex';
  if (dom.statusLineCol) dom.statusLineCol.style.display = 'flex';
  if (dom.statusSaveBtn) dom.statusSaveBtn.style.display = 'flex';
}

export function showScanResultsScreen() {
  const dom = getDOM();
  if (dom.welcomeScreen) dom.welcomeScreen.style.display = 'none';
  if (dom.editorPanel) dom.editorPanel.style.display = 'none';
  if (dom.resultsPanel) dom.resultsPanel.style.display = 'block';
  if (dom.statusLineCol) dom.statusLineCol.style.display = 'none';
  if (dom.statusSaveBtn) dom.statusSaveBtn.style.display = 'none';
}