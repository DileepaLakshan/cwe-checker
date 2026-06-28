/**
 * Cache frequently accessed DOM elements
 */
let domRefs = {};

export function initDOMReferences() {
  domRefs = {
    codeTextarea: document.getElementById('code-textarea'),
    lineNumbers: document.getElementById('line-numbers'),
    lineNumbersContainer: document.querySelector('.line-numbers-container'),
    scanBtn: document.getElementById('scanBtn'),
    welcomeScreen: document.getElementById('welcome-screen'),
    resultsPanel: document.getElementById('scan-results-panel'),
    sastContainer: document.getElementById('sast-results-container'),
    scaContainer: document.getElementById('sca-results-container'),
    summaryContainer: document.getElementById('results-summary'),
    cweLocationContainer: document.getElementById('cwe-location-results-container'),
    noFolderState: document.getElementById('no-folder-state'),
    workspaceHeader: document.getElementById('workspace-header'),
    workspaceName: document.getElementById('workspace-name'),
    fileTree: document.getElementById('file-tree'),
    sidebarActions: document.getElementById('sidebar-actions'),
    welcomeNewFile: document.getElementById('welcome-new-file'),
    statusFolderPath: document.getElementById('status-folder-path'),
    tabsBar: document.getElementById('tabs-bar'),
    editorBreadcrumbs: document.getElementById('editor-breadcrumbs'),
    editorPanel: document.getElementById('code-editor-panel'),
    statusLineCol: document.getElementById('status-line-col'),
    statusSaveBtn: document.getElementById('status-save-btn'),
    statusMode: document.getElementById('status-mode'),
    recentProjectsList: document.getElementById('recent-projects-list'),
    recentSection: document.getElementById('recent-section'),
    btnCloseResults: document.getElementById('btn-close-results'),
  };
}

export function getDOM() {
  return domRefs;
}