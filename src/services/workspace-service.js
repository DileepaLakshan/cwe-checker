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

export async function openDirectoryPicker() {
  try {
    const res = await window.api.openDirectory();
    if (res) {
      await openWorkspace(res.path, res.name);
    }
  } catch (err) {
    showStatusBarMessage('Failed to open directory: ' + err.message, true);
  }
}

export async function openWorkspace(dirPath, dirName) {
  const dom = getDOM();
  
  setCurrentWorkspace({ path: dirPath, name: dirName });
  setActiveFolderPath(dirPath);
  addRecentProject(dirPath, dirName);

  // Update layout components visibility
  dom.noFolderState.style.display = 'none';
  dom.workspaceHeader.style.display = 'flex';
  dom.workspaceName.innerText = dirName.toUpperCase();
  dom.fileTree.style.display = 'block';
  dom.sidebarActions.style.display = 'flex';
  dom.welcomeNewFile.classList.remove('disabled');

  // Status Bar
  dom.statusFolderPath.innerText = dirPath;
  dom.statusFolderPath.title = dirPath;

  // Clear previous session tabs & load new tree
  setOpenTabs([]);
  setActiveTab(null);
  renderTabs();

  await loadDirectoryChildren(dirPath, dom.fileTree);
  showStatusBarMessage(`Opened Workspace: ${dirName}`);
}

export function updateWorkspacePath(folderPath) {
  if (!folderPath) return;

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