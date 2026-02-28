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
    this.hunterCount = 0;
    this.runnerCount = 0;

    // ── BACKGROUND ──────────────────────────────────────
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x0d1f05, 0x0d1f05, 0x1a0a00, 0x1a0a00, 1);
    bg.fillRect(0, 0, w, h);

    // Divider line
    var div = this.add.graphics();
    div.lineStyle(1, 0x334422, 0.6);
    div.lineBetween(400, 0, 400, h);

    // ── LEFT PANEL ──────────────────────────────────────
    this.add.text(14, 10, 'DUCK HUNT', {
      fontFamily: font, fontSize: '30px', color: '#f0c020',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    });
    this.add.text(14, 42, 'Yakalanmadan hayatta kal!', {
      fontFamily: font, fontSize: '11px', color: '#77aa44',
    });

    // Team count header
    this.teamHeader = this.add.text(200, 62, '', {
      fontFamily: font, fontSize: '13px', color: '#cccccc', align: 'center',
    }).setOrigin(0.5, 0);

    // Player list background
    var listBg = this.add.graphics();
    listBg.fillStyle(0x000000, 0.35);
    listBg.fillRoundedRect(8, 82, 385, 200, 8);

    this.playerListTitle = this.add.text(200, 90, 'Oyuncular', {
      fontFamily: font, fontSize: '12px', color: '#aaaaaa', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.playerListText = this.add.text(200, 108, 'Bağlanılıyor...', {
      fontFamily: font, fontSize: '13px', color: '#dddddd',
      align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0);

    // ── TEAM JOIN BUTTONS (below player list) ──────────
    this.hunterBtn = this.add.text(103, 298, 'AVCI TAKIM', {
      fontFamily: font, fontSize: '15px', fontStyle: 'bold',
      color: '#ffaaaa', backgroundColor: '#5a1a1a',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.runnerBtn = this.add.text(297, 298, 'KAÇAK TAKIM', {
      fontFamily: font, fontSize: '15px', fontStyle: 'bold',
      color: '#ffffaa', backgroundColor: '#4a3a00',
      padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.hunterBtn.on('pointerover', function() { if (!self._hunterFull) self.hunterBtn.setAlpha(0.8); });
    this.hunterBtn.on('pointerout', function() { self.hunterBtn.setAlpha(self._hunterFull ? 0.35 : 1); });
    this.hunterBtn.on('pointerdown', function() { if (!self._hunterFull) window.network.emit('team:select', { team: 'hunter' }); });

    this.runnerBtn.on('pointerover', function() { self.runnerBtn.setAlpha(0.8); });
    this.runnerBtn.on('pointerout', function() { self.runnerBtn.setAlpha(1); });
    this.runnerBtn.on('pointerdown', function() { window.network.emit('team:select', { team: 'runner' }); });

    // Countdown
    this.countdownText = this.add.text(200, 340, '', {
      fontFamily: font, fontSize: '15px', color: '#ff9944', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // ── RIGHT PANEL ──────────────────────────────────────
    var rx = 415;

    // Name
    this.add.text(rx, 10, 'İSMİN', {
      fontFamily: font, fontSize: '10px', color: '#888888', fontStyle: 'bold',
    });

    var names = CONSTANTS.PLAYER_NAMES;
    this.playerName = names[Math.floor(Math.random() * names.length)];

    this.nameTag = this.add.text(rx, 24, this.playerName, {
      fontFamily: font, fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#ffffff18', padding: { x: 14, y: 6 },
    }).setInteractive({ useHandCursor: true });

    this.add.text(rx, 55, 'değiştirmek için tıkla', {
      fontFamily: font, fontSize: '9px', color: '#444444',
    });

    this.nameTag.on('pointerdown', function() {
      self.playerName = names[Math.floor(Math.random() * names.length)];
      self.nameTag.setText(self.playerName);
      window.network.emit('name:update', { name: self.playerName });
    });

    // Skin section
    this.skinLabel = this.add.text(rx, 74, 'SKİN SEÇ', {
      fontFamily: font, fontSize: '10px', color: '#888888', fontStyle: 'bold',
    }).setAlpha(0);

    this.skinSprites = [];
    this.skinSelectionGraphics = this.add.graphics();

    // Ready button
    this.isReady = false;
    this.readyBtn = this.add.text(606, h - 38, 'HAZIR DEĞİL', {
      fontFamily: font, fontSize: '17px', color: '#666666', fontStyle: 'bold',
      backgroundColor: '#222222', padding: { x: 28, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.readyBtn.on('pointerdown', function() {
      if (!self.myTeam) return;
      self.isReady = !self.isReady;
      self.readyBtn.setText(self.isReady ? '✓ HAZIR' : 'HAZIR DEĞİL');
      self.readyBtn.setStyle({
        color: self.isReady ? '#00ff88' : '#aaaaaa',
        backgroundColor: self.isReady ? '#0a4422' : '#222222',
      });
      window.network.emit('ready', { ready: self.isReady });
    });

    // ── POPUP for team rejected ──────────────────────────
    this.popupBg = this.add.graphics().setDepth(500).setAlpha(0);
    this.popupText = this.add.text(w / 2, h / 2, '', {
      fontFamily: font, fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#cc2200dd', padding: { x: 28, y: 14 },
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(501).setAlpha(0);

    // ── MENU MUSIC ──────────────────────────────────────
    if (!this.sound.get('sfx-menu')) {
      this.menuMusic = this.sound.add('sfx-menu', { volume: 0.3, loop: true });
    } else {
      this.menuMusic = this.sound.get('sfx-menu');
    }
    if (!this.menuMusic.isPlaying) this.menuMusic.play();

    // ── JOIN ──────────────────────────────────────────────
    window.network.emit('join', { name: this.playerName });

    // ── SOCKET EVENTS ────────────────────────────────────
    window.network.on('lobby:update', function(data) {
      var players = data.players;
      var hCount = 0;
      var rCount = 0;
      for (var i = 0; i < players.length; i++) {
        if (players[i].team === 'hunter') hCount++;
        if (players[i].team === 'runner') rCount++;
      }
      self.hunterCount = hCount;
      self.runnerCount = rCount;

      // Header
      self.teamHeader.setText(
        '🔴 AVCILAR: ' + hCount + '    🟡 KAÇAKLAR: ' + rCount
      );

      // Hunter button dimmed if full
      self._hunterFull = hCount >= rCount && (hCount > 0 || rCount > 0);
      self.hunterBtn.setAlpha(self._hunterFull ? 0.3 : 1);

      // Title
      self.playerListTitle.setText('OYUNCULAR (' + players.length + '/' + CONSTANTS.MAX_PLAYERS + ')');

      // Find my team from server
      for (var j = 0; j < players.length; j++) {
        if (players[j].id === window.network.id) {
          var serverTeam = players[j].team;
          if (serverTeam !== self.myTeam) {
            self.myTeam = serverTeam;
            self.updateTeamButtons();
            self.buildSkinGrid();
          }
          break;
        }
      }

      // Player list
      var lines = [];
      for (var k = 0; k < players.length; k++) {
        var p = players[k];
        var badge = p.team === 'hunter' ? '🔴' : p.team === 'runner' ? '🟡' : '⚪';
        var ready = p.ready ? ' ✓' : '';
        var me = p.id === window.network.id ? ' ← sen' : '';
        lines.push(badge + ' ' + p.name + ready + me);
      }
      if (players.length < CONSTANTS.MIN_PLAYERS) {
        lines.push('');
        lines.push('min ' + CONSTANTS.MIN_PLAYERS + ' oyuncu gerekli');
      }
      self.playerListText.setText(lines.join('\n'));
    });

    window.network.on('lobby:team-rejected', function() {
      self.showPopup('Avcı takımı dolu! Önce kaçak seç.');
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

  showPopup(msg) {
    var self = this;
    this.popupText.setText(msg).setAlpha(1).setScale(0.7);
    this.tweens.add({
      targets: this.popupText, scale: 1, duration: 200, ease: 'Back.easeOut',
    });
    if (this._popupTimer) this._popupTimer.remove();
    this._popupTimer = this.time.delayedCall(2000, function() {
      self.tweens.add({
        targets: self.popupText, alpha: 0, duration: 400, ease: 'Quad.easeIn',
      });
    });
  }

  updateTeamButtons() {
    // Highlight the selected team button
    if (this.myTeam === 'hunter') {
      this.hunterBtn.setStyle({ color: '#ff6666', backgroundColor: '#881111' });
      this.runnerBtn.setStyle({ color: '#ffffaa', backgroundColor: '#4a3a00' });
    } else if (this.myTeam === 'runner') {
      this.runnerBtn.setStyle({ color: '#ffee44', backgroundColor: '#886600' });
      this.hunterBtn.setStyle({ color: '#ffaaaa', backgroundColor: '#5a1a1a' });
    }
    // Unlock ready button
    if (this.myTeam && !this.isReady) {
      this.readyBtn.setStyle({ color: '#aaaaaa', backgroundColor: '#333333' });
      this.readyBtn.setText('HAZIR DEĞİL');
    }
  }

  buildSkinGrid() {
    for (var i = 0; i < this.skinSprites.length; i++) {
      this.skinSprites[i].destroy();
    }
    this.skinSprites = [];
    this.skinSelectionGraphics.clear();

    if (!this.myTeam) { this.skinLabel.setAlpha(0); return; }

    this.skinLabel.setAlpha(1);
    var skins = this.myTeam === 'hunter' ? window.hunterSkins : window.runnerSkins;
    var prefix = this.myTeam === 'hunter' ? 'hunter-skin-' : 'runner-skin-';
    var self = this;
    var startX = 421;
    var startY = 92;
    var size = 56;
    var gap = 5;
    var perRow = 7;

    for (var j = 0; j < skins.length; j++) {
      var key = prefix + j;
      if (!this.textures.exists(key)) continue;
      var col = j % perRow;
      var row = Math.floor(j / perRow);
      var x = startX + col * (size + gap) + size / 2;
      var y = startY + row * (size + gap) + size / 2;

      var spr = this.add.sprite(x, y, key, 0).setDisplaySize(size, size)
        .setInteractive({ useHandCursor: true });

      (function(skinIndex, sx, sy) {
        spr.on('pointerdown', function() {
          self.mySkin = skinIndex;
          window.network.emit('skin:select', { skin: skinIndex });
          self.highlightSkin(sx, sy, size);
        });
        spr.on('pointerover', function() { spr.setAlpha(0.75); });
        spr.on('pointerout', function() { spr.setAlpha(1); });
      })(j, x, y);

      this.skinSprites.push(spr);
    }

    // Restore highlight
    if (this.mySkin >= 0 && this.mySkin < this.skinSprites.length) {
      var sel = this.skinSprites[this.mySkin];
      this.highlightSkin(sel.x, sel.y, size);
    }
  }

  highlightSkin(x, y, size) {
    this.skinSelectionGraphics.clear();
    this.skinSelectionGraphics.lineStyle(3, 0xf0c020, 1);
    this.skinSelectionGraphics.strokeRect(x - size / 2 - 3, y - size / 2 - 3, size + 6, size + 6);
    this.skinSelectionGraphics.lineStyle(1, 0xffffff, 0.4);
    this.skinSelectionGraphics.strokeRect(x - size / 2 - 5, y - size / 2 - 5, size + 10, size + 10);
  }
}
