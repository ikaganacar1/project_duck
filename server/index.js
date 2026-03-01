const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const Lobby = require('./lobby');
const Game = require('./game');

const BASE = process.env.APP_BASE_PATH || '';

const app = express();
app.use(compression());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
  path: BASE + '/socket.io',
});

// Smart caching: versioned assets cached 1 year, HTML no-cache
app.use(function(req, res, next) {
  if (req.query.v) {
    // Versioned JS/assets — cache forever (cache-busting via ?v=N)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (req.path.match(/\.(png|mp3|svg|jpg|webp)$/i)) {
    // Unversioned assets — cache 1 week
    res.setHeader('Cache-Control', 'public, max-age=604800');
  } else {
    // HTML and everything else — always revalidate
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

app.use(BASE, express.static(path.join(__dirname, '..', 'client')));
app.use(BASE + '/shared', express.static(path.join(__dirname, '..', 'shared')));

// Scan skins at startup
const runnersDir = path.join(__dirname, '..', 'client', 'assets', 'runners');
const huntersDir = path.join(__dirname, '..', 'client', 'assets', 'hunters');
let runnerSkins = [];
let hunterSkins = [];
try {
  runnerSkins = fs.readdirSync(runnersDir).filter(f => f.endsWith('.png')).sort();
  console.log('Runner skins found:', runnerSkins.length);
} catch (e) {
  console.log('No runner skins directory found');
}
try {
  hunterSkins = fs.readdirSync(huntersDir).filter(f => f.endsWith('.png')).sort();
  console.log('Hunter skins found:', hunterSkins.length);
} catch (e) {
  console.log('No hunter skins directory found');
}

app.get(BASE + '/api/skins', (req, res) => {
  res.json({ runners: runnerSkins, hunters: hunterSkins });
});

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
    setTimeout(returnToLobby, 5000);
  }, runnerSkins.length, hunterSkins.length);
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

  socket.on('team:select', ({ team }) => {
    if (game) return;
    lobby.setTeam(socket.id, team);
  });

  socket.on('skin:select', ({ skin }) => {
    if (game) return;
    lobby.setSkin(socket.id, skin);
  });

  socket.on('name:update', ({ name }) => {
    if (game) return;
    lobby.setName(socket.id, name);
  });

  socket.on('spectate', ({ name }) => {
    if (game) {
      game.addSpectator(socket.id);
      socket.emit('game:spectate', game.getFullState());
    } else {
      lobby.removePlayer(socket.id); // remove from players to avoid duplicate
      lobby.addSpectator(socket, name);
    }
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
    } else if (game && game.hasSpectator(socket.id)) {
      game.removeSpectator(socket.id);
    } else {
      lobby.removePlayer(socket.id);
      lobby.removeSpectator(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
