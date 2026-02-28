class CountdownScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Countdown' });
  }

  init(data) {
    this.gameData = data;
  }

  preload() {
    if (!this.cache.audio.exists('sfx-game-start')) {
      this.load.audio('sfx-game-start', 'assets/game-start.mp3');
    }
    // Ensure my team's skins are loaded for avatar display
    var myId = window.network.id;
    var myData = this.gameData && this.gameData.players && this.gameData.players[myId];
    if (myData) {
      var isHunter = myData.team === 'hunter';
      var skins = isHunter ? (window.hunterSkins || []) : (window.runnerSkins || []);
      var folder = isHunter ? 'hunters' : 'runners';
      var pfx = isHunter ? 'hunter-skin-' : 'runner-skin-';
      for (var si = 0; si < skins.length; si++) {
        if (!this.textures.exists(pfx + si)) {
          this.load.spritesheet(pfx + si, 'assets/' + folder + '/' + skins[si], { frameWidth: 256, frameHeight: 256 });
        }
      }
    }
  }

  create() {
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    var font = 'Fredoka, sans-serif';
    var myId = window.network.id;
    var myData = this.gameData.players[myId];
    var isHunter = myData && myData.team === 'hunter';

    // Create skin animations if not yet created (skins may have been loaded in preload)
    var skins = isHunter ? (window.hunterSkins || []) : (window.runnerSkins || []);
    var teamStr = isHunter ? 'hunter' : 'runner';
    var pfx = isHunter ? 'hunter-skin-' : 'runner-skin-';
    for (var si = 0; si < skins.length; si++) {
      var sk = pfx + si;
      if (this.textures.exists(sk) && !this.anims.exists(teamStr + '-walk-' + si)) {
        this.anims.create({ key: teamStr + '-walk-' + si, frames: this.anims.generateFrameNumbers(sk, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: teamStr + '-idle-' + si, frames: [{ key: sk, frame: 0 }], frameRate: 1 });
      }
    }

    // Background gradient — matches lobby orange
    var bg = this.add.graphics();
    bg.fillGradientStyle(0xFFAA00, 0xFFAA00, 0xFFD786, 0xFFD786, 1);
    bg.fillRect(0, 0, w, h);

    // Team label
    var teamName = isHunter ? 'KOVALAYAN' : 'KAÇAN';
    var teamColor = isHunter ? '#7a0000' : '#003300';
    this.add.text(w / 2, 50, teamName, {
      fontFamily: font, fontSize: '42px', color: teamColor,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    // Team subtitle
    var teamDesc = isHunter ? 'Kaçanları yakala!' : 'Yakalanmadan kaç!';
    this.add.text(w / 2, 90, teamDesc, {
      fontFamily: font, fontSize: '14px', color: '#5a2200',
    }).setOrigin(0.5);

    // Avatar sprite
    if (myData) {
      var skin = myData.skin !== undefined ? myData.skin : -1;
      var sheetKey = null;
      if (isHunter && skin >= 0 && this.textures.exists('hunter-skin-' + skin)) {
        sheetKey = 'hunter-skin-' + skin;
      } else if (!isHunter && skin >= 0 && this.textures.exists('runner-skin-' + skin)) {
        sheetKey = 'runner-skin-' + skin;
      }

      var avatar;
      if (sheetKey) {
        avatar = this.add.sprite(w / 2, h / 2 - 10, sheetKey, 0).setDisplaySize(128, 128);
        // Play idle animation
        var idleKey = isHunter ? 'hunter-idle-' + skin : 'runner-idle-' + skin;
        if (this.anims.exists(idleKey)) {
          avatar.play(idleKey);
        }
      } else {
        var fallbackKey = isHunter ? 'duck-hunter' : 'duck-runner';
        avatar = this.add.image(w / 2, h / 2 - 10, fallbackKey).setDisplaySize(96, 76);
      }

      // Gentle floating animation on avatar
      this.tweens.add({
        targets: avatar,
        y: avatar.y - 8,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Player name below avatar
      this.add.text(w / 2, h / 2 + 60, myData.name || '', {
        fontFamily: font, fontSize: '18px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5);
    }

    // Game start sound
    this.sound.play('sfx-game-start', { volume: 0.5 });

    // Countdown text (starts hidden, shown by timer)
    this.countdownText = this.add.text(w / 2, h - 60, '', {
      fontFamily: font, fontSize: '64px', color: '#ffffff',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0);

    // Start countdown sequence: 3 → 2 → 1 → BASLA!
    var self = this;
    var counts = ['3', '2', '1', 'BASLA!'];
    var delay = 0;

    for (var i = 0; i < counts.length; i++) {
      (function(idx) {
        self.time.delayedCall(delay + idx * 1000, function() {
          self.countdownText.setText(counts[idx]);
          self.countdownText.setAlpha(1);
          self.countdownText.setScale(1.5);
          if (counts[idx] === 'BASLA!') {
            self.countdownText.setColor('#f0c020');
            self.countdownText.setFontSize('48px');
          } else {
            self.countdownText.setColor('#ffffff');
            self.countdownText.setFontSize('64px');
          }
          self.tweens.add({
            targets: self.countdownText,
            scale: 1,
            duration: 400,
            ease: 'Back.easeOut',
          });
        });
      })(i);
    }

    // Transition to game after countdown
    this.time.delayedCall(counts.length * 1000, function() {
      self.scene.start('Game', self.gameData);
    });
  }
}
