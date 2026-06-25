/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

// IDE State variables
let currentWorkspace = null;
let activeTab = null;
let openTabs = []; // { path, name, content, originalContent, isDirty }
let activeFolderPath = null; // tracking clicked folders for creation context

// DOM elements initialized on load
let codeTextarea;
let lineNumbers;
let lineNumbersContainer;

window.addEventListener('DOMContentLoaded', () => {
  codeTextarea = document.getElementById('code-textarea');
  lineNumbers = document.getElementById('line-numbers');
  lineNumbersContainer = document.querySelector('.line-numbers-container');

  // Welcome Screen actions
  document.getElementById('btn-open-folder').addEventListener('click', openDirectoryPicker);
  document.getElementById('welcome-open-folder').addEventListener('click', openDirectoryPicker);

  // Global header actions
  document.getElementById('action-new-file').addEventListener('click', () => showInlineInput('file'));
  document.getElementById('action-new-folder').addEventListener('click', () => showInlineInput('folder'));
  document.getElementById('action-collapse-all').addEventListener('click', collapseAllFolders);

  // Save button in status bar
  document.getElementById('btn-save-file').addEventListener('click', saveCurrentFile);

  // Textarea listeners
  codeTextarea.addEventListener('scroll', () => {
    lineNumbersContainer.scrollTop = codeTextarea.scrollTop;
  });

  codeTextarea.addEventListener('input', () => {
    if (activeTab) {
      const tabObj = openTabs.find(t => t.path === activeTab);
      if (tabObj) {
        tabObj.content = codeTextarea.value;
        const isDirtyNow = tabObj.content !== tabObj.originalContent;
        if (tabObj.isDirty !== isDirtyNow) {
          tabObj.isDirty = isDirtyNow;
          renderTabs();
        }
      }
    }
    updateLineNumbers();
    updateLineCol();
  });

  codeTextarea.addEventListener('keyup', updateLineCol);
  codeTextarea.addEventListener('click', updateLineCol);

  // Handle key combos (Tab indenting)
  codeTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeTextarea.selectionStart;
      const end = codeTextarea.selectionEnd;
      const val = codeTextarea.value;
      codeTextarea.value = val.substring(0, start) + '    ' + val.substring(end);
      codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 4;
      codeTextarea.dispatchEvent(new Event('input'));
    }
  });

  // Global Keydown shortcuts
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

    if (ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      openDirectoryPicker();
    } else if (ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentFile();
    } else if (ctrlKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (activeTab) {
        closeTab(activeTab);
      }
    } else if (ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (currentWorkspace) {
        showInlineInput('file');
      }
    }
  });

  // Theme & Settings toggle placeholders (micro-animations)
  document.getElementById('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    showStatusBarMessage(`Switched to ${isLight ? 'Light Theme' : 'Dark Theme'}`);
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    showStatusBarMessage('Settings loaded (Configured by cwe-checker)');
  });

  // Load recent workspaces
  renderRecentProjects();
});

document.getElementById('scanBtn').addEventListener('click', async () => {
  try {
    // 1. Ask the user which folder to scan
    const projectFolder = await window.scannerAPI.selectProject();
    
    if (!projectFolder) {
      console.log("User cancelled folder selection.");
      return;
    }

    console.log(`Starting scans on: ${projectFolder}...`);
    // NOTE: In a real app, you would show a loading spinner in the UI here

    // 2. Run both scans simultaneously using Promise.all for speed
    const [sastResults, scaResults] = await Promise.all([
      window.scannerAPI.runSAST(projectFolder),
      window.scannerAPI.runSCA(projectFolder)
    ]);

    // 3. Check your DevTools console to see the massive JSON output!
    console.log("SAST (OpenGrep) Results:", sastResults);
    console.log("SCA (Trivy) Results:", scaResults);

    // 4. Hide loading spinner and start mapping this data to your UI tables/charts

  } catch (error) {
    console.error("Scanning failed:", error);
  }
});
// ==========================================================================
// Folder Picker & Workspace Management
// ==========================================================================
async function openDirectoryPicker() {
  try {
    const res = await window.api.openDirectory();
    if (res) {
      await openWorkspace(res.path, res.name);
    }
  } catch (err) {
    showStatusBarMessage('Failed to open directory: ' + err.message, true);
  }
}

async function openWorkspace(dirPath, dirName) {
  currentWorkspace = { path: dirPath, name: dirName };
  activeFolderPath = dirPath;
  addRecentProject(dirPath, dirName);

  // Update layout components visibility
  document.getElementById('no-folder-state').style.display = 'none';
  document.getElementById('workspace-header').style.display = 'flex';
  document.getElementById('workspace-name').innerText = dirName.toUpperCase();
  document.getElementById('file-tree').style.display = 'block';
  document.getElementById('sidebar-actions').style.display = 'flex';
  document.getElementById('welcome-new-file').classList.remove('disabled');

  // Status Bar
  document.getElementById('status-folder-path').innerText = dirPath;
  document.getElementById('status-folder-path').title = dirPath;

  // Clear previous session tabs & load new tree
  openTabs = [];
  activeTab = null;
  renderTabs();

  const fileTreeRoot = document.getElementById('file-tree');
  await loadDirectoryChildren(dirPath, fileTreeRoot);

  showStatusBarMessage(`Opened Workspace: ${dirName}`);
}

function collapseAllFolders() {
  if (!currentWorkspace) return;
  document.querySelectorAll('.tree-children').forEach(childContainer => {
    childContainer.classList.add('hidden');
  });
  document.querySelectorAll('.chevron').forEach(chevron => {
    chevron.classList.remove('open');
  });
  activeFolderPath = currentWorkspace.path;
  showStatusBarMessage('Collapsed all folders');
}

// ==========================================================================
// File Tree Rendering & Lazy Loading
// ==========================================================================
async function loadDirectoryChildren(dirPath, containerEl) {
  try {
    containerEl.innerHTML = '<div style="padding: 6px 16px; font-size: 12px; color: hsl(var(--text-muted)); font-style: italic;">Loading...</div>';
    const entries = await window.api.readDirectory(dirPath);
    containerEl.innerHTML = '';

    if (entries.length === 0) {
      containerEl.innerHTML = '<div style="padding: 6px 16px; font-size: 12px; color: hsl(var(--text-muted)); font-style: italic;">(Empty Directory)</div>';
      return;
    }

    // Indent node based on depth level relative to workspace path
    const relativePath = dirPath.replace(currentWorkspace.path, '');
    const depth = relativePath.split(/[\\\/]/).filter(Boolean).length;
    const paddingLeft = 16 + depth * 12;

    entries.forEach(entry => {
      const nodeWrapper = document.createElement('div');
      nodeWrapper.className = 'tree-node-wrapper';

      const fileExt = entry.isDirectory ? '' : entry.name.split('.').pop().toLowerCase();
      const fileClass = entry.isDirectory ? 'node-icon-folder' : `node-icon-file ext-${fileExt}`;
      
      const fileIcon = entry.isDirectory
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="node-icon ${fileClass}"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="node-icon ${fileClass}"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;

      const chevronIcon = entry.isDirectory
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chevron"><path d="m9 18 6-6-6-6"/></svg>`
        : `<span style="width: 12px; display: inline-block;"></span>`;

      nodeWrapper.innerHTML = `
        <div class="tree-node ${activeTab === entry.path ? 'active' : ''}" data-path="${entry.path}" data-isdir="${entry.isDirectory}" style="padding-left: ${paddingLeft}px">
          <div class="node-content">
            ${chevronIcon}
            ${fileIcon}
            <span class="node-label">${entry.name}</span>
          </div>
          <div class="node-actions">
            ${entry.isDirectory ? `
              <button class="node-action-new-file" title="New File">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 12v6"/></svg>
              </button>
              <button class="node-action-new-folder" title="New Folder">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>
              </button>
            ` : ''}
            <button class="node-action-delete" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${entry.isDirectory ? `<div class="tree-children hidden" data-parent-path="${entry.path}"></div>` : ''}
      `;

      // Event listeners for actions buttons
      const newFileBtn = nodeWrapper.querySelector('.node-action-new-file');
      if (newFileBtn) {
        newFileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showInlineInput('file', entry.path);
        });
      }

      const newFolderBtn = nodeWrapper.querySelector('.node-action-new-folder');
      if (newFolderBtn) {
        newFolderBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showInlineInput('folder', entry.path);
        });
      }

      const deleteBtn = nodeWrapper.querySelector('.node-action-delete');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteItem(entry.path, entry.name, entry.isDirectory);
        });
      }

      // Main click listener for expanding or opening files
      const nodeEl = nodeWrapper.querySelector('.tree-node');
      nodeEl.addEventListener('click', () => {
        if (entry.isDirectory) {
          toggleFolderNode(nodeEl);
        } else {
          document.querySelectorAll('.tree-node.active').forEach(el => el.classList.remove('active'));
          nodeEl.classList.add('active');
          openFile(entry.path);
        }
      });

      containerEl.appendChild(nodeWrapper);
    });
  } catch (err) {
    containerEl.innerHTML = `<div style="padding: 6px 16px; font-size: 12px; color: hsl(var(--accent-red)); font-style: italic;">Error: ${err.message}</div>`;
  }
}

async function toggleFolderNode(nodeEl) {
  const dirPath = nodeEl.getAttribute('data-path');
  const chevron = nodeEl.querySelector('.chevron');
  const childrenContainer = nodeEl.nextElementSibling;

  if (!childrenContainer) return;

  if (childrenContainer.classList.contains('hidden')) {
    childrenContainer.classList.remove('hidden');
    chevron.classList.add('open');
    activeFolderPath = dirPath; // Set clicked folder as creation target

    if (childrenContainer.children.length === 0) {
      await loadDirectoryChildren(dirPath, childrenContainer);
    }
  } else {
    childrenContainer.classList.add('hidden');
    chevron.classList.remove('open');
  }
}

async function refreshDirectoryNode(dirPath) {
  if (dirPath === currentWorkspace.path) {
    const rootContainer = document.getElementById('file-tree');
    await loadDirectoryChildren(dirPath, rootContainer);
  } else {
    const parentNode = document.querySelector(`.tree-node[data-path="${CSS.escape(dirPath)}"]`);
    if (parentNode) {
      const childrenContainer = parentNode.nextElementSibling;
      if (childrenContainer) {
        await loadDirectoryChildren(dirPath, childrenContainer);
      }
    }
  }
}

// ==========================================================================
// File Creation & Deletion
// ==========================================================================
function showInlineInput(type, parentPath) {
  if (!currentWorkspace) return;
  const targetParent = parentPath || activeFolderPath || currentWorkspace.path;

  // Make sure parent is expanded
  if (targetParent !== currentWorkspace.path) {
    const parentNode = document.querySelector(`.tree-node[data-path="${CSS.escape(targetParent)}"]`);
    if (parentNode) {
      const chevron = parentNode.querySelector('.chevron');
      const childrenContainer = parentNode.nextElementSibling;
      if (childrenContainer && childrenContainer.classList.contains('hidden')) {
        childrenContainer.classList.remove('hidden');
        chevron.classList.add('open');
      }
    }
  }

  // Prevent multiple inputs
  if (document.getElementById('inline-creator-input')) return;

  const container = targetParent === currentWorkspace.path
    ? document.getElementById('file-tree')
    : document.querySelector(`.tree-children[data-parent-path="${CSS.escape(targetParent)}"]`);

  if (!container) return;

  const inputDiv = document.createElement('div');
  inputDiv.className = 'inline-input-container';
  const depth = targetParent === currentWorkspace.path ? 0 : (targetParent.replace(currentWorkspace.path, '').split(/[\\\/]/).filter(Boolean)).length + 1;
  inputDiv.style.paddingLeft = `${16 + depth * 12}px`;

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'inline-input';
  inputEl.id = 'inline-creator-input';
  inputEl.placeholder = type === 'file' ? 'File name' : 'Folder name';

  inputDiv.appendChild(inputEl);

  if (container.firstChild) {
    container.insertBefore(inputDiv, container.firstChild);
  } else {
    container.appendChild(inputDiv);
  }

  inputEl.focus();

  const processCreation = async () => {
    const name = inputEl.value.trim();
    if (!name) {
      inputDiv.remove();
      return;
    }

    if (/[\/\\:*?"<>|]/.test(name)) {
      showStatusBarMessage('Invalid characters in file name', true);
      inputDiv.remove();
      return;
    }

    const separator = targetParent.endsWith('\\') || targetParent.endsWith('/') ? '' : '\\';
    const newPath = targetParent + separator + name;

    try {
      if (type === 'file') {
        await window.api.createFile(newPath);
        showStatusBarMessage(`Created file: ${name}`);
        await refreshDirectoryNode(targetParent);
        await openFile(newPath);
      } else {
        await window.api.createDirectory(newPath);
        showStatusBarMessage(`Created directory: ${name}`);
        await refreshDirectoryNode(targetParent);
      }
    } catch (err) {
      showStatusBarMessage(err.message || 'Error creating entry', true);
    } finally {
      if (inputDiv.parentNode) inputDiv.remove();
    }
  };

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      processCreation();
    } else if (e.key === 'Escape') {
      inputDiv.remove();
    }
  });

  inputEl.addEventListener('blur', () => {
    setTimeout(() => {
      if (document.body.contains(inputDiv)) {
        inputDiv.remove();
      }
    }, 150);
  });
}

async function deleteItem(targetPath, name, isDirectory) {
  const label = isDirectory ? 'folder' : 'file';
  const confirmResult = confirm(`Are you sure you want to delete the ${label} "${name}"?`);
  if (!confirmResult) return;

  try {
    await window.api.deletePath(targetPath);
    showStatusBarMessage(`Deleted: ${name}`);

    // If it's a file, close its tab. If folder, close any child tabs.
    if (!isDirectory) {
      closeTab(targetPath, null, true);
    } else {
      const normalizedPath = targetPath.endsWith('\\') || targetPath.endsWith('/') ? targetPath : targetPath + '\\';
      const childTabs = openTabs.filter(t => t.path.startsWith(normalizedPath) || t.path.startsWith(targetPath + '/'));
      childTabs.forEach(t => closeTab(t.path, null, true));
    }

    // Refresh parents
    const separatorIdx = Math.max(targetPath.lastIndexOf('\\'), targetPath.lastIndexOf('/'));
    const parentPath = targetPath.substring(0, separatorIdx);
    await refreshDirectoryNode(parentPath);
  } catch (err) {
    showStatusBarMessage(err.message || 'Error deleting file', true);
  }
}

// ==========================================================================
// Tabs & Document Editor Handlers
// ==========================================================================
async function openFile(filePath) {
  const existingTab = openTabs.find(t => t.path === filePath);
  if (existingTab) {
    switchTab(filePath);
    return;
  }

  try {
    const content = await window.api.readFile(filePath);
    const basename = filePath.substring(Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/')) + 1);

    const newTab = {
      path: filePath,
      name: basename,
      content: content,
      originalContent: content,
      isDirty: false
    };

    openTabs.push(newTab);
    activeTab = filePath;

    // Load content in editor
    codeTextarea.value = content;
    updateLineNumbers();
    updateLineCol();
    
    // Reset scrolls
    codeTextarea.scrollTop = 0;
    lineNumbersContainer.scrollTop = 0;

    // Update active highlight in side list
    document.querySelectorAll('.tree-node.active').forEach(node => node.classList.remove('active'));
    const treeNode = document.querySelector(`.tree-node[data-path="${CSS.escape(filePath)}"]`);
    if (treeNode) {
      treeNode.classList.add('active');
    }

    renderTabs();
    codeTextarea.focus();
  } catch (err) {
    showStatusBarMessage('Failed to open file: ' + err.message, true);
  }
}

function switchTab(filePath) {
  if (activeTab === filePath) return;

  // Cache current text in active tab before switching
  if (activeTab) {
    const prevTab = openTabs.find(t => t.path === activeTab);
    if (prevTab) {
      prevTab.content = codeTextarea.value;
    }
  }

  activeTab = filePath;
  const nextTab = openTabs.find(t => t.path === filePath);

  if (nextTab) {
    codeTextarea.value = nextTab.content;
    updateLineNumbers();
    updateLineCol();

    // Reset scrolls
    codeTextarea.scrollTop = 0;
    lineNumbersContainer.scrollTop = 0;

    // Update breadcrumbs
    const crumbs = document.getElementById('editor-breadcrumbs');
    if (crumbs && currentWorkspace) {
      const relPath = filePath.replace(currentWorkspace.path, '');
      const segments = relPath.split(/[\\\/]/).filter(Boolean);
      crumbs.innerHTML = `
        <span class="breadcrumb-item">${currentWorkspace.name}</span>
        ${segments.map((s, idx) => `
          <span class="breadcrumb-separator">/</span>
          <span class="breadcrumb-item ${idx === segments.length - 1 ? 'active' : ''}">${s}</span>
        `).join('')}
      `;
    }

    // Sidebar highlight sync
    document.querySelectorAll('.tree-node.active').forEach(node => node.classList.remove('active'));
    const treeNode = document.querySelector(`.tree-node[data-path="${CSS.escape(filePath)}"]`);
    if (treeNode) {
      treeNode.classList.add('active');
    }
  }

  renderTabs();
  codeTextarea.focus();
}

async function closeTab(filePath, event, forceClose = false) {
  if (event) event.stopPropagation();

  const tabIndex = openTabs.findIndex(t => t.path === filePath);
  if (tabIndex === -1) return;

  const targetTab = openTabs[tabIndex];
  if (targetTab.isDirty && !forceClose) {
    const confirmDiscard = confirm(`Discard unsaved changes for "${targetTab.name}"?`);
    if (!confirmDiscard) return;
  }

  openTabs.splice(tabIndex, 1);

  if (activeTab === filePath) {
    if (openTabs.length > 0) {
      const nextIndex = Math.min(tabIndex, openTabs.length - 1);
      // Nullify activeTab to prevent autosaving state during close
      activeTab = null;
      switchTab(openTabs[nextIndex].path);
    } else {
      activeTab = null;
    }
  }

  renderTabs();
}

function renderTabs() {
  const tabsBar = document.getElementById('tabs-bar');
  if (!tabsBar) return;
  tabsBar.innerHTML = '';

  if (openTabs.length === 0) {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('code-editor-panel').style.display = 'none';
    document.getElementById('status-line-col').style.display = 'none';
    document.getElementById('status-save-btn').style.display = 'none';
    return;
  }

  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('code-editor-panel').style.display = 'flex';
  document.getElementById('status-line-col').style.display = 'flex';
  document.getElementById('status-save-btn').style.display = 'flex';

  openTabs.forEach(tab => {
    const tabItem = document.createElement('div');
    tabItem.className = `tab-item ${activeTab === tab.path ? 'active' : ''}`;
    tabItem.setAttribute('data-path', tab.path);

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.innerText = tab.name;
    title.title = tab.path;
    tabItem.appendChild(title);

    if (tab.isDirty) {
      const dot = document.createElement('span');
      dot.className = 'tab-dirty-dot';
      tabItem.appendChild(dot);
    }

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.path, e);
    });
    tabItem.appendChild(closeBtn);

    tabItem.addEventListener('click', () => switchTab(tab.path));

    tabsBar.appendChild(tabItem);
  });
}

async function saveCurrentFile() {
  if (!activeTab) return;
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;

  // Sync latest input
  tab.content = codeTextarea.value;

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

// ==========================================================================
// Status Bar & Utility Operations
// ==========================================================================
function updateLineNumbers() {
  if (!codeTextarea || !lineNumbers) return;
  const lines = codeTextarea.value.split('\n');
  const count = lines.length;

  let content = '';
  for (let i = 1; i <= count; i++) {
    content += i + '\n';
  }
  lineNumbers.innerText = content;
}

function updateLineCol() {
  const text = codeTextarea.value;
  const caret = codeTextarea.selectionStart;

  const upToCaret = text.substring(0, caret);
  const rows = upToCaret.split('\n');
  const ln = rows.length;
  const col = rows[rows.length - 1].length + 1;

  const lineColEl = document.getElementById('status-line-col');
  if (lineColEl) {
    lineColEl.innerText = `Ln ${ln}, Col ${col}`;
  }
}

function showStatusBarMessage(message, isError = false) {
  const modeEl = document.getElementById('status-mode');
  const dotColor = isError ? 'error' : 'ready';
  
  modeEl.innerHTML = `<span class="status-dot ${isError ? 'error' : ''}"></span> ${message}`;

  setTimeout(() => {
    if (modeEl.innerText.includes(message)) {
      modeEl.innerHTML = `<span class="status-dot"></span> Ready`;
    }
  }, 4000);
}

// ==========================================================================
// Local Storage Persistence (Recents)
// ==========================================================================
function getRecentProjects() {
  try {
    return JSON.parse(localStorage.getItem('recent_workspaces') || '[]');
  } catch {
    return [];
  }
}

function addRecentProject(dirPath, dirName) {
  let recents = getRecentProjects();
  recents = recents.filter(p => p.path !== dirPath);
  recents.unshift({ path: dirPath, name: dirName });
  if (recents.length > 5) recents.pop();
  localStorage.setItem('recent_workspaces', JSON.stringify(recents));
  renderRecentProjects();
}

function renderRecentProjects() {
  const recents = getRecentProjects();
  const listEl = document.getElementById('recent-projects-list');
  const sectionEl = document.getElementById('recent-section');

  if (recents.length === 0) {
    if (sectionEl) sectionEl.style.display = 'none';
    return;
  }

  if (sectionEl) sectionEl.style.display = 'block';

  listEl.innerHTML = recents.map(r => `
    <div class="recent-item" data-path="${r.path}">
      <span class="recent-item-name">${r.name}</span>
      <span class="recent-item-path" title="${r.path}">${r.path}</span>
    </div>
  `).join('');

  listEl.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      const path = item.getAttribute('data-path');
      const name = item.querySelector('.recent-item-name').innerText;
      openWorkspace(path, name);
    });
  });
}
