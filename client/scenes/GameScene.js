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

    // Static shadows (one Graphics object for all obstacles and cages)
    var shadowG = this.add.graphics().setDepth(0);
    shadowG.fillStyle(0x000000, 0.38);

    this.obstacleSprites = [];
    for (var obs of this.gameData.obstacles) {
      var sprite;
      if (obs.type === 'rock') {
        shadowG.fillEllipse(obs.x, obs.y + obs.radius * 0.85, obs.radius * 2, obs.radius * 0.65);
        sprite = this.add.image(obs.x, obs.y, 'rock')
          .setDisplaySize(obs.radius * 2, obs.radius * 2);
      } else if (obs.type === 'tree') {
        shadowG.fillEllipse(obs.x, obs.y + 18, 50, 16);
        this.add.image(obs.x, obs.y, 'tree-trunk').setDisplaySize(30, 30);
        sprite = this.add.image(obs.x, obs.y - 10, 'tree-canopy')
          .setDisplaySize(70, 70);
      } else if (obs.type === 'bush') {
        shadowG.fillEllipse(obs.x, obs.y + obs.radius * 0.5, obs.radius * 1.6, obs.radius * 0.6);
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
      shadowG.fillEllipse(cage.x, cage.y + 75, 140, 35);
      var cageSprite = this.add.image(cage.x, cage.y, 'cage').setDisplaySize(160, 160);
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
      padding: { x: 12, y: 4 },
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
        this.spawnEffect(me.x, me.y, 48);
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

    window.network.on('game:capture', function(data) {
      this.sound.play('sfx-capture', { volume: 0.5 });
      // Fight effect at midpoint between hunter and runner
      var state = this.latestState;
      if (state) {
        var hunter = state.players[data.hunterId];
        var runner = state.players[data.runnerId];
        if (hunter && runner) {
          this.spawnEffect((hunter.x + runner.x) / 2, (hunter.y + runner.y) / 2, 120);
        } else if (runner) {
          this.spawnEffect(runner.x, runner.y, 120);
        }
      }
    }.bind(this));

    window.network.on('game:rescued', function() {
      this.sound.play('sfx-cage-rescue', { volume: 0.5 });
    }.bind(this));

    window.network.on('game:caged', function() {
      this.sound.play('sfx-caged', { volume: 0.5 });
    }.bind(this));

    window.network.on('game:freed', function() {
      this.sound.play('sfx-struggle-free', { volume: 0.5 });
    }.bind(this));

    window.network.on('game:end', function(data) {
      this.joystick.destroy();
      data.myTeam = myTeam;
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

      if (p.moving && p.state === 'free') {
        spr.sprite.setFlipX(Math.cos(p.angle) < 0);
        if (spr.hasSheet) {
          var walkKey = spr.team === 'hunter' ? 'hunter-walk-' + spr.skin : 'runner-walk-' + spr.skin;
          if (!spr.sprite.anims.isPlaying || spr.sprite.anims.currentAnim.key !== walkKey) {
            spr.sprite.play(walkKey);
          }
        }
      } else if (spr.hasSheet) {
        var idleKey = spr.team === 'hunter' ? 'hunter-idle-' + spr.skin : 'runner-idle-' + spr.skin;
        if (!spr.sprite.anims.isPlaying || spr.sprite.anims.currentAnim.key !== idleKey) {
          spr.sprite.play(idleKey);
        }
      }

      // Red blink when carried
      if (p.state === 'carried' && !spr.blinkTween) {
        spr.blinkTween = this.tweens.addCounter({
          from: 0, to: 1, duration: 400, yoyo: true, repeat: -1,
          onUpdate: function(tween) {
            var v = tween.getValue();
            var r = Math.floor(255);
            var g = Math.floor(255 * (1 - v * 0.85));
            var b = Math.floor(255 * (1 - v * 0.85));
            spr.sprite.setTint(Phaser.Display.Color.GetColor(r, g, b));
          },
        });
      } else if (p.state !== 'carried' && spr.blinkTween) {
        spr.blinkTween.stop();
        spr.blinkTween = null;
        spr.sprite.clearTint();
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
        cageSpr.sprite.setTexture('cage-active').setDisplaySize(160, 160);
        cageSpr.text.setText('Kafes (' + cageData.prisoners.length + ')');
      } else {
        cageSpr.sprite.setTexture('cage').setDisplaySize(160, 160);
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
        this.setStatus('Yakalandin! Ekrana tikla!');
      } else if (meState.state === 'caged') {
        this.centerCounter.setAlpha(0);
        this.setStatus('Kafestesin! Bekle...');
      } else if (meState.state === 'free') {
        // Immunity indicator
        if (meState.immune) {
          this.setStatus('IMMUNE!');
        } else {
          this.setStatus('');
        }
        // Rescue counter for runners near cage with prisoners
        if (meState.team === 'runner') {
          var nearCage = this.findNearestCage(meState.x, meState.y);
          if (nearCage !== null && state.cages[nearCage].prisoners.length > 0) {
            this.centerCounter.setText('KURTAR! ' + state.cages[nearCage].rescueProgress + '/' + CONSTANTS.CAGE_RESCUE_THRESHOLD);
            this.centerCounter.setBackgroundColor('#33aa3399');
            this.centerCounter.setAlpha(1);
            if (!meState.immune) {
              this.setStatus('Kafese yakin! Tikla!');
            }
          } else {
            this.centerCounter.setAlpha(0);
          }
        } else {
          this.centerCounter.setAlpha(0);
        }
      } else {
        this.centerCounter.setAlpha(0);
        this.setStatus('');
      }

      // Immune player visual: blink effect
      var mySprU = this.playerSprites[myId];
      if (mySprU && meState.immune) {
        mySprU.container.setAlpha(0.5 + Math.sin(this.time.now / 100) * 0.5);
      }
    }
  }

  createPlayerSprite(id, data) {
    var sheetKey;
    var skin = data.skin !== undefined ? data.skin : -1;
    if (data.team === 'hunter' && skin >= 0 && this.textures.exists('hunter-skin-' + skin)) {
      sheetKey = 'hunter-skin-' + skin;
    } else if (data.team === 'runner' && skin >= 0 && this.textures.exists('runner-skin-' + skin)) {
      sheetKey = 'runner-skin-' + skin;
    } else {
      sheetKey = null;
    }
    var fallbackKey = data.team === 'hunter' ? 'duck-hunter' : 'duck-runner';
    var hasSheet = sheetKey && this.textures.exists(sheetKey);

    var container = this.add.container(data.x, data.y);
    var sprite;
    if (hasSheet) {
      sprite = this.add.sprite(0, 0, sheetKey, 0).setDisplaySize(48, 48);
    } else {
      sprite = this.add.image(0, 0, fallbackKey).setDisplaySize(48, 38);
    }
    var playerShadow = this.add.graphics();
    playerShadow.fillStyle(0x000000, 0.25);
    playerShadow.fillEllipse(0, 20, 36, 12);
    var nameLabel = this.add.text(0, -28, data.name || '', {
      fontSize: '11px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    container.add([playerShadow, sprite, nameLabel]);
    container.setDepth(100);

    this.playerSprites[id] = { container: container, sprite: sprite, nameLabel: nameLabel, hasSheet: hasSheet, team: data.team, skin: skin };
    return this.playerSprites[id];
  }

  spawnEffect(x, y, size) {
    if (!this.textures.exists('fight-effect')) return;
    var spr = this.add.sprite(x, y, 'fight-effect')
      .setDisplaySize(size, size)
      .setDepth(200);
    spr.play('fight-effect');
    spr.once('animationcomplete', function() { spr.destroy(); });
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

    // Map background image centered at origin, scaled to cover the play area
    var mapSize = CONSTANTS.MAP_RADIUS * 2;
    if (this.textures.exists('map-bg')) {
      this.add.image(0, 0, 'map-bg')
        .setDisplaySize(mapSize, mapSize)
        .setDepth(-2);
    } else {
      // Fallback: green circle
      var g = this.add.graphics();
      g.fillStyle(0x4a8a2a, 1);
      g.fillCircle(0, 0, CONSTANTS.MAP_RADIUS);
      g.setDepth(-2);
    }

    // Thick visible border
    var border = this.add.graphics();
    border.lineStyle(6, 0xff4444, 0.8);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS);
    border.lineStyle(2, 0xffffff, 0.3);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS + 4);
    border.setDepth(50);
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

  setStatus(text) {
    this.statusText.setText(text);
    if (text) {
      this.statusText.setBackgroundColor('#00000088');
    } else {
      this.statusText.setBackgroundColor(null);
    }
  }
}
