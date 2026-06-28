/**
 * Application initialization and core logic
 */
import { ScannerAPI } from './api/scanner-api.js';
import { UIState } from './state/ui-state.js';
import { EventBus } from './utils/event-bus.js';
import { showWelcome, showResults } from './views/view-manager.js';
import { updateWorkspacePath } from './services/workspace-service.js';
import { performScan } from './services/scan-service.js';

export function initApp() {
  // Initialize API mock if needed
  if (!window.scannerAPI) {
    window.scannerAPI = ScannerAPI.createMock();
  }

  // Set up event listeners
  setupEventListeners();
  
  // Show initial state
  showWelcome();
}

function setupEventListeners() {
  const eventBus = EventBus.getInstance();
  
  // Scan button events
  eventBus.on('scan:start', performScan);
  
  // Folder open events
  eventBus.on('folder:open', async () => {
    const folder = await window.scannerAPI.selectProject();
    if (folder) updateWorkspacePath(folder);
  });
  
  // Back to welcome
  eventBus.on('view:showWelcome', showWelcome);
  eventBus.on('view:showResults', showResults);
}