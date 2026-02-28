const C = require('../shared/constants');

class Lobby {
  constructor(io) {
    this.io = io;
    this.players = new Map(); // socketId -> { name, ready, team, skin }
    this.spectators = new Map(); // socketId -> { name }
    this.countdownTimer = null;
    this.countdownSeconds = 0;
    this.onGameStart = null; // callback set by index.js
  }

  addPlayer(socket, name) {
    if (this.players.size >= C.MAX_PLAYERS) {
      socket.emit('lobby:full');
      return false;
    }
    this.players.set(socket.id, { name, ready: false, team: null, skin: -1 });
    this.broadcast();
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.cancelCountdown();
    this.broadcast();
  }

  addSpectator(socket, name) {
    this.spectators.set(socket.id, { name });
    this.broadcast();
  }

  removeSpectator(socketId) {
    this.spectators.delete(socketId);
    this.broadcast();
  }

  setName(socketId, name) {
    const player = this.players.get(socketId);
    if (!player) return;
    player.name = name;
    this.broadcast();
  }

  setTeam(socketId, team) {
    const player = this.players.get(socketId);
    if (!player) return;

    // Count current hunters and runners (excluding this player's current team)
    let hunters = 0;
    let runners = 0;
    for (const [id, p] of this.players) {
      if (id === socketId) continue;
      if (p.team === 'hunter') hunters++;
      if (p.team === 'runner') runners++;
    }

    // Balance check: hunters <= runners (only enforce once at least one person has picked a team)
    if (team === 'hunter' && (hunters > 0 || runners > 0) && hunters >= runners) {
      this.io.to(socketId).emit('lobby:team-rejected', { team });
      return;
    }

    player.team = team;
    // Reset skin when switching teams
    player.skin = -1;
    // Reset ready when team changes
    player.ready = false;
    this.broadcast();
    this.checkAllReady();
  }

  setSkin(socketId, skin) {
    const player = this.players.get(socketId);
    if (!player) return;
    player.skin = skin;
    this.broadcast();
  }

  setReady(socketId, ready) {
    const player = this.players.get(socketId);
    if (!player || !player.team) return; // must have a team to ready up
    player.ready = ready;
    this.broadcast();
    this.checkAllReady();
  }

  checkAllReady() {
    if (this.players.size < C.MIN_PLAYERS) {
      this.cancelCountdown();
      return;
    }
    const values = [...this.players.values()];
    const allReady = values.every((p) => p.ready && p.team);
    const hasHunter = values.some((p) => p.team === 'hunter');
    if (allReady && hasHunter && !this.countdownTimer) {
      this.startCountdown();
    } else if (!allReady || !hasHunter) {
      this.cancelCountdown();
    }
  }

  startCountdown() {
    this.countdownSeconds = 3;
    this.io.emit('lobby:countdown', { seconds: this.countdownSeconds });
    this.countdownTimer = setInterval(() => {
      this.countdownSeconds--;
      if (this.countdownSeconds <= 0) {
        this.cancelCountdown();
        if (this.onGameStart) {
          this.onGameStart([...this.players.entries()]);
        }
      } else {
        this.io.emit('lobby:countdown', { seconds: this.countdownSeconds });
      }
    }, 1000);
  }

  cancelCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
      this.io.emit('lobby:countdown', { seconds: 0 });
    }
  }

  broadcast() {
    const players = [];
    for (const [id, p] of this.players) {
      players.push({ id, name: p.name, ready: p.ready, team: p.team, skin: p.skin });
    }
    const spectators = [];
    for (const [id, s] of this.spectators) {
      spectators.push({ id, name: s.name });
    }
    this.io.emit('lobby:update', { players, spectators });
  }

  getPlayerIds() {
    return [...this.players.keys()];
  }

  getPlayerName(id) {
    return this.players.get(id)?.name || 'Unknown';
  }

  clear() {
    this.players.clear();
    this.spectators.clear();
    this.cancelCountdown();
  }
}

module.exports = Lobby;
