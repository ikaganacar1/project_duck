const C = require('../shared/constants');
const { generateObstacles, generateSpawnPoints } = require('./map');

class Game {
  constructor(io, playerEntries, onGameEnd, runnerSkinCount, hunterSkinCount) {
    this.io = io;
    this.onGameEnd = onGameEnd;
    this.tickTimer = null;
    this.timerInterval = null;
    this.timeRemaining = C.GAME_DURATION;

    // Derive hunter/runner arrays from lobby team selections
    const hunters = playerEntries.filter(([, p]) => p.team === 'hunter').map(([id]) => id);
    const runners = playerEntries.filter(([, p]) => p.team === 'runner').map(([id]) => id);

    this.obstacles = generateObstacles();
    const spawns = generateSpawnPoints(hunters, runners);

    // Fallback skin pools (in case a player has skin -1)
    var rSkinCount = runnerSkinCount || 0;
    var hSkinCount = hunterSkinCount || 0;
    var rFallbackSkin = 0;
    var hFallbackSkin = 0;

    this.players = new Map();
    for (const [id, { name, team, skin: chosenSkin }] of playerEntries) {
      const spawn = spawns[id];
      // Use chosen skin from lobby, fallback to sequential if -1
      var skin = chosenSkin >= 0 ? chosenSkin : -1;
      if (skin === -1) {
        if (team === 'runner' && rSkinCount > 0) { skin = rFallbackSkin++ % rSkinCount; }
        if (team === 'hunter' && hSkinCount > 0) { skin = hFallbackSkin++ % hSkinCount; }
      }
      this.players.set(id, {
        name,
        team: team,
        skin,
        x: spawn.x,
        y: spawn.y,
        angle: 0,
        moving: false,
        state: 'free',
        carriedBy: null,
        inBush: false,
        struggleCount: 0,
        immuneUntil: 0,
      });
    }

    this.cages = C.CAGE_POSITIONS.map((pos) => ({
      x: pos.x,
      y: pos.y,
      prisoners: [],
      rescueProgress: 0,
    }));

    this.disconnected = new Map();
  }

  start() {
    const playersData = {};
    for (const [id, p] of this.players) {
      playersData[id] = {
        name: p.name,
        x: p.x,
        y: p.y,
        team: p.team,
        state: p.state,
        skin: p.skin,
      };
    }

    this.io.emit('game:start', {
      players: playersData,
      cages: this.cages,
      obstacles: this.obstacles,
    });

    // Delay game ticks to match client countdown screen
    setTimeout(() => {
      this.tickTimer = setInterval(() => this.tick(), C.TICK_INTERVAL);

      this.timerInterval = setInterval(() => {
        this.timeRemaining--;
        if (this.timeRemaining <= 0) {
          this.endGame();
        }
      }, 1000);
    }, 4000);
  }

  tick() {
    for (const [id, p] of this.players) {
      if (p.state === 'carried' || p.state === 'caged') continue;
      if (!p.moving) continue;

      let speed = C.PLAYER_SPEED / C.TICK_RATE;

      if (p.team === 'hunter' && this.isCarrying(id)) {
        speed *= C.HUNTER_CARRY_SPEED_MULT;
      }

      const dx = Math.cos(p.angle) * speed;
      const dy = Math.sin(p.angle) * speed;
      let newX = p.x + dx;
      let newY = p.y + dy;

      const dist = Math.sqrt(newX * newX + newY * newY);
      if (dist > C.MAP_RADIUS) {
        const scale = C.MAP_RADIUS / dist;
        newX *= scale;
        newY *= scale;
      }

      for (const obs of this.obstacles) {
        if (obs.type === 'bush') continue;
        const odx = newX - obs.x;
        const ody = newY - obs.y;
        const oDist = Math.sqrt(odx * odx + ody * ody);
        const minDist = obs.radius + 16;
        if (oDist < minDist) {
          const pushScale = minDist / oDist;
          newX = obs.x + odx * pushScale;
          newY = obs.y + ody * pushScale;
        }
      }

      p.x = newX;
      p.y = newY;

      this.updateCarriedRunner(id, p);
    }

    for (const [id, p] of this.players) {
      if (p.state !== 'free') {
        p.inBush = false;
        continue;
      }
      p.inBush = false;
      for (const obs of this.obstacles) {
        if (obs.type !== 'bush') continue;
        const dx = p.x - obs.x;
        const dy = p.y - obs.y;
        if (Math.sqrt(dx * dx + dy * dy) < obs.radius) {
          p.inBush = true;
          break;
        }
      }
    }

    this.checkCaptures();
    this.checkCageDeposit();

    this.checkInstantWin();
    this.broadcastState();
  }

  handleInput(socketId, { angle, moving }) {
    const player = this.players.get(socketId);
    if (!player) return;
    if (player.state === 'carried' || player.state === 'caged') return;
    player.angle = angle;
    player.moving = moving;
  }

  handleStruggle(socketId) {
    const player = this.players.get(socketId);
    if (!player || player.state !== 'carried') return;

    player.struggleCount++;
    if (player.struggleCount >= C.STRUGGLE_THRESHOLD) {
      this.freePlayer(socketId, true);
      this.io.emit('game:freed', { playerId: socketId });
    }
  }

  handleRescue(socketId, cageIndex) {
    const player = this.players.get(socketId);
    if (!player || player.team !== 'runner' || player.state !== 'free') return;

    const cage = this.cages[cageIndex];
    if (!cage || cage.prisoners.length === 0) return;

    const dx = player.x - cage.x;
    const dy = player.y - cage.y;
    if (Math.sqrt(dx * dx + dy * dy) > C.CAGE_ZONE_RADIUS * 2.5) return;

    cage.rescueProgress++;
    if (cage.rescueProgress >= C.CAGE_RESCUE_THRESHOLD) {
      for (const prisonerId of cage.prisoners) {
        const prisoner = this.players.get(prisonerId);
        if (prisoner) {
          prisoner.state = 'free';
          prisoner.x = cage.x + (Math.random() - 0.5) * 100;
          prisoner.y = cage.y + (Math.random() - 0.5) * 100;
        }
      }
      cage.prisoners = [];
      cage.rescueProgress = 0;
      this.io.emit('game:rescued', { cageIndex });
    }
  }

  checkCaptures() {
    const hunters = [...this.players.entries()].filter(
      ([id, p]) => p.team === 'hunter' && p.state === 'free' && !this.isCarrying(id)
    );
    const now = Date.now();
    const runners = [...this.players.entries()].filter(
      ([, p]) => p.team === 'runner' && p.state === 'free' && now >= p.immuneUntil
    );

    for (const [hId, h] of hunters) {
      for (const [rId, r] of runners) {
        const dx = h.x - r.x;
        const dy = h.y - r.y;
        if (Math.sqrt(dx * dx + dy * dy) < C.CAPTURE_DISTANCE) {
          r.state = 'carried';
          r.carriedBy = hId;
          r.struggleCount = 0;
          this.io.emit('game:capture', { hunterId: hId, runnerId: rId });
          break;
        }
      }
    }
  }

  checkCageDeposit() {
    for (const [id, p] of this.players) {
      if (p.team !== 'hunter') continue;
      const carried = [...this.players.entries()].find(
        ([, r]) => r.state === 'carried' && r.carriedBy === id
      );
      if (!carried) continue;

      const [runnerId, runner] = carried;

      for (let i = 0; i < this.cages.length; i++) {
        const cage = this.cages[i];
        const dx = p.x - cage.x;
        const dy = p.y - cage.y;
        if (Math.sqrt(dx * dx + dy * dy) < C.CAGE_ZONE_RADIUS) {
          runner.state = 'caged';
          runner.carriedBy = null;
          runner.x = cage.x;
          runner.y = cage.y;
          cage.prisoners.push(runnerId);
          this.io.emit('game:caged', { playerId: runnerId, cageIndex: i });
          break;
        }
      }
    }
  }

  isCarrying(hunterId) {
    for (const [, p] of this.players) {
      if (p.state === 'carried' && p.carriedBy === hunterId) return true;
    }
    return false;
  }

  updateCarriedRunner(hunterId, hunter) {
    for (const [, p] of this.players) {
      if (p.state === 'carried' && p.carriedBy === hunterId) {
        p.x = hunter.x - Math.cos(hunter.angle) * 30;
        p.y = hunter.y - Math.sin(hunter.angle) * 30;
        break;
      }
    }
  }

  freePlayer(playerId, grantImmunity) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.state = 'free';
    player.carriedBy = null;
    player.struggleCount = 0;
    if (grantImmunity) {
      player.immuneUntil = Date.now() + C.IMMUNITY_DURATION;
    }
  }

  checkInstantWin() {
    const runners = [...this.players.values()].filter((p) => p.team === 'runner');
    const allCaged = runners.every((p) => p.state === 'caged');
    if (allCaged && runners.length > 0) {
      this.endGame();
    }
  }

  broadcastState() {
    const players = {};
    for (const [id, p] of this.players) {
      players[id] = {
        x: p.x,
        y: p.y,
        angle: p.angle,
        moving: p.moving,
        team: p.team,
        state: p.state,
        carriedBy: p.carriedBy,
        inBush: p.inBush,
        name: p.name,
        struggleCount: p.struggleCount,
        skin: p.skin,
        immune: Date.now() < p.immuneUntil,
      };
    }
    this.io.emit('game:state', {
      players,
      cages: this.cages.map((c) => ({
        x: c.x,
        y: c.y,
        prisoners: c.prisoners,
        rescueProgress: c.rescueProgress,
      })),
      timer: this.timeRemaining,
    });
  }

  endGame() {
    clearInterval(this.tickTimer);
    clearInterval(this.timerInterval);

    const runners = [...this.players.values()].filter((p) => p.team === 'runner');
    const cagedCount = runners.filter((p) => p.state === 'caged').length;
    const freeCount = runners.length - cagedCount;

    const winner = cagedCount > freeCount ? 'hunter' : 'runner';

    const stats = {
      totalRunners: runners.length,
      cagedRunners: cagedCount,
      freeRunners: freeCount,
    };

    this.io.emit('game:end', { winner, stats });

    if (this.onGameEnd) {
      this.onGameEnd();
    }
  }

  handleDisconnect(socketId) {
    const player = this.players.get(socketId);
    if (!player) return;

    if (player.team === 'hunter') {
      for (const [rId, r] of this.players) {
        if (r.state === 'carried' && r.carriedBy === socketId) {
          this.freePlayer(rId);
          this.io.emit('game:freed', { playerId: rId });
        }
      }
    }

    if (player.state === 'carried') {
      this.freePlayer(socketId);
    }

    for (const cage of this.cages) {
      cage.prisoners = cage.prisoners.filter((id) => id !== socketId);
    }

    this.players.delete(socketId);

    const remaining = this.players.size;
    if (remaining < 2) {
      this.endGame();
    }
  }

  hasPlayer(socketId) {
    return this.players.has(socketId);
  }
}

module.exports = Game;
