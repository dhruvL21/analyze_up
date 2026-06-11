type Events = {
  'permission-error': (error: Error) => void;
};

class TypedEventEmitter {
  private listeners: { [K in keyof Events]?: Events[K][] } = {};

  on<K extends keyof Events>(event: K, listener: Events[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): void {
    if (!this.listeners[event]) return;
    const index = this.listeners[event]!.indexOf(listener);
    if (index > -1) {
      this.listeners[event]!.splice(index, 1);
    }
  }

  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    if (!this.listeners[event]) return;
    this.listeners[event]!.forEach(listener => listener(...args));
  }
}

// Export a singleton instance of the event emitter.
export const errorEmitter = new TypedEventEmitter();
