/**
 * Component initialization
 */
import { ActivityBar } from './activity-bar/activity-bar.js';
import { Sidebar } from './sidebar/sidebar.js';
import { ScanResultsPanel } from './scan-results/scan-results-panel.js';
import { TabsBar } from './tabs-bar/tabs-bar.js';
import { WelcomeScreen } from './welcome-screen/welcome-screen.js';
import { StatusBar } from './status-bar/status-bar.js';
import { ResultsPanelLegacy } from './results-panel/results-panel-legacy.js';
import { HistoryModal } from './history-modal/history-modal.js';

export function initComponents() {
  ActivityBar.init('activity-bar');
  Sidebar.init('sidebar-component');
  ScanResultsPanel.init('scan-results-component');
  TabsBar.init('tabs-bar-component');
  WelcomeScreen.init('welcome-screen-component');
  StatusBar.init('status-bar-component');
  ResultsPanelLegacy.init('results-panel-legacy');
  HistoryModal.init();
}