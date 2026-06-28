/**
 * Centralized IDE state management
 */
let state = {
  currentWorkspace: null,
  activeTab: null,
  openTabs: [], // { path, name, content, originalContent, isDirty }
  activeFolderPath: null, // tracking clicked folders for creation context
  currentProjectPath: null
};

export function initIDEState() {
  state = {
    currentWorkspace: null,
    activeTab: null,
    openTabs: [],
    activeFolderPath: null,
    currentProjectPath: null
  };
}

export function getIDEState() {
  return state;
}

export function updateIDEState(updates) {
  Object.assign(state, updates);
}

// Specific state getters/setters
export function getCurrentWorkspace() { return state.currentWorkspace; }
export function setCurrentWorkspace(workspace) { state.currentWorkspace = workspace; }

export function getActiveTab() { return state.activeTab; }
export function setActiveTab(tab) { state.activeTab = tab; }

export function getOpenTabs() { return state.openTabs; }
export function setOpenTabs(tabs) { state.openTabs = tabs; }

export function getActiveFolderPath() { return state.activeFolderPath; }
export function setActiveFolderPath(path) { state.activeFolderPath = path; }

export function getCurrentProjectPath() { return state.currentProjectPath; }
export function setCurrentProjectPath(path) { state.currentProjectPath = path; }

export function findTab(filePath) {
  return state.openTabs.find(t => t.path === filePath);
}

export function findTabIndex(filePath) {
  return state.openTabs.findIndex(t => t.path === filePath);
}

export function addTab(tab) {
  state.openTabs.push(tab);
}

export function removeTab(index) {
  state.openTabs.splice(index, 1);
}

export function updateTabContent(filePath, content) {
  const tab = findTab(filePath);
  if (tab) {
    tab.content = content;
    tab.isDirty = content !== tab.originalContent;
  }
}