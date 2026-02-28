class SpectatorScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Spectator' });
  }

  init(data) {
    this.gameData = data;
  }

  preload() {
    // Ensure map is loaded (BootScene loads it but add as safety fallback)
    if (!this.textures.exists('map-bg')) {
      this.load.image('map-bg', 'assets/map.png');
    }
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
    var self = this;

    // Skin animations
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

    // Zoomed out main camera
    var zoom = Math.min(w, h) / (CONSTANTS.MAP_RADIUS * 2 + 160);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(0, 0);

    // Collect all world objects so uiCam can ignore them
    var worldObjs = [];
    function addW(obj) { worldObjs.push(obj); return obj; }

    // ── WORLD: Map ─────────────────────────────────────────────
    var outer = addW(this.add.graphics().setDepth(-3));
    outer.fillStyle(0x111111, 1);
    outer.fillRect(-CONSTANTS.MAP_RADIUS - 200, -CONSTANTS.MAP_RADIUS - 200, CONSTANTS.WORLD_SIZE + 400, CONSTANTS.WORLD_SIZE + 400);

    if (this.textures.exists('map-bg')) {
      addW(this.add.image(0, 0, 'map-bg').setDisplaySize(CONSTANTS.MAP_RADIUS * 2, CONSTANTS.MAP_RADIUS * 2).setDepth(-2));
    } else {
      var gfill = addW(this.add.graphics().setDepth(-2));
      gfill.fillStyle(0x4a8a2a, 1);
      gfill.fillCircle(0, 0, CONSTANTS.MAP_RADIUS);
    }

    var border = addW(this.add.graphics().setDepth(50));
    border.lineStyle(6, 0xff4444, 0.8);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS);
    border.lineStyle(2, 0xffffff, 0.3);
    border.strokeCircle(0, 0, CONSTANTS.MAP_RADIUS + 4);

    // ── WORLD: Shadows + Obstacles ─────────────────────────────
    var shadowG = addW(this.add.graphics().setDepth(0));
    shadowG.fillStyle(0x000000, 0.38);

    for (var obs of this.gameData.obstacles) {
      if (obs.type === 'rock') {
        shadowG.fillEllipse(obs.x, obs.y + obs.radius * 0.85, obs.radius * 2, obs.radius * 0.65);
        addW(this.add.image(obs.x, obs.y, 'rock').setDisplaySize(obs.radius * 2, obs.radius * 2));
      } else if (obs.type === 'tree') {
        shadowG.fillEllipse(obs.x, obs.y + 18, 50, 16);
        addW(this.add.image(obs.x, obs.y, 'tree-trunk').setDisplaySize(30, 30));
        addW(this.add.image(obs.x, obs.y - 10, 'tree-canopy').setDisplaySize(70, 70));
      } else if (obs.type === 'bush') {
        shadowG.fillEllipse(obs.x, obs.y + obs.radius * 0.5, obs.radius * 1.6, obs.radius * 0.6);
        addW(this.add.image(obs.x, obs.y, 'bush').setDisplaySize(obs.radius * 2, obs.radius * 2).setAlpha(0.7));
      }
    }

    // ── WORLD: Cages ───────────────────────────────────────────
    this.cageSprites = [];
    for (var ci = 0; ci < this.gameData.cages.length; ci++) {
      var cage = this.gameData.cages[ci];
      shadowG.fillEllipse(cage.x, cage.y + 75, 140, 35);
      var cageImg = addW(this.add.image(cage.x, cage.y, 'cage').setDisplaySize(160, 160));
      this.cageSprites.push({ sprite: cageImg, index: ci });
    }

    // ── WORLD: Players ─────────────────────────────────────────
    this.playerSprites = {};
    this.worldObjs = worldObjs; // store for dynamic player sprites
    for (var id in this.gameData.players) {
      this.createPlayerSprite(id, this.gameData.players[id]);
    }

    // ── UI CAMERA (created after all world objects) ────────────
    // uiCam renders at zoom=1, only sees HUD. Main cam sees only world.
    this.uiCam = this.cameras.add(0, 0, w, h).setName('ui');
    this.uiCam.ignore(this.worldObjs);

    // ── HUD (screen-space positions work correctly in uiCam) ───
    this.timerText = this.add.text(10, 10, '', {
      fontFamily: font, fontSize: '20px', color: '#ffffff',
      backgroundColor: '#00000099', padding: { x: 10, y: 5 }, fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(1000);

    this.spectatorBadge = this.add.text(w / 2, 10, '👁  SEYİRCİ', {
      fontFamily: font, fontSize: '16px', color: '#ffdd88', fontStyle: 'bold',
      backgroundColor: '#00000099', padding: { x: 10, y: 5 },
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(1000);

    this.playerCountText = this.add.text(w - 10, 10, '', {
      fontFamily: font, fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      backgroundColor: '#00000099', padding: { x: 10, y: 5 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(1000);

    // Main camera ignores all HUD objects
    this.cameras.main.ignore([this.timerText, this.spectatorBadge, this.playerCountText]);

    // ── Events ────────────────────────────────────────────────
    this.latestState = null;
    window.network.on('game:state', function(state) { this.latestState = state; }.bind(this));
    window.network.on('game:end', function() { this.scene.start('Lobby'); }.bind(this));
  }

  update() {
    if (!this.latestState) return;
    var state = this.latestState;

    var min = Math.floor(state.timer / 60);
    var sec = state.timer % 60;
    this.timerText.setText('T ' + min + ':' + (sec < 10 ? '0' : '') + sec);

    var players = state.players;
    var hunters = 0, runners = 0, caged = 0;
    for (var id in players) {
      if (players[id].team === 'hunter') hunters++;
      else { runners++; if (players[id].state === 'caged') caged++; }
    }
    this.playerCountText.setText('🔴 ' + hunters + '  🟡 ' + (runners - caged) + '/' + runners);

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

      spr.container.setAlpha(p.state === 'caged' ? 0.5 : 1);
      spr.nameLabel.setText(p.name);
    }

    for (var dpid in this.playerSprites) {
      if (!players[dpid]) {
        this.playerSprites[dpid].container.destroy();
        delete this.playerSprites[dpid];
      }
    }

    for (var cs of this.cageSprites) {
      cs.sprite.setTexture(state.cages[cs.index].prisoners.length > 0 ? 'cage-active' : 'cage').setDisplaySize(160, 160);
    }
  }

  createPlayerSprite(id, data) {
    var skin = data.skin !== undefined ? data.skin : -1;
    var sheetKey = null;
    if (data.team === 'hunter' && skin >= 0 && this.textures.exists('hunter-skin-' + skin)) sheetKey = 'hunter-skin-' + skin;
    else if (data.team === 'runner' && skin >= 0 && this.textures.exists('runner-skin-' + skin)) sheetKey = 'runner-skin-' + skin;

    var hasSheet = !!sheetKey;
    var container = this.add.container(data.x, data.y).setDepth(100);

    // World object — tell uiCam to ignore it
    if (this.uiCam) this.uiCam.ignore(container);
    if (this.worldObjs) this.worldObjs.push(container);

    var shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.25);
    shadow.fillEllipse(0, 20, 36, 12);
    var sprite = hasSheet
      ? this.add.sprite(0, 0, sheetKey, 0).setDisplaySize(48, 48)
      : this.add.image(0, 0, data.team === 'hunter' ? 'duck-hunter' : 'duck-runner').setDisplaySize(48, 38);
    var nameLabel = this.add.text(0, -28, data.name || '', {
      fontSize: '11px', color: '#ffffff', backgroundColor: '#00000088', padding: { x: 3, y: 1 },
    }).setOrigin(0.5);
    container.add([shadow, sprite, nameLabel]);

    this.playerSprites[id] = { container, sprite, nameLabel, hasSheet, team: data.team, skin };
    return this.playerSprites[id];
  }
}
