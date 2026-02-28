class SpectatorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Spectator' });
  }

  init(data) {
    this.gameData = data;
  }

  preload() {
    var rSkins = window.runnerSkins || [];
    var hSkins = window.hunterSkins || [];
    for (var ri = 0; ri < rSkins.length; ri++) {
      if (!this.textures.exists('runner-skin-' + ri))
        this.load.spritesheet('runner-skin-' + ri, 'assets/runners/' + rSkins[ri], { frameWidth: 256, frameHeight: 256 });
    }
    for (var hi = 0; hi < hSkins.length; hi++) {
      if (!this.textures.exists('hunter-skin-' + hi))
        this.load.spritesheet('hunter-skin-' + hi, 'assets/hunters/' + hSkins[hi], { frameWidth: 256, frameHeight: 256 });
    }
  }

  create() {
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    var font = 'Fredoka, sans-serif';

    // Create any missing skin animations
    var rSkins = window.runnerSkins || [];
    var hSkins = window.hunterSkins || [];
    for (var ri = 0; ri < rSkins.length; ri++) {
      if (this.textures.exists('runner-skin-' + ri) && !this.anims.exists('runner-walk-' + ri)) {
        this.anims.create({ key: 'runner-walk-' + ri, frames: this.anims.generateFrameNumbers('runner-skin-' + ri, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'runner-idle-' + ri, frames: [{ key: 'runner-skin-' + ri, frame: 0 }], frameRate: 1 });
      }
    }
    for (var hi2 = 0; hi2 < hSkins.length; hi2++) {
      if (this.textures.exists('hunter-skin-' + hi2) && !this.anims.exists('hunter-walk-' + hi2)) {
        this.anims.create({ key: 'hunter-walk-' + hi2, frames: this.anims.generateFrameNumbers('hunter-skin-' + hi2, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'hunter-idle-' + hi2, frames: [{ key: 'hunter-skin-' + hi2, frame: 0 }], frameRate: 1 });
      }
    }

    // Zoomed out camera to show the whole map
    // Add padding so map doesn't touch screen edges
    var zoom = Math.min(w, h) / (CONSTANTS.MAP_RADIUS * 2 + 160);
    this.zoom = zoom;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(0, 0);

    // Map
    this.drawMap();

    // Static shadows
    var shadowG = this.add.graphics().setDepth(0);
    shadowG.fillStyle(0x000000, 0.38);

    // Obstacles
    this.obstacleSprites = [];
    for (var obs of this.gameData.obstacles) {
      var sprite;
      if (obs.type === 'rock') {
        shadowG.fillEllipse(obs.x, obs.y + obs.radius * 0.85, obs.radius * 2, obs.radius * 0.65);
        sprite = this.add.image(obs.x, obs.y, 'rock').setDisplaySize(obs.radius * 2, obs.radius * 2);
      } else if (obs.type === 'tree') {
        shadowG.fillEllipse(obs.x, obs.y + 18, 50, 16);
        this.add.image(obs.x, obs.y, 'tree-trunk').setDisplaySize(30, 30);
        sprite = this.add.image(obs.x, obs.y - 10, 'tree-canopy').setDisplaySize(70, 70);
      } else if (obs.type === 'bush') {
        shadowG.fillEllipse(obs.x, obs.y + obs.radius * 0.5, obs.radius * 1.6, obs.radius * 0.6);
        sprite = this.add.image(obs.x, obs.y, 'bush').setDisplaySize(obs.radius * 2, obs.radius * 2).setAlpha(0.7);
      }
      if (sprite) this.obstacleSprites.push(sprite);
    }

    // Cages
    this.cageSprites = [];
    for (var ci = 0; ci < this.gameData.cages.length; ci++) {
      var cage = this.gameData.cages[ci];
      shadowG.fillEllipse(cage.x, cage.y + 75, 140, 35);
      var cageSprite = this.add.image(cage.x, cage.y, 'cage').setDisplaySize(160, 160);
      this.cageSprites.push({ sprite: cageSprite, index: ci });
    }

    // Player sprites
    this.playerSprites = {};
    for (var id in this.gameData.players) {
      this.createPlayerSprite(id, this.gameData.players[id]);
    }

    // ── HUD ─────────────────────────────────────────────────────
    // With a zoomed camera, setScrollFactor(0) positions are in screen space
    // but get scaled by zoom. Compensate: world_pos = screen_pos / zoom,
    // then setScale(1/zoom) so text appears at normal readable size.
    var invZ = 1 / zoom;

    this.timerText = this.add.text(10 * invZ, 10 * invZ, '', {
      fontFamily: font, fontSize: '20px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setScale(invZ).setDepth(1000);

    this.spectatorBadge = this.add.text((w / 2) * invZ, 10 * invZ, '👁  SEYİRCİ', {
      fontFamily: font, fontSize: '16px', color: '#ffdd88', fontStyle: 'bold',
      backgroundColor: '#00000088', padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setScale(invZ).setDepth(1000);

    this.playerCountText = this.add.text((w - 10) * invZ, 10 * invZ, '', {
      fontFamily: font, fontSize: '13px', color: '#ffffff',
      backgroundColor: '#00000088', padding: { x: 8, y: 4 },
      align: 'right',
    }).setOrigin(1, 0).setScrollFactor(0).setScale(invZ).setDepth(1000);

    // ── Events ──────────────────────────────────────────────────
    this.latestState = null;

    window.network.on('game:state', function(state) {
      this.latestState = state;
    }.bind(this));

    window.network.on('game:end', function() {
      this.scene.start('Lobby');
    }.bind(this));
  }

  update() {
    if (!this.latestState) return;
    var state = this.latestState;

    // Timer
    var min = Math.floor(state.timer / 60);
    var sec = state.timer % 60;
    this.timerText.setText('T ' + min + ':' + (sec < 10 ? '0' : '') + sec);

    // Player counts
    var players = state.players;
    var hunters = 0, runners = 0, caged = 0;
    for (var id in players) {
      if (players[id].team === 'hunter') hunters++;
      else { runners++; if (players[id].state === 'caged') caged++; }
    }
    this.playerCountText.setText('🔴 ' + hunters + '  🟡 ' + (runners - caged) + '/' + runners);

    // Update player sprites
    for (var pid in players) {
      var p = players[pid];
      var spr = this.playerSprites[pid];
      if (!spr) spr = this.createPlayerSprite(pid, p);

      spr.container.x += (p.x - spr.container.x) * 0.2;
      spr.container.y += (p.y - spr.container.y) * 0.2;

      if (p.moving && p.state === 'free') {
        spr.sprite.setFlipX(Math.cos(p.angle) < 0);
        if (spr.hasSheet) {
          var walkKey = spr.team === 'hunter' ? 'hunter-walk-' + spr.skin : 'runner-walk-' + spr.skin;
          if (!spr.sprite.anims.isPlaying || spr.sprite.anims.currentAnim?.key !== walkKey) spr.sprite.play(walkKey);
        }
      } else if (spr.hasSheet) {
        var idleKey = spr.team === 'hunter' ? 'hunter-idle-' + spr.skin : 'runner-idle-' + spr.skin;
        if (!spr.sprite.anims.isPlaying || spr.sprite.anims.currentAnim?.key !== idleKey) spr.sprite.play(idleKey);
      }

      // Spectators see everyone — only dim caged players
      spr.container.setAlpha(p.state === 'caged' ? 0.5 : 1);
      spr.nameLabel.setText(p.name);
    }

    // Remove disconnected
    for (var dpid in this.playerSprites) {
      if (!players[dpid]) {
        this.playerSprites[dpid].container.destroy();
        delete this.playerSprites[dpid];
      }
    }

    // Cages
    for (var cs of this.cageSprites) {
      var cageData = state.cages[cs.index];
      cs.sprite.setTexture(cageData.prisoners.length > 0 ? 'cage-active' : 'cage').setDisplaySize(160, 160);
    }
  }

  createPlayerSprite(id, data) {
    var sheetKey = null;
    var skin = data.skin !== undefined ? data.skin : -1;
    if (data.team === 'hunter' && skin >= 0 && this.textures.exists('hunter-skin-' + skin)) {
      sheetKey = 'hunter-skin-' + skin;
    } else if (data.team === 'runner' && skin >= 0 && this.textures.exists('runner-skin-' + skin)) {
      sheetKey = 'runner-skin-' + skin;
    }
    var hasSheet = !!sheetKey;
    var fallbackKey = data.team === 'hunter' ? 'duck-hunter' : 'duck-runner';

    var container = this.add.container(data.x, data.y).setDepth(100);
    var playerShadow = this.add.graphics();
    playerShadow.fillStyle(0x000000, 0.25);
    playerShadow.fillEllipse(0, 20, 36, 12);
    var sprite = hasSheet
      ? this.add.sprite(0, 0, sheetKey, 0).setDisplaySize(48, 48)
      : this.add.image(0, 0, fallbackKey).setDisplaySize(48, 38);
    var nameLabel = this.add.text(0, -28, data.name || '', {
      fontSize: '11px', color: '#ffffff', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    container.add([playerShadow, sprite, nameLabel]);

    this.playerSprites[id] = { container, sprite, nameLabel, hasSheet, team: data.team, skin };
    return this.playerSprites[id];
  }

  drawMap() {
    var outer = this.add.graphics().setDepth(-3);
    outer.fillStyle(0x111111, 1);
    outer.fillRect(-CONSTANTS.MAP_RADIUS - 200, -CONSTANTS.MAP_RADIUS - 200, CONSTANTS.WORLD_SIZE + 400, CONSTANTS.WORLD_SIZE + 400);

    var mapSize = CONSTANTS.MAP_RADIUS * 2;
    if (this.textures.exists('map-bg')) {
      this.add.image(0, 0, 'map-bg').setDisplaySize(mapSize, mapSize).setDepth(-2);
    } else {
      var g = this.add.graphics().setDepth(-2);
      g.fillStyle(0x4a8a2a, 1);
      g.fillCircle(0, 0, CONSTANTS.MAP_RADIUS);
    }

    var border = this.add.graphics().setDepth(50);
    border.lineStyle(6, 0xff4444, 0.8);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS);
    border.lineStyle(2, 0xffffff, 0.3);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS + 4);
  }
}
