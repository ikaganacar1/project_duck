class CountdownScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Countdown' });
  }

  init(data) {
    this.gameData = data;
  }

  create() {
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    var font = 'Fredoka, sans-serif';
    var myId = window.network.id;
    var myData = this.gameData.players[myId];
    var isHunter = myData && myData.team === 'hunter';

    // Background gradient
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x1a3a0a, 0x1a3a0a, 0x0d1f05, 0x0d1f05, 1);
    bg.fillRect(0, 0, w, h);

    // Team label
    var teamName = isHunter ? 'AVCI' : 'KAÇAK';
    var teamColor = isHunter ? '#ff4444' : '#f0c020';
    this.add.text(w / 2, 50, teamName, {
      fontFamily: font, fontSize: '42px', color: teamColor,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);

    // Team subtitle
    var teamDesc = isHunter ? 'Kaçakları yakala!' : 'Yakalanmadan kaç!';
    this.add.text(w / 2, 90, teamDesc, {
      fontFamily: font, fontSize: '14px', color: '#cccccc',
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
