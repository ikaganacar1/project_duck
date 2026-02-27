class NetworkManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    this.socket = io();
    return new Promise((resolve) => {
      this.socket.on('connect', () => {
        console.log('Connected:', this.socket.id);
        resolve(this.socket.id);
      });
    });
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
    this.listeners.set(event, callback);
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  get id() {
    return this.socket?.id;
  }
}

window.network = new NetworkManager();
