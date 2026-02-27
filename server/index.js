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
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io, lobby };
