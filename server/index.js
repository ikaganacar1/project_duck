const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Lobby = require('./lobby');
const Game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
});

// No-cache headers for all static files
app.use(function(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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
