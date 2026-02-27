class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Game' });
  }

  init(data) {
    this.gameData = data;
  }

  create() {
    const myId = window.network.id;
    const myTeam = this.gameData.players[myId]?.team;

    this.cameras.main.setBounds(
      -CONSTANTS.MAP_RADIUS, -CONSTANTS.MAP_RADIUS,
      CONSTANTS.WORLD_SIZE, CONSTANTS.WORLD_SIZE
    );

    this.drawMap();

    this.obstacleSprites = [];
    for (const obs of this.gameData.obstacles) {
      let sprite;
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
    for (let i = 0; i < this.gameData.cages.length; i++) {
      const cage = this.gameData.cages[i];
      const cageSprite = this.add.image(cage.x, cage.y, 'cage').setAlpha(0.5);
      const cageText = this.add.text(cage.x, cage.y - 90, 'Kafes', {
        fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5);
      const progressText = this.add.text(cage.x, cage.y + 90, '', {
        fontSize: '12px', color: '#ffaaaa',
      }).setOrigin(0.5);
      this.cageSprites.push({ sprite: cageSprite, text: cageText, progressText, index: i });
    }

    this.playerSprites = {};
    for (const [id, p] of Object.entries(this.gameData.players)) {
      this.createPlayerSprite(id, p);
    }

    const mySpr = this.playerSprites[myId];
    if (mySpr) {
      this.cameras.main.startFollow(mySpr.container, true, 0.1, 0.1);
    }

    this.joystick = new VirtualJoystick(this);

    this.input.on('pointerdown', (ptr) => {
      if (ptr.x <= this.cameras.main.width * 0.5) return;
      const me = this.latestState?.players?.[myId];
      if (!me) return;

      if (me.state === 'carried') {
        window.network.emit('struggle', {});
      } else if (me.state === 'free' && me.team === 'runner') {
        const nearCage = this.findNearestCage(me.x, me.y);
        if (nearCage !== null) {
          window.network.emit('rescue', { cageIndex: nearCage });
        }
      }
    });

    this.timerText = this.add.text(10, 10, '', {
      fontSize: '20px', color: '#ffffff', backgroundColor: '#00000088',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(999);

    this.teamText = this.add.text(10, 42, myTeam === 'hunter' ? 'HUNTER' : 'RUNNER', {
      fontSize: '16px', color: myTeam === 'hunter' ? '#ff4444' : '#f0c020',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(999);

    this.statusText = this.add.text(this.cameras.main.width / 2, 10, '', {
      fontSize: '18px', color: '#ff8888', fontStyle: 'bold',
      backgroundColor: '#00000088', padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(999);

    this.inputTimer = this.time.addEvent({
      delay: CONSTANTS.TICK_INTERVAL,
      callback: () => {
        window.network.emit('input', {
          angle: this.joystick.angle,
          moving: this.joystick.moving,
        });
      },
      loop: true,
    });

    this.latestState = null;
    this.myLastInput = { angle: 0, moving: false };
    window.network.on('game:state', (state) => {
      this.latestState = state;
    });

    window.network.on('game:end', (data) => {
      this.joystick.destroy();
      this.scene.start('Result', data);
    });

    this.scale.on('resize', (gameSize) => {
      this.statusText.setPosition(gameSize.width / 2, 10);
    });
  }

  update() {
    if (!this.latestState) return;
    const myId = window.network.id;
    const state = this.latestState;

    const min = Math.floor(state.timer / 60);
    const sec = state.timer % 60;
    this.timerText.setText('T ' + min + ':' + (sec < 10 ? '0' : '') + sec);

    // Client-side prediction: move local player immediately
    const mySpr = this.playerSprites[myId];
    if (mySpr && this.joystick.moving) {
      const me = state.players[myId];
      if (me && me.state === 'free') {
        const speed = CONSTANTS.PLAYER_SPEED / 60; // 60fps approx
        const dx = Math.cos(this.joystick.angle) * speed;
        const dy = Math.sin(this.joystick.angle) * speed;
        mySpr.container.x += dx;
        mySpr.container.y += dy;
      }
    }

    for (const [id, p] of Object.entries(state.players)) {
      let spr = this.playerSprites[id];
      if (!spr) {
        spr = this.createPlayerSprite(id, p);
      }

      // Local player: gentle reconciliation with server. Others: standard lerp.
      const isMe = id === myId;
      const lerpFactor = isMe ? 0.1 : 0.15;
      spr.container.x += (p.x - spr.container.x) * lerpFactor;
      spr.container.y += (p.y - spr.container.y) * lerpFactor;

      if (p.angle !== undefined) {
        spr.sprite.setFlipX(Math.abs(p.angle) > Math.PI / 2);
      }

      spr.nameLabel.setText(p.name);

      if (id !== myId && p.inBush) {
        const me = state.players[myId];
        if (me && me.team !== p.team) {
          const dx = p.x - me.x;
          const dy = p.y - me.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const alpha = dist < CONSTANTS.BUSH_VISIBILITY_DISTANCE
            ? 1 - (dist / CONSTANTS.BUSH_VISIBILITY_DISTANCE)
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

    for (const id of Object.keys(this.playerSprites)) {
      if (!state.players[id]) {
        this.playerSprites[id].container.destroy();
        delete this.playerSprites[id];
      }
    }

    for (const cageSpr of this.cageSprites) {
      const cageData = state.cages[cageSpr.index];
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

    const me = state.players[myId];
    if (me) {
      if (me.state === 'carried') {
        this.statusText.setText('Yakalandin! Sag tarafa tikla - Deben!');
      } else if (me.state === 'caged') {
        this.statusText.setText('Kafestesin! Takim arkadasini bekle...');
      } else {
        this.statusText.setText('');
      }
    }
  }

  createPlayerSprite(id, data) {
    const textureKey = data.team === 'hunter' ? 'duck-hunter' : 'duck-runner';
    const container = this.add.container(data.x, data.y);
    const sprite = this.add.image(0, 0, textureKey);
    const nameLabel = this.add.text(0, -24, data.name || '', {
      fontSize: '11px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    container.add([sprite, nameLabel]);
    container.setDepth(100);

    this.playerSprites[id] = { container, sprite, nameLabel };
    return this.playerSprites[id];
  }

  drawMap() {
    const g = this.add.graphics();
    g.fillStyle(0x4a8a2a, 1);
    g.fillCircle(0, 0, CONSTANTS.MAP_RADIUS);
    g.lineStyle(4, 0x2d5a1b, 1);
    g.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS);
    g.setDepth(-1);

    const outer = this.add.graphics();
    outer.fillStyle(0x1a1a1a, 0.8);
    outer.fillRect(-CONSTANTS.MAP_RADIUS, -CONSTANTS.MAP_RADIUS, CONSTANTS.WORLD_SIZE, CONSTANTS.WORLD_SIZE);
    outer.setDepth(-2);
  }

  findNearestCage(px, py) {
    for (let i = 0; i < CONSTANTS.CAGE_POSITIONS.length; i++) {
      const c = CONSTANTS.CAGE_POSITIONS[i];
      const dx = px - c.x;
      const dy = py - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < CONSTANTS.CAGE_ZONE_RADIUS * 2) {
        return i;
      }
    }
    return null;
  }
}
