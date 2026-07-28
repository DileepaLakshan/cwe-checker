/**
 * Workspace and directory management
 */
import { getDOM } from '../utils/dom-references';
import { 
  setCurrentWorkspace, setActiveFolderPath, getOpenTabs, setOpenTabs,
  getActiveTab, setActiveTab 
} from '../state/ide-state';
import { addRecentProject } from '../utils/storage';
import { renderTabs } from '../components/tabs';
import { loadDirectoryChildren } from './file-tree';
import { showStatusBarMessage } from '../utils/status-bar';
import { StatusBar } from '../components/status-bar/status-bar.js';

let isFolderDialogOpen = false;

export async function openDirectoryPicker() {
  console.log('workspace-service.openDirectoryPicker: called');
  if (isFolderDialogOpen) {
    console.warn('workspace-service.openDirectoryPicker: already open, skipping duplicate request');
    return;
  }

  if (!window.api || typeof window.api.openDirectory !== 'function') {
    console.error('workspace-service.openDirectoryPicker: window.api.openDirectory not available', window.api);
    return;
  }

  isFolderDialogOpen = true;
  try {
    const res = await window.api.openDirectory();
    console.log('workspace-service.openDirectoryPicker: result=', res);
    if (res) {
      await openWorkspace(res.path, res.name);
    } else {
      console.log('workspace-service.openDirectoryPicker: user canceled or returned null');
    }
  } catch (err) {
    console.error('workspace-service.openDirectoryPicker: failed', err);
    showStatusBarMessage('Failed to open directory: ' + err.message, true);
  } finally {
    isFolderDialogOpen = false;
  }
}

export async function openWorkspace(dirPath, dirName) {
  const dom = getDOM();
  console.log('workspace-service.openWorkspace: opening workspace', dirPath, dirName, { dom });
  
  setCurrentWorkspace({ path: dirPath, name: dirName });
  setActiveFolderPath(dirPath);
  addRecentProject(dirPath, dirName);

  // Update layout components visibility
  if (dom.noFolderState) dom.noFolderState.style.display = 'none';
  else console.warn('workspace-service.openWorkspace: dom.noFolderState missing');
  if (dom.workspaceHeader) dom.workspaceHeader.style.display = 'flex';
  else console.warn('workspace-service.openWorkspace: dom.workspaceHeader missing');
  if (dom.workspaceName) dom.workspaceName.innerText = dirName.toUpperCase();
  else console.warn('workspace-service.openWorkspace: dom.workspaceName missing');
  if (dom.fileTree) dom.fileTree.style.display = 'block';
  else console.warn('workspace-service.openWorkspace: dom.fileTree missing');
  if (dom.sidebarActions) dom.sidebarActions.style.display = 'flex';
  else console.warn('workspace-service.openWorkspace: dom.sidebarActions missing');
  if (dom.welcomeNewFile) dom.welcomeNewFile.classList.remove('disabled');
  else console.warn('workspace-service.openWorkspace: dom.welcomeNewFile missing');

  // Status Bar
  if (dom.statusFolderPath) {
    dom.statusFolderPath.innerText = dirPath;
    dom.statusFolderPath.title = dirPath;
  }

  // Clear previous session tabs & load new tree
  setOpenTabs([]);
  setActiveTab(null);
  renderTabs();

  if (dom.fileTree) {
    await loadDirectoryChildren(dirPath, dom.fileTree);
  } else {
    console.warn('workspace-service.openWorkspace: fileTree element not found');
  }
  showStatusBarMessage(`Opened Workspace: ${dirName}`);
}

export function updateWorkspacePath(folderPath) {
  console.log("updateWorkspacePath is calling");
  if (!folderPath) return;
  console.log("folderpath is", folderPath);

  StatusBar.updateFolderPath(folderPath);
  
  // Update workspace header
  const workspaceHeader = document.getElementById('workspace-header');
  const workspaceName = document.getElementById('workspace-name');
  const noFolderState = document.getElementById('no-folder-state');
  
  if (workspaceName) {
    workspaceName.textContent = folderPath.split('/').pop() || 'PROJECT';
  }
  
  if (workspaceHeader) workspaceHeader.style.display = 'flex';
  if (noFolderState) noFolderState.style.display = 'none';
  
  // Show file tree
  const fileTree = document.getElementById('file-tree');
  if (fileTree) fileTree.style.display = 'block';
}