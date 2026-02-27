class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Game' });
  }

  init(data) {
    this.gameData = data;
  }

  create() {
    var myId = window.network.id;
    var myTeam = this.gameData.players[myId]?.team;

    this.cameras.main.setBounds(
      -CONSTANTS.MAP_RADIUS - 50, -CONSTANTS.MAP_RADIUS - 50,
      CONSTANTS.WORLD_SIZE + 100, CONSTANTS.WORLD_SIZE + 100
    );

    this.drawMap();

    this.obstacleSprites = [];
    for (var obs of this.gameData.obstacles) {
      var sprite;
      if (obs.type === 'rock') {
        sprite = this.add.image(obs.x, obs.y, 'rock')
          .setDisplaySize(obs.radius * 2, obs.radius * 2);
      } else if (obs.type === 'tree') {
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

    this.cageSprites = [];
    for (var i = 0; i < this.gameData.cages.length; i++) {
      var cage = this.gameData.cages[i];
      var cageSprite = this.add.image(cage.x, cage.y, 'cage').setAlpha(0.5);
      var cageText = this.add.text(cage.x, cage.y - 90, 'Kafes', {
        fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5);
      var progressText = this.add.text(cage.x, cage.y + 90, '', {
        fontSize: '12px', color: '#ffaaaa',
      }).setOrigin(0.5);
      this.cageSprites.push({ sprite: cageSprite, text: cageText, progressText, index: i });
    }

    this.playerSprites = {};
    for (var [id, p] of Object.entries(this.gameData.players)) {
      this.createPlayerSprite(id, p);
    }

    var mySpr = this.playerSprites[myId];
    if (mySpr) {
      this.cameras.main.startFollow(mySpr.container, true, 0.08, 0.08);
    }

    this.joystick = new VirtualJoystick(this);

    // HUD
    this.timerText = this.add.text(10, 10, '', {
      fontSize: '20px', color: '#ffffff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(999);

    this.teamText = this.add.text(10, 42, myTeam === 'hunter' ? 'HUNTER' : 'RUNNER', {
      fontSize: '16px', color: myTeam === 'hunter' ? '#ff4444' : '#f0c020',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(999);

    this.statusText = this.add.text(812 / 2, 10, '', {
      fontSize: '16px', color: '#ff8888', fontStyle: 'bold',
      backgroundColor: '#00000088', padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(999);

    // --- CENTER COUNTER (struggle + rescue) ---
    this.centerCounter = this.add.text(812 / 2, 375 / 2, ' ', {
      fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#cc333399', padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1010).setAlpha(0);

    // --- TAP ANYWHERE: struggle when carried, rescue when near cage ---
    this.input.on('pointerdown', function() {
      var me = this.latestState?.players?.[window.network.id];
      if (!me) return;
      if (me.state === 'carried') {
        window.network.emit('struggle', {});
        this.cameras.main.flash(50, 255, 100, 100, false);
      } else if (me.state === 'free' && me.team === 'runner') {
        var nearCage = this.findNearestCage(me.x, me.y);
        if (nearCage !== null && this.latestState.cages[nearCage].prisoners.length > 0) {
          window.network.emit('rescue', { cageIndex: nearCage });
          this.cameras.main.flash(50, 100, 255, 100, false);
        }
      }
    }, this);

    // Input send
    this.inputTimer = this.time.addEvent({
      delay: CONSTANTS.TICK_INTERVAL,
      callback: function() {
        window.network.emit('input', {
          angle: this.joystick.angle,
          moving: this.joystick.moving,
        });
      },
      callbackScope: this,
      loop: true,
    });

    this.latestState = null;
    this.prevState = null;
    this.stateTime = 0;

    window.network.on('game:state', function(state) {
      this.prevState = this.latestState;
      this.latestState = state;
      this.stateTime = 0;
    }.bind(this));

    window.network.on('game:end', function(data) {
      this.joystick.destroy();
      this.scene.start('Result', data);
    }.bind(this));
  }

  update(time, delta) {
    if (!this.latestState) return;
    var myId = window.network.id;
    var state = this.latestState;

    // Timer
    var min = Math.floor(state.timer / 60);
    var sec = state.timer % 60;
    this.timerText.setText('T ' + min + ':' + (sec < 10 ? '0' : '') + sec);

    // Interpolation timing
    this.stateTime += delta;
    var t = Math.min(this.stateTime / CONSTANTS.TICK_INTERVAL, 1);

    // Client-side prediction for local player
    var mySpr = this.playerSprites[myId];
    if (mySpr && this.joystick.moving) {
      var me = state.players[myId];
      if (me && me.state === 'free') {
        var speed = CONSTANTS.PLAYER_SPEED * (delta / 1000);
        var dx = Math.cos(this.joystick.angle) * speed;
        var dy = Math.sin(this.joystick.angle) * speed;
        mySpr.container.x += dx;
        mySpr.container.y += dy;
        // Clamp to map bounds
        var dist = Math.sqrt(mySpr.container.x * mySpr.container.x + mySpr.container.y * mySpr.container.y);
        if (dist > CONSTANTS.MAP_RADIUS) {
          var scale = CONSTANTS.MAP_RADIUS / dist;
          mySpr.container.x *= scale;
          mySpr.container.y *= scale;
        }
      }
    }

    for (var [id, p] of Object.entries(state.players)) {
      var spr = this.playerSprites[id];
      if (!spr) {
        spr = this.createPlayerSprite(id, p);
      }

      var isMe = id === myId;

      // For local player: gentle reconciliation. For others: time-based interpolation.
      if (isMe) {
        var lerpFactor = 0.08;
        spr.container.x += (p.x - spr.container.x) * lerpFactor;
        spr.container.y += (p.y - spr.container.y) * lerpFactor;
      } else if (this.prevState && this.prevState.players[id]) {
        var prev = this.prevState.players[id];
        spr.container.x = prev.x + (p.x - prev.x) * t;
        spr.container.y = prev.y + (p.y - prev.y) * t;
      } else {
        spr.container.x += (p.x - spr.container.x) * 0.2;
        spr.container.y += (p.y - spr.container.y) * 0.2;
      }

      if (p.angle !== undefined) {
        spr.sprite.setFlipX(Math.abs(p.angle) > Math.PI / 2);
      }

      spr.nameLabel.setText(p.name);

      if (id !== myId && p.inBush) {
        var meData = state.players[myId];
        if (meData && meData.team !== p.team) {
          var bdx = p.x - meData.x;
          var bdy = p.y - meData.y;
          var bdist = Math.sqrt(bdx * bdx + bdy * bdy);
          var alpha = bdist < CONSTANTS.BUSH_VISIBILITY_DISTANCE
            ? 1 - (bdist / CONSTANTS.BUSH_VISIBILITY_DISTANCE)
            : 0;
          spr.container.setAlpha(Math.max(0.05, alpha));
        } else {
          spr.container.setAlpha(0.6);
        }
      } else {
        spr.container.setAlpha(1);
      }

      if (p.state === 'caged') {
        spr.container.setAlpha(0.5);
      }
    }

    // Remove disconnected
    for (var pid of Object.keys(this.playerSprites)) {
      if (!state.players[pid]) {
        this.playerSprites[pid].container.destroy();
        delete this.playerSprites[pid];
      }
    }

    // Cages
    for (var cageSpr of this.cageSprites) {
      var cageData = state.cages[cageSpr.index];
      if (cageData.prisoners.length > 0) {
        cageSpr.sprite.setTexture('cage-active');
        cageSpr.text.setText('Kafes (' + cageData.prisoners.length + ')');
      } else {
        cageSpr.sprite.setTexture('cage');
        cageSpr.text.setText('Kafes');
      }
      if (cageData.rescueProgress > 0) {
        cageSpr.progressText.setText('Kurtarma: ' + cageData.rescueProgress + '/' + CONSTANTS.CAGE_RESCUE_THRESHOLD);
      } else {
        cageSpr.progressText.setText('');
      }
    }

    // UI logic
    var meState = state.players[myId];
    if (meState) {
      if (meState.state === 'carried') {
        var count = Math.floor(meState.struggleCount || 0);
        this.centerCounter.setText('TIKLA! ' + count + '/' + CONSTANTS.STRUGGLE_THRESHOLD);
        this.centerCounter.setBackgroundColor('#cc333399');
        this.centerCounter.setAlpha(1);
        this.statusText.setText('Yakalandin! Ekrana tikla!');
      } else if (meState.state === 'caged') {
        this.centerCounter.setAlpha(0);
        this.statusText.setText('Kafestesin! Bekle...');
      } else if (meState.state === 'free') {
        // Immunity indicator
        if (meState.immune) {
          this.statusText.setText('IMMUNE!');
        } else {
          this.statusText.setText('');
        }
        // Rescue counter for runners near cage with prisoners
        if (meState.team === 'runner') {
          var nearCage = this.findNearestCage(meState.x, meState.y);
          if (nearCage !== null && state.cages[nearCage].prisoners.length > 0) {
            this.centerCounter.setText('KURTAR! ' + state.cages[nearCage].rescueProgress + '/' + CONSTANTS.CAGE_RESCUE_THRESHOLD);
            this.centerCounter.setBackgroundColor('#33aa3399');
            this.centerCounter.setAlpha(1);
            if (!meState.immune) {
              this.statusText.setText('Kafese yakin! Tikla!');
            }
          } else {
            this.centerCounter.setAlpha(0);
          }
        } else {
          this.centerCounter.setAlpha(0);
        }
      } else {
        this.centerCounter.setAlpha(0);
        this.statusText.setText('');
      }

      // Immune player visual: blink effect
      var mySprU = this.playerSprites[myId];
      if (mySprU && meState.immune) {
        mySprU.container.setAlpha(0.5 + Math.sin(this.time.now / 100) * 0.5);
      }
    }
  }

  createPlayerSprite(id, data) {
    var textureKey = data.team === 'hunter' ? 'duck-hunter' : 'duck-runner';
    var container = this.add.container(data.x, data.y);
    var sprite = this.add.image(0, 0, textureKey);
    var nameLabel = this.add.text(0, -24, data.name || '', {
      fontSize: '11px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    container.add([sprite, nameLabel]);
    container.setDepth(100);

    this.playerSprites[id] = { container: container, sprite: sprite, nameLabel: nameLabel };
    return this.playerSprites[id];
  }

  drawMap() {
    // Dark outside area
    var outer = this.add.graphics();
    outer.fillStyle(0x111111, 1);
    outer.fillRect(
      -CONSTANTS.MAP_RADIUS - 200, -CONSTANTS.MAP_RADIUS - 200,
      CONSTANTS.WORLD_SIZE + 400, CONSTANTS.WORLD_SIZE + 400
    );
    outer.setDepth(-3);

    // Green playable area
    var g = this.add.graphics();
    g.fillStyle(0x4a8a2a, 1);
    g.fillCircle(0, 0, CONSTANTS.MAP_RADIUS);
    g.setDepth(-1);

    // Thick visible border
    var border = this.add.graphics();
    border.lineStyle(6, 0xff4444, 0.8);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS);
    // Second ring for visibility
    border.lineStyle(2, 0xffffff, 0.3);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS + 4);
    border.setDepth(50);

    // Dashed warning ring inside
    var warning = this.add.graphics();
    warning.lineStyle(1, 0xffaa00, 0.3);
    warning.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS - 30);
    warning.setDepth(-1);
  }

  findNearestCage(px, py) {
    for (var i = 0; i < CONSTANTS.CAGE_POSITIONS.length; i++) {
      var c = CONSTANTS.CAGE_POSITIONS[i];
      var dx = px - c.x;
      var dy = py - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < CONSTANTS.CAGE_ZONE_RADIUS * 2.5) {
        return i;
      }
    }
    return null;
  }
}
