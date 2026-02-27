class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Lobby' });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    this.add.text(w / 2, 40, 'Duck Hunt', {
      fontSize: '32px',
      color: '#f0c020',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.playerName = 'Player' + Math.floor(Math.random() * 1000);
    this.nameText = this.add.text(w / 2, 90, 'Name: ' + this.playerName, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.playerListText = this.add.text(w / 2, 150, 'Connecting...', {
      fontSize: '16px',
      color: '#cccccc',
      align: 'center',
    }).setOrigin(0.5, 0);

    this.isReady = false;
    this.readyBtn = this.add.text(w / 2, h - 100, '[ HAZIR ]', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#444444',
      padding: { x: 30, y: 15 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.readyBtn.on('pointerdown', () => {
      this.isReady = !this.isReady;
      this.readyBtn.setText(this.isReady ? '[ HAZIR V ]' : '[ HAZIR ]');
      this.readyBtn.setBackgroundColor(this.isReady ? '#2d7a2d' : '#444444');
      window.network.emit('ready', { ready: this.isReady });
    });

    this.countdownText = this.add.text(w / 2, h - 160, '', {
      fontSize: '36px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    window.network.emit('join', { name: this.playerName });

    window.network.on('lobby:update', ({ players }) => {
      let text = 'Oyuncular (' + players.length + '/' + CONSTANTS.MAX_PLAYERS + '):\n\n';
      players.forEach((p) => {
        const readyMark = p.ready ? ' V' : '';
        const youMark = p.id === window.network.id ? ' (Sen)' : '';
        text += p.name + readyMark + youMark + '\n';
      });
      if (players.length < CONSTANTS.MIN_PLAYERS) {
        text += '\nMinimum ' + CONSTANTS.MIN_PLAYERS + ' oyuncu gerekli';
      }
      this.playerListText.setText(text);
    });

    window.network.on('lobby:countdown', ({ seconds }) => {
      if (seconds > 0) {
        this.countdownText.setText('Oyun ' + seconds + ' saniye icinde basliyor!');
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
      this.playerListText.setText('Oyun devam ediyor, lutfen bekleyin...');
    });

    this.scale.on('resize', (gameSize) => {
      const nw = gameSize.width;
      const nh = gameSize.height;
      this.readyBtn.setPosition(nw / 2, nh - 100);
      this.countdownText.setPosition(nw / 2, nh - 160);
    });
  }
}
