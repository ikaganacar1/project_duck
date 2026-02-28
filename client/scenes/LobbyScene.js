class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Lobby' });
  }

  create() {
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    var font = 'Fredoka, sans-serif';

    // Background gradient
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x1a3a0a, 0x1a3a0a, 0x0d1f05, 0x0d1f05, 1);
    bg.fillRect(0, 0, w, h);

    // Title
    this.add.text(w / 2, 30, 'DUCK HUNT', {
      fontFamily: font, fontSize: '36px', color: '#f0c020',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(w / 2, 62, 'Yakalanmadan hayatta kal!', {
      fontFamily: font, fontSize: '13px', color: '#88bb66',
    }).setOrigin(0.5);

    // Random name from config
    var names = CONSTANTS.PLAYER_NAMES;
    this.playerName = names[Math.floor(Math.random() * names.length)];

    // Name display
    this.nameTag = this.add.text(w / 2, 90, this.playerName, {
      fontFamily: font, fontSize: '20px', color: '#ffffff',
      backgroundColor: '#ffffff22', padding: { x: 16, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.add.text(w / 2, 112, 'isim degistirmek icin tikla', {
      fontFamily: font, fontSize: '9px', color: '#666666',
    }).setOrigin(0.5);

    // Tap name to reroll
    this.nameTag.on('pointerdown', function() {
      this.playerName = names[Math.floor(Math.random() * names.length)];
      this.nameTag.setText(this.playerName);
    }, this);

    // Player list panel
    var panelX = w / 2 - 140;
    var panelW = 280;
    this.playerPanel = this.add.graphics();
    this.playerPanel.fillStyle(0x000000, 0.3);
    this.playerPanel.fillRoundedRect(panelX, 128, panelW, 140, 8);

    this.playerListTitle = this.add.text(w / 2, 138, 'Oyuncular', {
      fontFamily: font, fontSize: '14px', color: '#f0c020', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.playerListText = this.add.text(w / 2, 158, 'Baglaniliyor...', {
      fontFamily: font, fontSize: '13px', color: '#cccccc',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5, 0);

    // Ready button
    this.isReady = false;
    this.readyBtn = this.add.text(w / 2, h - 50, 'HAZIR', {
      fontFamily: font, fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#555555', padding: { x: 40, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.readyBtn.on('pointerdown', function() {
      this.isReady = !this.isReady;
      this.readyBtn.setText(this.isReady ? 'HAZIR ✓' : 'HAZIR');
      this.readyBtn.setBackgroundColor(this.isReady ? '#2d7a2d' : '#555555');
      window.network.emit('ready', { ready: this.isReady });
    }, this);

    // Countdown
    this.countdownText = this.add.text(w / 2, h - 90, '', {
      fontFamily: font, fontSize: '20px', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Join
    window.network.emit('join', { name: this.playerName });

    // Events
    window.network.on('lobby:update', function(data) {
      var players = data.players;
      this.playerListTitle.setText('Oyuncular (' + players.length + '/' + CONSTANTS.MAX_PLAYERS + ')');
      var lines = [];
      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var line = p.name;
        if (p.ready) line += '  ✓';
        if (p.id === window.network.id) line += '  (Sen)';
        lines.push(line);
      }
      if (players.length < CONSTANTS.MIN_PLAYERS) {
        lines.push('');
        lines.push('Min ' + CONSTANTS.MIN_PLAYERS + ' oyuncu gerekli');
      }
      this.playerListText.setText(lines.join('\n'));
    }.bind(this));

    window.network.on('lobby:countdown', function(data) {
      if (data.seconds > 0) {
        this.countdownText.setText('Oyun ' + data.seconds + 's icinde basliyor!');
      } else {
        this.countdownText.setText('');
      }
    }.bind(this));

    window.network.on('game:start', function(data) {
      this.scene.start('Game', data);
    }.bind(this));

    window.network.on('lobby:full', function() {
      this.playerListText.setText('Lobi dolu!');
    }.bind(this));

    window.network.on('lobby:gameInProgress', function() {
      this.playerListText.setText('Oyun devam ediyor, bekleyin...');
    }.bind(this));
  }
}
