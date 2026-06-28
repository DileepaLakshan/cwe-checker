/**
 * Initialize all global event listeners
 */
import { openDirectoryPicker } from '../services/workspace-service';
import { showInlineInput } from '../services/file-operations';
import { collapseAllFolders } from '../services/file-tree';
import { saveCurrentFile } from '../services/editor-service';
import { showStatusBarMessage } from '../utils/status-bar';
import { initEditorEvents } from './editor-events';
import { getCurrentWorkspace } from '../state/ide-state';

export function initEventListeners() {
  // Welcome Screen actions
  document.getElementById('btn-open-folder').addEventListener('click', openDirectoryPicker);
  document.getElementById('welcome-open-folder').addEventListener('click', openDirectoryPicker);

  // Global header actions
  document.getElementById('action-new-file').addEventListener('click', () => showInlineInput('file'));
  document.getElementById('action-new-folder').addEventListener('click', () => showInlineInput('folder'));
  document.getElementById('action-collapse-all').addEventListener('click', collapseAllFolders);

  // Save button in status bar
  document.getElementById('btn-save-file').addEventListener('click', saveCurrentFile);

  // Initialize editor-specific events
  initEditorEvents();

  // Global Keydown shortcuts
  window.addEventListener('keydown', handleGlobalKeyboardShortcuts);

  // Theme & Settings toggle placeholders
  initThemeAndSettings();
}

function handleGlobalKeyboardShortcuts(e) {
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
    // Import closeTab dynamically to avoid circular dependencies
    import('../services/editor-service').then(module => {
      const { closeTab, getActiveTab } = module;
      const activeTab = getActiveTab();
      if (activeTab) {
        closeTab(activeTab);
      }
    });
  } else if (ctrlKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    const workspace = getCurrentWorkspace();
    if (workspace) {
      showInlineInput('file');
    }
  }
}

function initThemeAndSettings() {
  document.getElementById('btn-theme').addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    showStatusBarMessage(`Switched to ${isLight ? 'Light Theme' : 'Dark Theme'}`);
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    showStatusBarMessage('Settings loaded (Configured by cwe-checker)');
  });
}