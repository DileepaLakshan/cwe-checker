/**
 * Main renderer entry point - initializes the application
 */
import './index.css';
import { initEventListeners } from './events/global-events';
import { initIDEState, getIDEState } from './state/ide-state';
import { renderRecentProjects } from './components/recent-projects';
import { initScanButton } from './events/scan-events';
import { initDOMReferences } from './utils/dom-references';

window.addEventListener('DOMContentLoaded', () => {
  // Initialize state
  initIDEState();
  
  // Cache DOM references
  initDOMReferences();
  
  // Setup all event listeners
  initEventListeners();
  
  // Initialize scan functionality
  initScanButton();
  
  // Load recent workspaces
  renderRecentProjects();
});