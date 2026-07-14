/**
 * Code editor management service
 */
import { getDOM } from '../utils/dom-references';
import { 
  getActiveTab, setActiveTab, getOpenTabs, addTab, removeTab, 
  findTab, findTabIndex, getCurrentWorkspace 
} from '../state/ide-state';
import { showStatusBarMessage } from '../utils/status-bar';
import { renderTabs } from '../components/tabs';
import { updateLineNumbers, updateLineCol, scrollToLine } from '../utils/editor-utils';

export async function openFile(filePath, lineNumber = null, highlight = false) {
  const existingTab = findTab(filePath);
  if (existingTab) {
    switchTab(filePath);
    if (lineNumber) {
      scrollToLine(lineNumber, highlight);
    }
    return;
  }

  try {
    const content = await window.api.readFile(filePath);
    const basename = filePath.substring(
      Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')) + 1
    );

    const newTab = {
      path: filePath,
      name: basename,
      content: content,
      originalContent: content,
      isDirty: false
    };

    addTab(newTab);
    setActiveTab(filePath);

    const { codeTextarea, lineNumbersContainer } = getDOM();
    if (!codeTextarea || !lineNumbersContainer) {
      console.error('editor-service.openFile: missing editor DOM elements', { codeTextarea, lineNumbersContainer });
      return;
    }
    codeTextarea.value = content;
    updateLineNumbers();
    updateLineCol();
    
    // Reset scrolls
    codeTextarea.scrollTop = 0;
    lineNumbersContainer.scrollTop = 0;

    // Update active highlight in side list
    highlightActiveFileInTree(filePath);
    renderTabs();
    
    if (lineNumber) {
      scrollToLine(lineNumber, highlight);
    }
    codeTextarea.focus();
  } catch (err) {
    showStatusBarMessage('Failed to open file: ' + err.message, true);
  }
}

export function openFileInEditor(filePath, lineNumber = null, highlight = false) {
  return openFile(filePath, lineNumber, highlight);
}

export function switchTab(filePath) {
  const activeTab = getActiveTab();
  if (activeTab === filePath) return;

  // Cache current text in active tab before switching
  if (activeTab && activeTab !== '__SCAN_RESULTS__') {
    const prevTab = findTab(activeTab);
    if (prevTab && getDOM().codeTextarea) {
      prevTab.content = getDOM().codeTextarea.value;
    }
  }

  setActiveTab(filePath);
  
  if (filePath === '__SCAN_RESULTS__' || filePath === '__ML_RESULTS__') {
    // UI rendering is handled by renderTabs()
  } else {
    const nextTab = findTab(filePath);
    if (nextTab) {
      const { codeTextarea, lineNumbersContainer } = getDOM();
      if (codeTextarea) {
        codeTextarea.value = nextTab.content;
        updateLineNumbers();
        updateLineCol();

        // Reset scrolls
        codeTextarea.scrollTop = 0;
        if (lineNumbersContainer) lineNumbersContainer.scrollTop = 0;

        // Update breadcrumbs
        updateBreadcrumbs(filePath);

        // Sidebar highlight sync
        highlightActiveFileInTree(filePath);
      }
    }
  }

  renderTabs();
  const textarea = getDOM().codeTextarea;
  if (textarea && filePath !== '__SCAN_RESULTS__' && filePath !== '__ML_RESULTS__') textarea.focus();
}

export function openScanResultsTab() {
  const path = '__SCAN_RESULTS__';
  const existingTab = findTab(path);
  if (existingTab) {
    switchTab(path);
    return;
  }

  const newTab = {
    path: path,
    name: 'Scan Results',
    content: '',
    originalContent: '',
    isDirty: false
  };

  addTab(newTab);
  switchTab(path);
}

export async function closeTab(filePath, event, forceClose = false) {
  if (event) event.stopPropagation();

  const tabIndex = findTabIndex(filePath);
  if (tabIndex === -1) return;

  const targetTab = getOpenTabs()[tabIndex];
  if (targetTab.isDirty && !forceClose) {
    const confirmDiscard = confirm(`Discard unsaved changes for "${targetTab.name}"?`);
    if (!confirmDiscard) return;
  }

  removeTab(tabIndex);
  const activeTab = getActiveTab();

  if (activeTab === filePath) {
    const openTabs = getOpenTabs();
    if (openTabs.length > 0) {
      const nextIndex = Math.min(tabIndex, openTabs.length - 1);
      setActiveTab(null); // Nullify to prevent autosaving
      switchTab(openTabs[nextIndex].path);
    } else {
      setActiveTab(null);
    }
  }

  renderTabs();
}

export async function saveCurrentFile() {
  const activeTab = getActiveTab();
  if (!activeTab) return;
  
  const tab = findTab(activeTab);
  if (!tab) return;

  // Sync latest input
  tab.content = getDOM().codeTextarea.value;

  const modeEl = document.getElementById('status-mode');
  modeEl.innerHTML = '<span class="status-dot saving"></span> Saving...';

  try {
    await window.api.saveFile(tab.path, tab.content);
    tab.originalContent = tab.content;
    tab.isDirty = false;

    showStatusBarMessage('File saved successfully');
    renderTabs();
  } catch (err) {
    showStatusBarMessage('Save failed: ' + err.message, true);
    modeEl.innerHTML = '<span class="status-dot error"></span> Save Error';
  }
}

function updateBreadcrumbs(filePath) {
  const crumbs = getDOM().editorBreadcrumbs;
  const workspace = getCurrentWorkspace();
  
  if (crumbs && workspace) {
    const relPath = filePath.replace(workspace.path, '');
    const segments = relPath.split(/[\\\/]/).filter(Boolean);
    crumbs.innerHTML = `
      <span class="breadcrumb-item">${workspace.name}</span>
      ${segments.map((s, idx) => `
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item ${idx === segments.length - 1 ? 'active' : ''}">${s}</span>
      `).join('')}
    `;
  }
}

function highlightActiveFileInTree(filePath) {
  document.querySelectorAll('.tree-node.active').forEach(node => node.classList.remove('active'));
  const treeNode = document.querySelector(`.tree-node[data-path="${CSS.escape(filePath)}"]`);
  if (treeNode) {
    treeNode.classList.add('active');
  }
}