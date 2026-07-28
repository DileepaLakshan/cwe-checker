/**
 * UI State Management
 */
export class UIState {
  static state = {
    currentView: 'welcome', // 'welcome' | 'results' | 'editor'
    activeResultTab: 'sast', // 'sast' | 'sca'
    currentWorkspace: null,
    openTabs: [],
    activeTab: null
  };

  static getState() {
    return { ...this.state };
  }

  static setState(updates) {
    this.state = { ...this.state, ...updates };
  }

  static setView(view) {
    this.state.currentView = view;
  }

  static setActiveResultTab(tab) {
    this.state.activeResultTab = tab;
  }
}