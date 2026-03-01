class NetworkManager {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    // Detect base path from current URL for subpath deployments
    var base = window.location.pathname.split('/').slice(0, -1).filter(Boolean);
    var socketPath = (base.length ? '/' + base[0] : '') + '/socket.io';
    this.socket = io({ path: socketPath, transports: ['websocket', 'polling'] });
    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log('Connected:', this.socket.id);
        resolve(this.socket.id);
      });
      this.socket.on('connect_error', (err) => {
        console.error('Socket connect error:', err.message);
        reject(err);
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
