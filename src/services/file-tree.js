/**
 * File tree rendering and management
 */
import { getDOM } from '../utils/dom-references';
import { getCurrentWorkspace, getActiveTab, setActiveFolderPath } from '../state/ide-state';
import { showStatusBarMessage } from '../utils/status-bar';
import { showInlineInput, deleteItem } from './file-operations';
import { openFile } from './editor-service';

export function collapseAllFolders() {
  const workspace = getCurrentWorkspace();
  if (!workspace) return;
  
  document.querySelectorAll('.tree-children').forEach(childContainer => {
    childContainer.classList.add('hidden');
  });
  document.querySelectorAll('.chevron').forEach(chevron => {
    chevron.classList.remove('open');
  });
  
  setActiveFolderPath(workspace.path);
  showStatusBarMessage('Collapsed all folders');
}

export async function loadDirectoryChildren(dirPath, containerEl) {
  try {
    containerEl.innerHTML = '<div style="padding: 6px 16px; font-size: 12px; color: hsl(var(--text-muted)); font-style: italic;">Loading...</div>';
    const entries = await window.api.readDirectory(dirPath);
    containerEl.innerHTML = '';

    if (entries.length === 0) {
      containerEl.innerHTML = '<div style="padding: 6px 16px; font-size: 12px; color: hsl(var(--text-muted)); font-style: italic;">(Empty Directory)</div>';
      return;
    }

    const workspace = getCurrentWorkspace();
    const relativePath = dirPath.replace(workspace.path, '');
    const depth = relativePath.split(/[\\\/]/).filter(Boolean).length;
    const paddingLeft = 16 + depth * 12;

    entries.forEach(entry => {
      const nodeWrapper = createTreeNodeElement(entry, dirPath, paddingLeft);
      containerEl.appendChild(nodeWrapper);
    });
  } catch (err) {
    containerEl.innerHTML = `<div style="padding: 6px 16px; font-size: 12px; color: hsl(var(--accent-red)); font-style: italic;">Error: ${err.message}</div>`;
  }
}

function createTreeNodeElement(entry, dirPath, paddingLeft) {
  const nodeWrapper = document.createElement('div');
  nodeWrapper.className = 'tree-node-wrapper';

  const fileExt = entry.isDirectory ? '' : entry.name.split('.').pop().toLowerCase();
  const fileClass = entry.isDirectory ? 'node-icon-folder' : `node-icon-file ext-${fileExt}`;
  const activeTab = getActiveTab();
  
  // Generate icons
  const fileIcon = getFileIcon(entry.isDirectory, fileClass);
  const chevronIcon = getChevronIcon(entry.isDirectory);

  nodeWrapper.innerHTML = `
    <div class="tree-node ${activeTab === entry.path ? 'active' : ''}" data-path="${entry.path}" data-isdir="${entry.isDirectory}" style="padding-left: ${paddingLeft}px">
      <div class="node-content">
        ${chevronIcon}
        ${fileIcon}
        <span class="node-label">${entry.name}</span>
      </div>
      <div class="node-actions">
        ${entry.isDirectory ? getDirectoryActionButtons() : ''}
        ${getDeleteActionButton()}
      </div>
    </div>
    ${entry.isDirectory ? `<div class="tree-children hidden" data-parent-path="${entry.path}"></div>` : ''}
  `;

  // Attach event listeners
  attachTreeNodeEvents(nodeWrapper, entry);
  
  return nodeWrapper;
}

function attachTreeNodeEvents(nodeWrapper, entry) {
  // New file button (directories only)
  const newFileBtn = nodeWrapper.querySelector('.node-action-new-file');
  if (newFileBtn) {
    newFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showInlineInput('file', entry.path);
    });
  }

  // New folder button (directories only)
  const newFolderBtn = nodeWrapper.querySelector('.node-action-new-folder');
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showInlineInput('folder', entry.path);
    });
  }

  // Delete button
  const deleteBtn = nodeWrapper.querySelector('.node-action-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(entry.path, entry.name, entry.isDirectory);
    });
  }

  // Main node click handler
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
}

async function toggleFolderNode(nodeEl) {
  const dirPath = nodeEl.getAttribute('data-path');
  const chevron = nodeEl.querySelector('.chevron');
  const childrenContainer = nodeEl.nextElementSibling;

  if (!childrenContainer) return;

  if (childrenContainer.classList.contains('hidden')) {
    childrenContainer.classList.remove('hidden');
    chevron.classList.add('open');
    setActiveFolderPath(dirPath);

    if (childrenContainer.children.length === 0) {
      await loadDirectoryChildren(dirPath, childrenContainer);
    }
  } else {
    childrenContainer.classList.add('hidden');
    chevron.classList.remove('open');
  }
}

async function refreshDirectoryNode(dirPath) {
  const workspace = getCurrentWorkspace();
  if (dirPath === workspace.path) {
    const rootContainer = getDOM().fileTree;
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

// Icon generation helpers
function getFileIcon(isDirectory, fileClass) {
  if (isDirectory) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="node-icon ${fileClass}"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="node-icon ${fileClass}"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
}

function getChevronIcon(isDirectory) {
  if (isDirectory) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chevron"><path d="m9 18 6-6-6-6"/></svg>`;
  }
  return `<span style="width: 12px; display: inline-block;"></span>`;
}

function getDirectoryActionButtons() {
  return `
    <button class="node-action-new-file" title="New File">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 12v6"/></svg>
    </button>
    <button class="node-action-new-folder" title="New Folder">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="M9 13h6"/></svg>
    </button>
  `;
}

function getDeleteActionButton() {
  return `
    <button class="node-action-delete" title="Delete">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
    </button>
  `;
}