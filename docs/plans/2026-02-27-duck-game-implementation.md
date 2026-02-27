# Duck Hunt Multiplayer Game - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time multiplayer duck-themed tag game where Hunters chase Runners on a circular forest map, with capture/struggle/cage mechanics.

**Architecture:** Monorepo with Express serving Socket.io and static Phaser.js client files. Server is authoritative — all game logic runs server-side. Client renders state and sends input. Each game mechanic lives in its own module for micro-manageability.

**Tech Stack:** Node.js 20+, Express 4, Socket.io 4, Phaser 3 (Arcade Physics), phaser3-rex-plugins (joystick), Docker

**Design doc:** `docs/plans/2026-02-27-duck-game-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `shared/constants.js`
- Create: `server/index.js`
- Create: `client/index.html`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`
- Create: `.gitignore`

**Step 1: Initialize npm and install dependencies**

Run:
```bash
cd /home/ika/jam
npm init -y
npm install express socket.io
```

**Step 2: Create .gitignore**

```gitignore
node_modules/
.DS_Store
```

**Step 3: Create .dockerignore**

```
node_modules
.git
.gitignore
```

**Step 4: Create shared/constants.js**

```js
const CONSTANTS = {
  MAP_RADIUS: 2000,
  WORLD_SIZE: 4000,
  TICK_RATE: 20,
  TICK_INTERVAL: 50,
  PLAYER_SPEED: 200,
  HUNTER_CARRY_SPEED_MULT: 0.6,
  CAPTURE_DISTANCE: 50,
  STRUGGLE_THRESHOLD: 10,
  CAGE_RESCUE_THRESHOLD: 15,
  GAME_DURATION: 180,
  BUSH_VISIBILITY_DISTANCE: 150,
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 8,
  RECONNECT_WINDOW: 10000,
  CAGE_POSITIONS: [
    { x: 0, y: -1500 },
    { x: 0, y: 1500 },
    { x: 1500, y: 0 },
    { x: -1500, y: 0 },
  ],
  CAGE_ZONE_RADIUS: 80,
  HUNTER_SPAWN_DISTANCE: 1500,
  RUNNER_SPAWN_RADIUS: 300,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
```

**Step 5: Create minimal server/index.js**

```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'client')));
// Serve shared/constants.js so client can load it as a script
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 6: Create minimal client/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Duck Hunt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/shared/constants.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"></script>
  <script type="module" src="main.js"></script>
</body>
</html>
```

**Step 7: Create client/main.js (minimal Phaser config)**

Create `client/main.js`:
```js
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#2d5a1b',
  scene: [],
};

const game = new Phaser.Game(config);
```

**Step 8: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

**Step 9: Create docker-compose.yml**

```yaml
services:
  game:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
```

**Step 10: Verify server starts**

Run: `node server/index.js`
Expected: `Server running on port 3000`
Kill the server (Ctrl+C).

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Express, Socket.io, Phaser"
```

---

## Task 2: Shared Constants and Map Data

**Files:**
- Modify: `shared/constants.js` (already created, verify complete)
- Create: `server/map.js`

**Step 1: Create server/map.js with obstacle and spawn data**

```js
const C = require('../shared/constants');

function generateObstacles() {
  const obstacles = [];
  const rng = (min, max) => min + Math.random() * (max - min);

  // Rocks: 18 total, varied sizes, solid collision
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(200, C.MAP_RADIUS - 200);
    obstacles.push({
      type: 'rock',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: rng(20, 40),
    });
  }

  // Trees: 22 total, solid collision
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(200, C.MAP_RADIUS - 200);
    obstacles.push({
      type: 'tree',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: 30,
    });
  }

  // Bushes: 12 total, hide mechanic (no solid collision)
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(300, C.MAP_RADIUS - 300);
    obstacles.push({
      type: 'bush',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: 45,
    });
  }

  return obstacles;
}

function generateSpawnPoints(hunters, runners) {
  const spawns = {};

  // Hunters spawn at edge, evenly distributed
  hunters.forEach((id, i) => {
    const angle = (i / hunters.length) * Math.PI * 2;
    spawns[id] = {
      x: Math.cos(angle) * C.HUNTER_SPAWN_DISTANCE,
      y: Math.sin(angle) * C.HUNTER_SPAWN_DISTANCE,
    };
  });

  // Runners spawn near center, randomly spread
  runners.forEach((id) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * C.RUNNER_SPAWN_RADIUS;
    spawns[id] = {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    };
  });

  return spawns;
}

module.exports = { generateObstacles, generateSpawnPoints };
```

**Step 2: Commit**

```bash
git add server/map.js
git commit -m "feat: add map data generation (obstacles, spawns)"
```

---

## Task 3: Team Assignment

**Files:**
- Create: `server/teams.js`

**Step 1: Create server/teams.js**

```js
/**
 * Assigns teams based on H = R - 1 formula.
 * @param {string[]} playerIds - Array of socket IDs
 * @returns {{ hunters: string[], runners: string[] }}
 */
function assignTeams(playerIds) {
  const total = playerIds.length;
  // H = R - 1, and H + R = total
  // So R - 1 + R = total => R = (total + 1) / 2
  const runnerCount = Math.ceil((total + 1) / 2);
  const hunterCount = total - runnerCount;

  // Shuffle player IDs for random assignment
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return {
    hunters: shuffled.slice(0, hunterCount),
    runners: shuffled.slice(hunterCount),
  };
}

module.exports = { assignTeams };
```

**Step 2: Verify formula manually**

| total | runnerCount = ceil((t+1)/2) | hunterCount = t - r | H = R - 1? |
|-------|---------------------------|---------------------|------------|
| 4 | 3 | 1 | Yes |
| 5 | 3 | 2 | Yes |
| 6 | 4 | 2 | Yes |
| 7 | 4 | 3 | Yes |
| 8 | 5 | 3 | Yes |

**Step 3: Commit**

```bash
git add server/teams.js
git commit -m "feat: add team assignment algorithm (H = R - 1)"
```

---

## Task 4: Lobby System

**Files:**
- Create: `server/lobby.js`
- Modify: `server/index.js`

**Step 1: Create server/lobby.js**

```js
const C = require('../shared/constants');

class Lobby {
  constructor(io) {
    this.io = io;
    this.players = new Map(); // socketId -> { name, ready }
    this.countdownTimer = null;
    this.countdownSeconds = 0;
    this.onGameStart = null; // callback set by index.js
  }

  addPlayer(socket, name) {
    if (this.players.size >= C.MAX_PLAYERS) {
      socket.emit('lobby:full');
      return false;
    }
    this.players.set(socket.id, { name, ready: false });
    this.broadcast();
    return true;
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    this.cancelCountdown();
    this.broadcast();
  }

  setReady(socketId, ready) {
    const player = this.players.get(socketId);
    if (!player) return;
    player.ready = ready;
    this.broadcast();
    this.checkAllReady();
  }

  checkAllReady() {
    if (this.players.size < C.MIN_PLAYERS) {
      this.cancelCountdown();
      return;
    }
    const allReady = [...this.players.values()].every((p) => p.ready);
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
      players.push({ id, name: p.name, ready: p.ready });
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
```

**Step 2: Update server/index.js to wire lobby**

Replace `server/index.js` with:

```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Lobby = require('./lobby');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

const PORT = process.env.PORT || 3000;

const lobby = new Lobby(io);
let gameActive = false;

lobby.onGameStart = (playerEntries) => {
  console.log('Game starting with', playerEntries.length, 'players');
  gameActive = true;
  // Game initialization will be wired in Task 5
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', ({ name }) => {
    if (gameActive) {
      socket.emit('lobby:gameInProgress');
      return;
    }
    lobby.addPlayer(socket, name);
  });

  socket.on('ready', ({ ready }) => {
    lobby.setReady(socket.id, ready);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (!gameActive) {
      lobby.removePlayer(socket.id);
    }
    // In-game disconnect handled by game.js (Task 5)
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io, lobby };
```

**Step 3: Verify server starts without errors**

Run: `node server/index.js`
Expected: `Server running on port 3000`

**Step 4: Commit**

```bash
git add server/lobby.js server/index.js
git commit -m "feat: add lobby system with ready/countdown"
```

---

## Task 5: Server Game Loop

**Files:**
- Create: `server/game.js`
- Modify: `server/index.js`

**Step 1: Create server/game.js**

```js
const C = require('../shared/constants');
const { assignTeams } = require('./teams');
const { generateObstacles, generateSpawnPoints } = require('./map');

class Game {
  constructor(io, playerEntries, onGameEnd) {
    this.io = io;
    this.onGameEnd = onGameEnd;
    this.tickTimer = null;
    this.timerInterval = null;
    this.timeRemaining = C.GAME_DURATION;

    // Build player map from lobby entries
    // playerEntries: [[socketId, { name }], ...]
    const ids = playerEntries.map(([id]) => id);
    const { hunters, runners } = assignTeams(ids);

    this.obstacles = generateObstacles();
    const spawns = generateSpawnPoints(hunters, runners);

    this.players = new Map();
    for (const [id, { name }] of playerEntries) {
      const team = hunters.includes(id) ? 'hunter' : 'runner';
      const spawn = spawns[id];
      this.players.set(id, {
        name,
        team,
        x: spawn.x,
        y: spawn.y,
        angle: 0,
        moving: false,
        state: 'free',    // free | carried | caged
        carriedBy: null,
        inBush: false,
        struggleCount: 0,
      });
    }

    this.cages = C.CAGE_POSITIONS.map((pos) => ({
      x: pos.x,
      y: pos.y,
      prisoners: [],
      rescueProgress: 0,
    }));

    this.disconnected = new Map(); // socketId -> { timeout, playerData }
  }

  start() {
    // Send game:start to all players
    const playersData = {};
    for (const [id, p] of this.players) {
      playersData[id] = {
        name: p.name,
        x: p.x,
        y: p.y,
        team: p.team,
        state: p.state,
      };
    }

    this.io.emit('game:start', {
      players: playersData,
      cages: this.cages,
      obstacles: this.obstacles,
    });

    // Start tick loop
    this.tickTimer = setInterval(() => this.tick(), C.TICK_INTERVAL);

    // Start game timer
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  tick() {
    // 1. Apply inputs and movement
    for (const [id, p] of this.players) {
      if (p.state === 'carried' || p.state === 'caged') continue;
      if (!p.moving) continue;

      let speed = C.PLAYER_SPEED / C.TICK_RATE;

      // Slow down hunter if carrying
      if (p.team === 'hunter' && this.isCarrying(id)) {
        speed *= C.HUNTER_CARRY_SPEED_MULT;
      }

      const dx = Math.cos(p.angle) * speed;
      const dy = Math.sin(p.angle) * speed;
      let newX = p.x + dx;
      let newY = p.y + dy;

      // 2. Circular boundary check
      const dist = Math.sqrt(newX * newX + newY * newY);
      if (dist > C.MAP_RADIUS) {
        const scale = C.MAP_RADIUS / dist;
        newX *= scale;
        newY *= scale;
      }

      // 3. Obstacle collision (simple circle-circle)
      let blocked = false;
      for (const obs of this.obstacles) {
        if (obs.type === 'bush') continue; // bushes don't block
        const odx = newX - obs.x;
        const ody = newY - obs.y;
        const oDist = Math.sqrt(odx * odx + ody * ody);
        const minDist = obs.radius + 16; // 16 = player radius
        if (oDist < minDist) {
          // Push player out
          const pushScale = minDist / oDist;
          newX = obs.x + odx * pushScale;
          newY = obs.y + ody * pushScale;
        }
      }

      p.x = newX;
      p.y = newY;

      // Update carried runner position
      this.updateCarriedRunner(id, p);
    }

    // 4. Bush detection
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

    // 5. Capture check
    this.checkCaptures();

    // 6. Cage zone check
    this.checkCageDeposit();

    // 7. Struggle decay (1 per second = 1/TICK_RATE per tick)
    for (const [id, p] of this.players) {
      if (p.state === 'carried' && p.struggleCount > 0) {
        p.struggleCount -= 1 / C.TICK_RATE;
        if (p.struggleCount < 0) p.struggleCount = 0;
      }
    }

    // 8. Check instant win
    this.checkInstantWin();

    // 9. Broadcast state
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
      this.freePlayer(socketId);
      this.io.emit('game:freed', { playerId: socketId });
    }
  }

  handleRescue(socketId, cageIndex) {
    const player = this.players.get(socketId);
    if (!player || player.team !== 'runner' || player.state !== 'free') return;

    const cage = this.cages[cageIndex];
    if (!cage || cage.prisoners.length === 0) return;

    // Check distance to cage
    const dx = player.x - cage.x;
    const dy = player.y - cage.y;
    if (Math.sqrt(dx * dx + dy * dy) > C.CAGE_ZONE_RADIUS) return;

    cage.rescueProgress++;
    if (cage.rescueProgress >= C.CAGE_RESCUE_THRESHOLD) {
      // Free all prisoners
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
      ([, p]) => p.team === 'hunter' && p.state === 'free' && !this.isCarrying(p)
    );
    const runners = [...this.players.entries()].filter(
      ([, p]) => p.team === 'runner' && p.state === 'free'
    );

    for (const [hId, h] of hunters) {
      if (this.isCarrying(hId)) continue;
      for (const [rId, r] of runners) {
        const dx = h.x - r.x;
        const dy = h.y - r.y;
        if (Math.sqrt(dx * dx + dy * dy) < C.CAPTURE_DISTANCE) {
          r.state = 'carried';
          r.carriedBy = hId;
          r.struggleCount = 0;
          this.io.emit('game:capture', { hunterId: hId, runnerId: rId });
          break; // One capture per hunter per tick
        }
      }
    }
  }

  checkCageDeposit() {
    for (const [id, p] of this.players) {
      if (p.team !== 'hunter') continue;
      // Find carried runner
      const carried = [...this.players.entries()].find(
        ([, r]) => r.state === 'carried' && r.carriedBy === id
      );
      if (!carried) continue;

      const [runnerId, runner] = carried;

      // Check if hunter is near any cage
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
        // Position behind hunter
        p.x = hunter.x - Math.cos(hunter.angle) * 30;
        p.y = hunter.y - Math.sin(hunter.angle) * 30;
        break;
      }
    }
  }

  freePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.state = 'free';
    player.carriedBy = null;
    player.struggleCount = 0;
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
        x: Math.round(p.x),
        y: Math.round(p.y),
        angle: p.angle,
        team: p.team,
        state: p.state,
        carriedBy: p.carriedBy,
        inBush: p.inBush,
        name: p.name,
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

    // Gather stats
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

    // If hunter carrying someone, free the runner
    if (player.team === 'hunter') {
      for (const [rId, r] of this.players) {
        if (r.state === 'carried' && r.carriedBy === socketId) {
          this.freePlayer(rId);
          this.io.emit('game:freed', { playerId: rId });
        }
      }
    }

    // If runner is carried, free them
    if (player.state === 'carried') {
      this.freePlayer(socketId);
    }

    // Remove from cage if caged
    for (const cage of this.cages) {
      cage.prisoners = cage.prisoners.filter((id) => id !== socketId);
    }

    this.players.delete(socketId);

    // If not enough players, end game
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
```

**Step 2: Update server/index.js to wire game**

Replace `server/index.js`:

```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Lobby = require('./lobby');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'client')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

const PORT = process.env.PORT || 3000;

const lobby = new Lobby(io);
let game = null;

function returnToLobby() {
  game = null;
  lobby.clear();
  console.log('Returned to lobby');
}

lobby.onGameStart = (playerEntries) => {
  console.log('Game starting with', playerEntries.length, 'players');
  game = new Game(io, playerEntries, () => {
    // After game ends, wait 5 seconds then return to lobby
    setTimeout(returnToLobby, 5000);
  });
  game.start();
};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join', ({ name }) => {
    if (game) {
      socket.emit('lobby:gameInProgress');
      return;
    }
    lobby.addPlayer(socket, name);
  });

  socket.on('ready', ({ ready }) => {
    if (game) return;
    lobby.setReady(socket.id, ready);
  });

  socket.on('input', (data) => {
    if (game) game.handleInput(socket.id, data);
  });

  socket.on('struggle', () => {
    if (game) game.handleStruggle(socket.id);
  });

  socket.on('rescue', ({ cageIndex }) => {
    if (game) game.handleRescue(socket.id, cageIndex);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    if (game && game.hasPlayer(socket.id)) {
      game.handleDisconnect(socket.id);
    } else {
      lobby.removePlayer(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 3: Verify server starts**

Run: `node server/index.js`
Expected: `Server running on port 3000`

**Step 4: Commit**

```bash
git add server/game.js server/index.js
git commit -m "feat: add game loop with capture, struggle, cage mechanics"
```

---

## Task 6: Client - Socket Wrapper

**Files:**
- Create: `client/network/socket.js`

**Step 1: Create client/network/socket.js**

```js
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

// Global singleton
window.network = new NetworkManager();
```

**Step 2: Commit**

```bash
git add client/network/socket.js
git commit -m "feat: add client socket wrapper"
```

---

## Task 7: Client - Boot Scene

**Files:**
- Create: `client/scenes/BootScene.js`
- Modify: `client/main.js`
- Modify: `client/index.html`

**Step 1: Create client/scenes/BootScene.js**

This scene generates all game graphics programmatically (no external asset files needed).

```js
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload() {
    // Show loading text
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.loadingText = this.add.text(w / 2, h / 2, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  create() {
    // Generate duck sprites programmatically
    this.generateDuckTexture('duck-hunter', 0xcc3333); // Red duck
    this.generateDuckTexture('duck-runner', 0xf0c020); // Yellow duck

    // Generate obstacle textures
    this.generateCircleTexture('rock', 0x888888, 40);
    this.generateCircleTexture('tree-trunk', 0x6b4226, 15);
    this.generateCircleTexture('tree-canopy', 0x2d7a2d, 35);
    this.generateCircleTexture('bush', 0x3a8a3a, 45);
    this.generateCircleTexture('cage', 0xaaaaaa, 80);
    this.generateCircleTexture('cage-active', 0xff6666, 80);

    // Ground texture
    this.generateCircleTexture('ground', 0x4a8a2a, 16);

    // Connect to server
    window.network.connect().then(() => {
      this.scene.start('Lobby');
    });
  }

  generateDuckTexture(key, color) {
    const g = this.add.graphics();
    // Duck body (oval)
    g.fillStyle(color, 1);
    g.fillEllipse(16, 18, 28, 22);
    // Duck head
    g.fillCircle(28, 12, 8);
    // Beak
    g.fillStyle(0xff8800, 1);
    g.fillTriangle(36, 12, 30, 8, 30, 16);
    // Eye
    g.fillStyle(0x000000, 1);
    g.fillCircle(30, 10, 2);
    g.generateTexture(key, 40, 32);
    g.destroy();
  }

  generateCircleTexture(key, color, radius) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }
}
```

**Step 2: Update client/index.html to load scripts**

Replace `client/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <title>Duck Hunt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; overflow: hidden; touch-action: none; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="game-container"></div>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/shared/constants.js"></script>
  <script src="network/socket.js"></script>
  <script src="scenes/BootScene.js"></script>
  <script src="scenes/LobbyScene.js"></script>
  <script src="scenes/GameScene.js"></script>
  <script src="scenes/ResultScene.js"></script>
  <script src="main.js"></script>
</body>
</html>
```

**Step 3: Update client/main.js**

```js
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#1a3a0a',
  scene: [BootScene, LobbyScene, GameScene, ResultScene],
};

const game = new Phaser.Game(config);
```

**Step 4: Commit**

```bash
git add client/scenes/BootScene.js client/index.html client/main.js
git commit -m "feat: add boot scene with generated textures"
```

---

## Task 8: Client - Lobby Scene

**Files:**
- Create: `client/scenes/LobbyScene.js`

**Step 1: Create client/scenes/LobbyScene.js**

```js
class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Lobby' });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Title
    this.add.text(w / 2, 40, '🦆 Duck Hunt', {
      fontSize: '32px',
      color: '#f0c020',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Name input prompt
    this.playerName = 'Player' + Math.floor(Math.random() * 1000);
    this.nameText = this.add.text(w / 2, 90, 'Name: ' + this.playerName, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Player list
    this.playerListText = this.add.text(w / 2, 150, 'Connecting...', {
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
    }).setOrigin(0.5, 0);

    // Ready button
    this.isReady = false;
    this.readyBtn = this.add.text(w / 2, h - 100, '[ HAZIR ]', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.readyBtn.on('pointerdown', () => {
      this.isReady = !this.isReady;
      this.readyBtn.setText(this.isReady ? '[ HAZIR ✓ ]' : '[ HAZIR ]');
      this.readyBtn.setBackgroundColor(this.isReady ? '#2d7a2d' : '#444444');
      window.network.emit('ready', { ready: this.isReady });
    });

    // Countdown text
    this.countdownText = this.add.text(w / 2, h - 160, '', {
      fontSize: '36px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Join lobby
    window.network.emit('join', { name: this.playerName });

    // Listen for lobby updates
    window.network.on('lobby:update', ({ players }) => {
      let text = `Oyuncular (${players.length}/${CONSTANTS.MAX_PLAYERS}):\n\n`;
      players.forEach((p) => {
        const readyMark = p.ready ? ' ✓' : '';
        const youMark = p.id === window.network.id ? ' (Sen)' : '';
        text += `${p.name}${readyMark}${youMark}\n`;
      });
      if (players.length < CONSTANTS.MIN_PLAYERS) {
        text += `\nMinimum ${CONSTANTS.MIN_PLAYERS} oyuncu gerekli`;
      }
      this.playerListText.setText(text);
    });

    window.network.on('lobby:countdown', ({ seconds }) => {
      if (seconds > 0) {
        this.countdownText.setText(`Oyun ${seconds} saniye içinde başlıyor!`);
      } else {
        this.countdownText.setText('');
      }
    });

    window.network.on('game:start', (data) => {
      this.scene.start('Game', data);
    });

    window.network.on('lobby:full', () => {
      this.playerListText.setText('Lobi dolu!');
    });

    window.network.on('lobby:gameInProgress', () => {
      this.playerListText.setText('Oyun devam ediyor, lütfen bekleyin...');
    });

    // Handle resize
    this.scale.on('resize', (gameSize) => {
      const nw = gameSize.width;
      const nh = gameSize.height;
      this.readyBtn.setPosition(nw / 2, nh - 100);
      this.countdownText.setPosition(nw / 2, nh - 160);
    });
  }
}
```

**Step 2: Commit**

```bash
git add client/scenes/LobbyScene.js
git commit -m "feat: add lobby scene with ready system UI"
```

---

## Task 9: Client - Game Scene (Core)

**Files:**
- Create: `client/scenes/GameScene.js`
- Create: `client/input/joystick.js`

**Step 1: Create client/input/joystick.js**

```js
class VirtualJoystick {
  constructor(scene) {
    this.scene = scene;
    this.angle = 0;
    this.moving = false;
    this.pointer = null;
    this.baseX = 0;
    this.baseY = 0;
    this.stickX = 0;
    this.stickY = 0;
    this.maxDistance = 50;
    this.deadZone = 10;

    // Joystick graphics
    this.base = scene.add.circle(0, 0, 60, 0x000000, 0.3)
      .setScrollFactor(0).setDepth(1000).setVisible(false);
    this.stick = scene.add.circle(0, 0, 25, 0xffffff, 0.5)
      .setScrollFactor(0).setDepth(1001).setVisible(false);

    // Touch handlers
    scene.input.on('pointerdown', (ptr) => this.onDown(ptr));
    scene.input.on('pointermove', (ptr) => this.onMove(ptr));
    scene.input.on('pointerup', (ptr) => this.onUp(ptr));
  }

  onDown(ptr) {
    // Only use left half of screen for joystick
    if (ptr.x > this.scene.cameras.main.width * 0.5) return;
    this.pointer = ptr;
    this.baseX = ptr.x;
    this.baseY = ptr.y;
    this.base.setPosition(ptr.x, ptr.y).setVisible(true);
    this.stick.setPosition(ptr.x, ptr.y).setVisible(true);
  }

  onMove(ptr) {
    if (!this.pointer || ptr.id !== this.pointer.id) return;
    const dx = ptr.x - this.baseX;
    const dy = ptr.y - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.deadZone) {
      this.moving = true;
      this.angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, this.maxDistance);
      this.stickX = this.baseX + Math.cos(this.angle) * clampedDist;
      this.stickY = this.baseY + Math.sin(this.angle) * clampedDist;
    } else {
      this.moving = false;
      this.stickX = this.baseX;
      this.stickY = this.baseY;
    }
    this.stick.setPosition(this.stickX, this.stickY);
  }

  onUp(ptr) {
    if (!this.pointer || ptr.id !== this.pointer.id) return;
    this.pointer = null;
    this.moving = false;
    this.base.setVisible(false);
    this.stick.setVisible(false);
  }

  destroy() {
    this.base.destroy();
    this.stick.destroy();
  }
}
```

**Step 2: Create client/scenes/GameScene.js**

```js
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Game' });
  }

  init(data) {
    this.gameData = data; // { players, cages, obstacles }
  }

  create() {
    const myId = window.network.id;
    const myTeam = this.gameData.players[myId]?.team;

    // World bounds (square that contains the circle)
    this.cameras.main.setBounds(
      -CONSTANTS.MAP_RADIUS, -CONSTANTS.MAP_RADIUS,
      CONSTANTS.WORLD_SIZE, CONSTANTS.WORLD_SIZE
    );

    // Draw ground circle
    this.drawMap();

    // Draw obstacles
    this.obstacleSprites = [];
    for (const obs of this.gameData.obstacles) {
      let sprite;
      if (obs.type === 'rock') {
        sprite = this.add.image(obs.x, obs.y, 'rock')
          .setDisplaySize(obs.radius * 2, obs.radius * 2);
      } else if (obs.type === 'tree') {
        // Trunk + canopy
        this.add.image(obs.x, obs.y, 'tree-trunk');
        sprite = this.add.image(obs.x, obs.y - 10, 'tree-canopy')
          .setDisplaySize(70, 70);
      } else if (obs.type === 'bush') {
        sprite = this.add.image(obs.x, obs.y, 'bush')
          .setDisplaySize(obs.radius * 2, obs.radius * 2).setAlpha(0.7);
      }
      if (sprite) {
        sprite._obsData = obs;
        this.obstacleSprites.push(sprite);
      }
    }

    // Draw cages
    this.cageSprites = [];
    for (let i = 0; i < this.gameData.cages.length; i++) {
      const cage = this.gameData.cages[i];
      const cageSprite = this.add.image(cage.x, cage.y, 'cage').setAlpha(0.5);
      const cageText = this.add.text(cage.x, cage.y - 90, 'Kafes', {
        fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5);
      const progressText = this.add.text(cage.x, cage.y + 90, '', {
        fontSize: '12px', color: '#ffaaaa',
      }).setOrigin(0.5);
      this.cageSprites.push({ sprite: cageSprite, text: cageText, progressText, index: i });
    }

    // Player sprites map
    this.playerSprites = {};
    for (const [id, p] of Object.entries(this.gameData.players)) {
      this.createPlayerSprite(id, p);
    }

    // Camera follow self
    const mySpr = this.playerSprites[myId];
    if (mySpr) {
      this.cameras.main.startFollow(mySpr.container, true, 0.1, 0.1);
    }

    // Joystick
    this.joystick = new VirtualJoystick(this);

    // Tap for struggle/rescue (right half of screen)
    this.input.on('pointerdown', (ptr) => {
      if (ptr.x <= this.cameras.main.width * 0.5) return; // left half = joystick
      const me = this.latestState?.players?.[myId];
      if (!me) return;

      if (me.state === 'carried') {
        window.network.emit('struggle', {});
      } else if (me.state === 'free' && me.team === 'runner') {
        // Check if near a cage
        const nearCage = this.findNearestCage(me.x, me.y);
        if (nearCage !== null) {
          window.network.emit('rescue', { cageIndex: nearCage });
        }
      }
    });

    // HUD
    this.timerText = this.add.text(10, 10, '', {
      fontSize: '20px', color: '#ffffff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(999);

    this.teamText = this.add.text(10, 42, myTeam === 'hunter' ? 'HUNTER 🔴' : 'RUNNER 🟡', {
      fontSize: '16px', color: myTeam === 'hunter' ? '#ff4444' : '#f0c020',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(999);

    this.statusText = this.add.text(this.cameras.main.width / 2, 10, '', {
      fontSize: '18px', color: '#ff8888', fontStyle: 'bold',
      backgroundColor: '#00000088', padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(999);

    // Input send interval
    this.inputTimer = this.time.addEvent({
      delay: CONSTANTS.TICK_INTERVAL,
      callback: () => {
        window.network.emit('input', {
          angle: this.joystick.angle,
          moving: this.joystick.moving,
        });
      },
      loop: true,
    });

    // State listener
    this.latestState = null;
    window.network.on('game:state', (state) => {
      this.latestState = state;
    });

    window.network.on('game:end', (data) => {
      this.joystick.destroy();
      this.scene.start('Result', data);
    });

    // Resize handler
    this.scale.on('resize', (gameSize) => {
      this.statusText.setPosition(gameSize.width / 2, 10);
    });
  }

  update() {
    if (!this.latestState) return;
    const myId = window.network.id;
    const state = this.latestState;

    // Update timer
    const min = Math.floor(state.timer / 60);
    const sec = state.timer % 60;
    this.timerText.setText(`⏱ ${min}:${sec.toString().padStart(2, '0')}`);

    // Update player positions with interpolation
    for (const [id, p] of Object.entries(state.players)) {
      let spr = this.playerSprites[id];
      if (!spr) {
        spr = this.createPlayerSprite(id, p);
      }

      // Lerp position
      const lerpFactor = 0.3;
      spr.container.x += (p.x - spr.container.x) * lerpFactor;
      spr.container.y += (p.y - spr.container.y) * lerpFactor;

      // Flip duck based on direction
      if (p.angle !== undefined) {
        spr.sprite.setFlipX(Math.abs(p.angle) > Math.PI / 2);
      }

      // Name label
      spr.nameLabel.setText(p.name);

      // Visibility (bush mechanic)
      if (id !== myId && p.inBush) {
        const me = state.players[myId];
        if (me && me.team !== p.team) {
          const dx = p.x - me.x;
          const dy = p.y - me.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const alpha = dist < CONSTANTS.BUSH_VISIBILITY_DISTANCE
            ? 1 - (dist / CONSTANTS.BUSH_VISIBILITY_DISTANCE)
            : 0;
          spr.container.setAlpha(Math.max(0.05, alpha));
        } else {
          spr.container.setAlpha(0.6); // Teammates see bush players dimmed
        }
      } else {
        spr.container.setAlpha(1);
      }

      // Carried/caged visual
      if (p.state === 'caged') {
        spr.container.setAlpha(0.5);
      }
    }

    // Remove sprites for disconnected players
    for (const id of Object.keys(this.playerSprites)) {
      if (!state.players[id]) {
        this.playerSprites[id].container.destroy();
        delete this.playerSprites[id];
      }
    }

    // Update cage visuals
    for (const cageSpr of this.cageSprites) {
      const cageData = state.cages[cageSpr.index];
      if (cageData.prisoners.length > 0) {
        cageSpr.sprite.setTexture('cage-active');
        cageSpr.text.setText(`Kafes (${cageData.prisoners.length})`);
      } else {
        cageSpr.sprite.setTexture('cage');
        cageSpr.text.setText('Kafes');
      }
      if (cageData.rescueProgress > 0) {
        cageSpr.progressText.setText(`Kurtarma: ${cageData.rescueProgress}/${CONSTANTS.CAGE_RESCUE_THRESHOLD}`);
      } else {
        cageSpr.progressText.setText('');
      }
    }

    // Status text for self
    const me = state.players[myId];
    if (me) {
      if (me.state === 'carried') {
        this.statusText.setText('Yakalandın! Sağ tarafa tıkla → Deben!');
      } else if (me.state === 'caged') {
        this.statusText.setText('Kafestesin! Takım arkadaşını bekle...');
      } else {
        this.statusText.setText('');
      }
    }
  }

  createPlayerSprite(id, data) {
    const textureKey = data.team === 'hunter' ? 'duck-hunter' : 'duck-runner';
    const container = this.add.container(data.x, data.y);
    const sprite = this.add.image(0, 0, textureKey);
    const nameLabel = this.add.text(0, -24, data.name || '', {
      fontSize: '11px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    container.add([sprite, nameLabel]);
    container.setDepth(100);

    this.playerSprites[id] = { container, sprite, nameLabel };
    return this.playerSprites[id];
  }

  drawMap() {
    // Draw circular ground
    const g = this.add.graphics();
    g.fillStyle(0x4a8a2a, 1);
    g.fillCircle(0, 0, CONSTANTS.MAP_RADIUS);
    // Border ring
    g.lineStyle(4, 0x2d5a1b, 1);
    g.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS);
    g.setDepth(-1);

    // Darker outside
    const outer = this.add.graphics();
    outer.fillStyle(0x1a1a1a, 0.8);
    // Fill corners outside the circle (approximate with rect minus circle)
    outer.fillRect(-CONSTANTS.MAP_RADIUS, -CONSTANTS.MAP_RADIUS, CONSTANTS.WORLD_SIZE, CONSTANTS.WORLD_SIZE);
    // Cut out the circle by drawing ground on top
    outer.setDepth(-2);
  }

  findNearestCage(px, py) {
    for (let i = 0; i < CONSTANTS.CAGE_POSITIONS.length; i++) {
      const c = CONSTANTS.CAGE_POSITIONS[i];
      const dx = px - c.x;
      const dy = py - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < CONSTANTS.CAGE_ZONE_RADIUS * 2) {
        return i;
      }
    }
    return null;
  }
}
```

**Step 3: Commit**

```bash
git add client/scenes/GameScene.js client/input/joystick.js
git commit -m "feat: add game scene with joystick, player rendering, HUD"
```

---

## Task 10: Client - Result Scene

**Files:**
- Create: `client/scenes/ResultScene.js`

**Step 1: Create client/scenes/ResultScene.js**

```js
class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Result' });
  }

  init(data) {
    this.resultData = data; // { winner, stats }
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const { winner, stats } = this.resultData;

    const isHunterWin = winner === 'hunter';
    const winColor = isHunterWin ? '#ff4444' : '#f0c020';
    const winText = isHunterWin ? 'HUNTER KAZANDI!' : 'RUNNER KAZANDI!';

    this.add.text(w / 2, h / 2 - 80, winText, {
      fontSize: '36px',
      color: winColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const statsText = [
      `Toplam Runner: ${stats.totalRunners}`,
      `Kafesteki: ${stats.cagedRunners}`,
      `Serbest: ${stats.freeRunners}`,
    ].join('\n');

    this.add.text(w / 2, h / 2 + 10, statsText, {
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(w / 2, h / 2 + 100, 'Lobiye dönülüyor...', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Return to lobby after 5 seconds
    this.time.delayedCall(5000, () => {
      this.scene.start('Lobby');
    });
  }
}
```

**Step 2: Commit**

```bash
git add client/scenes/ResultScene.js
git commit -m "feat: add result scene with stats display"
```

---

## Task 11: Polish and Integration Test

**Files:**
- Modify: `client/index.html` (ensure all scripts loaded)
- Verify full flow works

**Step 1: Verify client/index.html has correct script order**

Should be:
1. `/socket.io/socket.io.js`
2. `/shared/constants.js`
3. `network/socket.js`
4. `input/joystick.js`
5. `scenes/BootScene.js`
6. `scenes/LobbyScene.js`
7. `scenes/GameScene.js`
8. `scenes/ResultScene.js`
9. `main.js`

Update `client/index.html` if `input/joystick.js` is missing from script tags.

**Step 2: Start server and open browser**

Run: `node server/index.js`
Open: `http://localhost:3000` in browser
Expected: Boot scene loads, connects, transitions to Lobby

**Step 3: Test with multiple tabs**

Open 4+ browser tabs to `http://localhost:3000`.
Each player clicks "HAZIR".
Expected: Countdown starts, game begins, players see duck sprites and can move with joystick.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for full game flow"
```

---

## Task 12: Dockerfile and Docker Compose Verification

**Step 1: Build Docker image**

Run: `docker build -t duck-hunt .`
Expected: Build succeeds

**Step 2: Run with docker-compose**

Run: `docker-compose up -d`
Expected: Container starts, game accessible at `http://localhost:3000`

**Step 3: Test game in Docker**

Open browser to `http://localhost:3000`
Expected: Same behavior as local

**Step 4: Stop container**

Run: `docker-compose down`

**Step 5: Commit if any Dockerfile changes needed**

```bash
git add Dockerfile docker-compose.yml
git commit -m "fix: docker configuration adjustments"
```

---

## Summary of All Tasks

| # | Task | Files | Commits |
|---|------|-------|---------|
| 1 | Project Scaffolding | package.json, shared/constants.js, server/index.js, client/index.html, client/main.js, Dockerfile, docker-compose.yml, .gitignore, .dockerignore | 1 |
| 2 | Map Data | server/map.js | 1 |
| 3 | Team Assignment | server/teams.js | 1 |
| 4 | Lobby System | server/lobby.js, server/index.js | 1 |
| 5 | Game Loop | server/game.js, server/index.js | 1 |
| 6 | Client Socket Wrapper | client/network/socket.js | 1 |
| 7 | Boot Scene | client/scenes/BootScene.js, client/index.html, client/main.js | 1 |
| 8 | Lobby Scene | client/scenes/LobbyScene.js | 1 |
| 9 | Game Scene + Joystick | client/scenes/GameScene.js, client/input/joystick.js | 1 |
| 10 | Result Scene | client/scenes/ResultScene.js | 1 |
| 11 | Integration Test + Polish | Various fixes | 1 |
| 12 | Docker Verification | Dockerfile, docker-compose.yml | 0-1 |

**Total: ~12 tasks, ~12 commits**
