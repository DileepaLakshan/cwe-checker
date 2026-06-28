/**
 * View Manager - Controls which view is displayed
 */
import { WelcomeScreen } from '../components/welcome-screen/welcome-screen.js';
import { ScanResultsPanel } from '../components/scan-results/scan-results-panel.js';

export function showWelcome() {
  WelcomeScreen.show();
  ScanResultsPanel.hide();
}

export function showResults() {
  WelcomeScreen.hide();
  ScanResultsPanel.show();
}