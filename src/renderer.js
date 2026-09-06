/**
 * Main renderer entry point - initializes the application
 */
import './index.css';
import { initEventListeners } from './events/global-events';
import { initIDEState, getIDEState } from './state/ide-state';
import { renderRecentProjects } from './components/recent-projects';
import { initDOMReferences } from './utils/dom-references';
import { initComponents } from './components/index.js';
import { initApp } from './app.js';
import './utils/cwe-utils.js';


document.addEventListener('DOMContentLoaded', () => {
  initApp();           // ← Initialize EventBus FIRST
  initComponents();    // ← Then attach component listeners
});

window.addEventListener('DOMContentLoaded', () => {
  // Initialize state
  initIDEState();
  
  // Cache DOM references
  initDOMReferences();
  
  // Setup all event listeners
  initEventListeners();
  
  // Load recent workspaces
  renderRecentProjects();
});