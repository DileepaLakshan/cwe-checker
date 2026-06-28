/**
 * File creation, deletion, and manipulation operations
 */
import { getCurrentWorkspace, getActiveFolderPath, getOpenTabs, removeTab } from '../state/ide-state';
import { showStatusBarMessage } from '../utils/status-bar';
import { loadDirectoryChildren } from './file-tree';
import { openFile } from './editor-service';

export function showInlineInput(type, parentPath) {
  const workspace = getCurrentWorkspace();
  if (!workspace) return;
  
  const targetParent = parentPath || getActiveFolderPath() || workspace.path;

  // Make sure parent is expanded
  if (targetParent !== workspace.path) {
    expandParentNode(targetParent);
  }

  // Prevent multiple inputs
  if (document.getElementById('inline-creator-input')) return;

  const container = getContainerForInput(targetParent, workspace);
  if (!container) return;

  const inputDiv = createInputElement(type, targetParent, workspace);
  
  if (container.firstChild) {
    container.insertBefore(inputDiv, container.firstChild);
  } else {
    container.appendChild(inputDiv);
  }

  const inputEl = inputDiv.querySelector('input');
  inputEl.focus();

  // Handle input events
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      processFileCreation(type, inputEl, targetParent, inputDiv);
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

function expandParentNode(targetParent) {
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

function getContainerForInput(targetParent, workspace) {
  if (targetParent === workspace.path) {
    return document.getElementById('file-tree');
  }
  return document.querySelector(`.tree-children[data-parent-path="${CSS.escape(targetParent)}"]`);
}

function createInputElement(type, targetParent, workspace) {
  const inputDiv = document.createElement('div');
  inputDiv.className = 'inline-input-container';
  
  const depth = targetParent === workspace.path ? 0 : 
    (targetParent.replace(workspace.path, '').split(/[\\\/]/).filter(Boolean)).length + 1;
  inputDiv.style.paddingLeft = `${16 + depth * 12}px`;

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'inline-input';
  inputEl.id = 'inline-creator-input';
  inputEl.placeholder = type === 'file' ? 'File name' : 'Folder name';

  inputDiv.appendChild(inputEl);
  return inputDiv;
}

async function processFileCreation(type, inputEl, targetParent, inputDiv) {
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
}

async function refreshDirectoryNode(dirPath) {
  const { loadDirectoryChildren } = await import('./file-tree');
  const workspace = getCurrentWorkspace();
  if (dirPath === workspace.path) {
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

export async function deleteItem(targetPath, name, isDirectory) {
  const label = isDirectory ? 'folder' : 'file';
  const confirmResult = confirm(`Are you sure you want to delete the ${label} "${name}"?`);
  if (!confirmResult) return;

  try {
    await window.api.deletePath(targetPath);
    showStatusBarMessage(`Deleted: ${name}`);

    // Close affected tabs
    closeAffectedTabs(targetPath, isDirectory);

    // Refresh parent directory
    const separatorIdx = Math.max(targetPath.lastIndexOf('\\'), targetPath.lastIndexOf('/'));
    const parentPath = targetPath.substring(0, separatorIdx);
    await refreshDirectoryNode(parentPath);
  } catch (err) {
    showStatusBarMessage(err.message || 'Error deleting file', true);
  }
}

function closeAffectedTabs(targetPath, isDirectory) {
  if (!isDirectory) {
    // Close single file tab
    const { closeTab } = require('./editor-service');
    closeTab(targetPath, null, true);
  } else {
    // Close all tabs in deleted folder
    const normalizedPath = targetPath.endsWith('\\') || targetPath.endsWith('/') 
      ? targetPath : targetPath + '\\';
    const openTabs = getOpenTabs();
    const childTabs = openTabs.filter(t => 
      t.path.startsWith(normalizedPath) || t.path.startsWith(targetPath + '/')
    );
    const { closeTab } = require('./editor-service');
    childTabs.forEach(t => closeTab(t.path, null, true));
  }
}