/**
 * Application initialization and core logic
 */
import { ScannerAPI } from './api/scanner-api.js';
import { UIState } from './state/ui-state.js';
import { EventBus } from './utils/event-bus.js';
import { showWelcome, showResults } from './views/view-manager.js';
import { openDirectoryPicker } from './services/workspace-service.js';
import { performScan } from './services/scan-service.js';

let eventListenersInitialized = false;

export function initApp() {
  // Initialize API mock if needed
  if (!window.scannerAPI) {
    window.scannerAPI = ScannerAPI.createMock();
  }
  if (!window.trainingAPI) {
    console.log('app.js: window.trainingAPI missing (not running under Electron preload) - training UI will be disabled');
    window.trainingAPI = {
      selectDataset: async () => null,
      describeDataset: async () => { throw new Error('Training is only available inside the desktop app.'); },
      start: async () => { throw new Error('Training is only available inside the desktop app.'); },
      cancel: async () => false,
      listVersions: async () => ({}),
      promote: async () => { throw new Error('Training is only available inside the desktop app.'); },
      discard: async () => false,
      restore: async () => { throw new Error('Training is only available inside the desktop app.'); },
      revealLog: async () => { throw new Error('Training is only available inside the desktop app.'); },
      readLog: async () => '',
      onProgress: () => () => {},
    };
  }

  // Set up event listeners
  setupEventListeners();
  
  // Show initial state
  showWelcome();
}

function setupEventListeners() {
  if (eventListenersInitialized) {
    console.log('app.js: setupEventListeners already initialized, skipping');
    return;
  }

  const eventBus = EventBus.getInstance();
  
  // Scan button events
  eventBus.on('scan:start', performScan);
  
  // Folder open events
  eventBus.on('folder:open', async () => {
    console.log('folder open function is calling');
    if (!openDirectoryPicker) {
      console.error('folder open: openDirectoryPicker not available');
      return;
    }
    await openDirectoryPicker();
  });
  
  // Back to welcome
  eventBus.on('view:showWelcome', showWelcome);
  eventBus.on('view:showResults', showResults);

  eventListenersInitialized = true;
}