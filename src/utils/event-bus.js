/**
 * Simple Event Bus for application-wide communication
 */
export class EventBus {
  static instance = null;
  
  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
      window.EventBus = EventBus.instance;
    }
    return EventBus.instance;
  }

  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.events[event]) return;
    this.events[event].forEach(callback => callback(data));
  }
}