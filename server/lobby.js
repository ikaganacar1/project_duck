const C = require('../shared/constants');

class Lobby {
  constructor(io) {
    this.io = io;
    this.players = new Map(); // socketId -> { name, ready, team, skin }
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

    // Balance check: hunters <= runners
    if (team === 'hunter' && hunters >= runners) {
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
    const allReady = [...this.players.values()].every((p) => p.ready && p.team);
    if (allReady && !this.countdownTimer) {
      this.startCountdown();
    } else if (!allReady) {
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
    this.io.emit('lobby:update', { players });
  }

  getPlayerIds() {
    return [...this.players.keys()];
  }

  getPlayerName(id) {
    return this.players.get(id)?.name || 'Unknown';
  }

  clear() {
    this.players.clear();
    this.cancelCountdown();
  }
}

module.exports = Lobby;
