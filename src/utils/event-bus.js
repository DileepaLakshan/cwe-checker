/**
 * Simple Event Bus for application-wide communication
 */
export class EventBus {
  static instance = null;
  
  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
      window.EventBus = EventBus.instance;
      console.log('EventBus: created singleton instance');
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
    try {
      console.log(`EventBus.on: registered listener for '${event}' (listeners=${this.events[event].length})`);
    } catch (e) {
      console.log('EventBus.on: registered listener');
    }
  }

  off(event, callback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(cb => cb !== callback);
    try {
      console.log(`EventBus.off: removed listener for '${event}' (listeners=${this.events[event].length})`);
    } catch (e) {
      console.log('EventBus.off: removed listener');
    }
  }

  emit(event, data) {
    if (!this.events[event]) return;
    try {
      console.log(`EventBus.emit: emitting '${event}' to ${this.events[event].length} listener(s)`);
    } catch (e) {
      console.log('EventBus.emit: emitting event');
    }
    this.events[event].forEach((callback, idx) => {
      try {
        console.log(`EventBus.emit: invoking listener #${idx + 1} for '${event}'`);
      } catch (err) {}
      callback(data);
    });
  }
}