class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Lobby' });
  }

  create() {
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    var font = 'Fredoka, sans-serif';
    var self = this;

    this.myTeam = null;
    this.mySkin = -1;

    // Background gradient
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x1a3a0a, 0x1a3a0a, 0x0d1f05, 0x0d1f05, 1);
    bg.fillRect(0, 0, w, h);

    // ── LEFT PANEL ──────────────────────────────────────
    // Title
    this.add.text(10, 12, 'DUCK HUNT', {
      fontFamily: font, fontSize: '28px', color: '#f0c020',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    });

    this.add.text(10, 42, 'Yakalanmadan hayatta kal!', {
      fontFamily: font, fontSize: '11px', color: '#88bb66',
    });

    // Team selection label
    this.add.text(10, 62, 'Takımını seç:', {
      fontFamily: font, fontSize: '13px', color: '#cccccc',
    });

    // AVCI button
    this.hunterBtn = this.add.text(10, 82, 'AVCI', {
      fontFamily: font, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#444444', padding: { x: 16, y: 7 },
    }).setInteractive({ useHandCursor: true });

    // KAÇAK button
    this.runnerBtn = this.add.text(100, 82, 'KAÇAK', {
      fontFamily: font, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#444444', padding: { x: 16, y: 7 },
    }).setInteractive({ useHandCursor: true });

    this.teamRejectText = this.add.text(200, 88, '', {
      fontFamily: font, fontSize: '11px', color: '#ff6644',
    });

    // Player list panel
    var panelBg = this.add.graphics();
    panelBg.fillStyle(0x000000, 0.3);
    panelBg.fillRoundedRect(5, 130, 370, 230, 6);

    this.playerListTitle = this.add.text(185, 138, 'Oyuncular', {
      fontFamily: font, fontSize: '13px', color: '#f0c020', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.playerListText = this.add.text(185, 158, 'Baglaniliyor...', {
      fontFamily: font, fontSize: '12px', color: '#cccccc',
      align: 'center', lineSpacing: 4, wordWrap: { width: 360 },
    }).setOrigin(0.5, 0);

    // Countdown text
    this.countdownText = this.add.text(185, 340, '', {
      fontFamily: font, fontSize: '16px', color: '#ff6644', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // ── RIGHT PANEL ──────────────────────────────────────
    var rx = 420; // right panel start x

    // Name
    var names = CONSTANTS.PLAYER_NAMES;
    this.playerName = names[Math.floor(Math.random() * names.length)];

    this.add.text(rx, 12, 'İsmin:', {
      fontFamily: font, fontSize: '12px', color: '#aaaaaa',
    });

    this.nameTag = this.add.text(rx, 30, this.playerName, {
      fontFamily: font, fontSize: '19px', color: '#ffffff',
      backgroundColor: '#ffffff22', padding: { x: 12, y: 5 },
    }).setInteractive({ useHandCursor: true });

    this.add.text(rx, 58, 'değiştirmek için tikla', {
      fontFamily: font, fontSize: '9px', color: '#555555',
    });

    this.nameTag.on('pointerdown', function() {
      self.playerName = names[Math.floor(Math.random() * names.length)];
      self.nameTag.setText(self.playerName);
      window.network.emit('name:update', { name: self.playerName });
    });

    // Skin label
    this.skinLabel = this.add.text(rx, 80, 'Skin seç:', {
      fontFamily: font, fontSize: '12px', color: '#aaaaaa',
    }).setAlpha(0);

    // Skin grid (will be populated when team is selected)
    this.skinSprites = [];
    this.skinSelectionGraphics = this.add.graphics();

    // Ready button
    this.isReady = false;
    this.readyBtn = this.add.text(605, h - 48, 'HAZIR', {
      fontFamily: font, fontSize: '22px', color: '#888888', fontStyle: 'bold',
      backgroundColor: '#333333', padding: { x: 36, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.readyBtn.on('pointerdown', function() {
      if (!self.myTeam) return;
      self.isReady = !self.isReady;
      self.readyBtn.setText(self.isReady ? 'HAZIR ✓' : 'HAZIR');
      self.readyBtn.setBackgroundColor(self.isReady ? '#2d7a2d' : '#333333');
      self.readyBtn.setColor(self.isReady ? '#ffffff' : '#888888');
      window.network.emit('ready', { ready: self.isReady });
    });

    // ── TEAM BUTTON HANDLERS ──────────────────────────────
    this.hunterBtn.on('pointerdown', function() {
      window.network.emit('team:select', { team: 'hunter' });
    });
    this.runnerBtn.on('pointerdown', function() {
      window.network.emit('team:select', { team: 'runner' });
    });

    // ── MENU MUSIC ──────────────────────────────────────
    if (!this.sound.get('sfx-menu')) {
      this.menuMusic = this.sound.add('sfx-menu', { volume: 0.3, loop: true });
    } else {
      this.menuMusic = this.sound.get('sfx-menu');
    }
    if (!this.menuMusic.isPlaying) {
      this.menuMusic.play();
    }

    // ── JOIN ──────────────────────────────────────────────
    window.network.emit('join', { name: this.playerName });

    // ── SOCKET EVENTS ──────────────────────────────────────
    window.network.on('lobby:update', function(data) {
      var players = data.players;
      self.playerListTitle.setText('Oyuncular (' + players.length + '/' + CONSTANTS.MAX_PLAYERS + ')');

      // Find my team from server data
      for (var i = 0; i < players.length; i++) {
        if (players[i].id === window.network.id) {
          var serverTeam = players[i].team;
          if (serverTeam !== self.myTeam) {
            self.myTeam = serverTeam;
            self.updateTeamButtons();
            self.buildSkinGrid();
          }
          break;
        }
      }

      // Count teams for button labels
      var hCount = players.filter(function(p) { return p.team === 'hunter'; }).length;
      var rCount = players.filter(function(p) { return p.team === 'runner'; }).length;
      self.hunterBtn.setText('AVCI (' + hCount + ')');
      self.runnerBtn.setText('KAÇAK (' + rCount + ')');

      // Build player list
      var lines = [];
      for (var j = 0; j < players.length; j++) {
        var p = players[j];
        var teamBadge = p.team === 'hunter' ? ' [AVCI]' : p.team === 'runner' ? ' [KAÇAK]' : ' [?]';
        var readyBadge = p.ready ? ' ✓' : '';
        var meBadge = p.id === window.network.id ? ' (Sen)' : '';
        lines.push(p.name + teamBadge + readyBadge + meBadge);
      }
      if (players.length < CONSTANTS.MIN_PLAYERS) {
        lines.push('');
        lines.push('Min ' + CONSTANTS.MIN_PLAYERS + ' oyuncu gerekli');
      }
      self.playerListText.setText(lines.join('\n'));
    });

    window.network.on('lobby:team-rejected', function(data) {
      var msg = data.team === 'hunter' ? 'Avcı takımı dolu!' : 'Kaçak takımı dolu!';
      self.teamRejectText.setText(msg);
      self.time.delayedCall(2000, function() { self.teamRejectText.setText(''); });
    });

    window.network.on('lobby:countdown', function(data) {
      if (data.seconds > 0) {
        self.countdownText.setText('Oyun ' + data.seconds + 's içinde başlıyor!');
      } else {
        self.countdownText.setText('');
      }
    });

    window.network.on('game:start', function(data) {
      if (self.menuMusic) self.menuMusic.stop();
      self.scene.start('Countdown', data);
    });

    window.network.on('lobby:full', function() {
      self.playerListText.setText('Lobi dolu!');
    });

    window.network.on('lobby:gameInProgress', function() {
      self.playerListText.setText('Oyun devam ediyor, bekleyin...');
    });
  }

  updateTeamButtons() {
    var hunterColor = this.myTeam === 'hunter' ? '#ff4444' : '#ffffff';
    var hunterBg = this.myTeam === 'hunter' ? '#883300' : '#444444';
    var runnerColor = this.myTeam === 'runner' ? '#f0c020' : '#ffffff';
    var runnerBg = this.myTeam === 'runner' ? '#664400' : '#444444';
    this.hunterBtn.setColor(hunterColor).setBackgroundColor(hunterBg);
    this.runnerBtn.setColor(runnerColor).setBackgroundColor(runnerBg);

    // Enable ready button style once team chosen
    if (this.myTeam && !this.isReady) {
      this.readyBtn.setColor('#ffffff').setBackgroundColor('#555555');
    }
  }

  buildSkinGrid() {
    // Destroy old skin sprites
    for (var i = 0; i < this.skinSprites.length; i++) {
      this.skinSprites[i].destroy();
    }
    this.skinSprites = [];
    this.skinSelectionGraphics.clear();

    if (!this.myTeam) {
      this.skinLabel.setAlpha(0);
      return;
    }

    this.skinLabel.setAlpha(1);

    var skins = this.myTeam === 'hunter' ? window.hunterSkins : window.runnerSkins;
    var prefix = this.myTeam === 'hunter' ? 'hunter-skin-' : 'runner-skin-';
    var self = this;
    var startX = 420;
    var startY = 100;
    var size = 58;
    var gap = 6;
    var perRow = 6;

    for (var j = 0; j < skins.length; j++) {
      var key = prefix + j;
      if (!this.textures.exists(key)) continue;

      var col = j % perRow;
      var row = Math.floor(j / perRow);
      var x = startX + col * (size + gap) + size / 2;
      var y = startY + row * (size + gap) + size / 2;

      var spr = this.add.sprite(x, y, key, 0)
        .setDisplaySize(size, size)
        .setInteractive({ useHandCursor: true });

      (function(skinIndex, sx, sy) {
        spr.on('pointerdown', function() {
          self.mySkin = skinIndex;
          window.network.emit('skin:select', { skin: skinIndex });
          self.highlightSkin(sx, sy, size);
        });
        spr.on('pointerover', function() { spr.setAlpha(0.8); });
        spr.on('pointerout', function() { spr.setAlpha(1); });
      })(j, x, y);

      this.skinSprites.push(spr);
    }

    // Restore highlight if skin already selected
    if (this.mySkin >= 0 && this.mySkin < this.skinSprites.length) {
      var sel = this.skinSprites[this.mySkin];
      this.highlightSkin(sel.x, sel.y, size);
    }
  }

  highlightSkin(x, y, size) {
    this.skinSelectionGraphics.clear();
    this.skinSelectionGraphics.lineStyle(3, 0xf0c020, 1);
    this.skinSelectionGraphics.strokeRect(x - size / 2 - 2, y - size / 2 - 2, size + 4, size + 4);
  }
}
