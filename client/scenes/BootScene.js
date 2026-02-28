class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload() {
    var w = this.cameras.main.width;
    var h = this.cameras.main.height;
    this.loadingText = this.add.text(w / 2, h / 2, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Asset definitions — supports png and svg, tries png first
    this.assetDefs = [
      { key: 'duck-hunter', svgW: 96, svgH: 76 },
      { key: 'duck-runner', svgW: 96, svgH: 76 },
      { key: 'rock', svgW: 80, svgH: 80 },
      { key: 'tree-trunk', svgW: 30, svgH: 30 },
      { key: 'tree-canopy', svgW: 70, svgH: 70 },
      { key: 'bush', svgW: 90, svgH: 90 },
      { key: 'cage', svgW: 160, svgH: 160 },
      { key: 'cage-active', svgW: 160, svgH: 160 },
    ];

    // Map background
    this.load.image('map-bg', 'assets/map.png');

    // Fight effect spritesheet (3 cols x 2 rows, 200x200 per frame)
    this.load.spritesheet('fight-effect', 'assets/fight_effect.png', { frameWidth: 200, frameHeight: 200 });

    // Audio
    this.load.audio('sfx-menu', 'assets/menu-music.mp3');
    this.load.audio('sfx-game-start', 'assets/game-start.mp3');
    this.load.audio('sfx-capture', 'assets/capture.mp3');
    this.load.audio('sfx-cage-rescue', 'assets/cage-rescue.mp3');
    this.load.audio('sfx-struggle-free', 'assets/struggle-free.mp3');
    this.load.audio('sfx-game-win', 'assets/game-win.mp3');
    this.load.audio('sfx-game-lose', 'assets/game-lose.mp3');
    this.load.audio('sfx-caged', 'assets/jail-door.mp3');

    // Try loading PNG first, SVG as second option
    this.loadedAssets = {};
    for (var i = 0; i < this.assetDefs.length; i++) {
      var a = this.assetDefs[i];
      this.load.image(a.key, 'assets/' + a.key + '.png');
    }

    this.load.on('loaderror', function(file) {
      this.loadedAssets[file.key] = false;
    }, this);

    this.load.on('filecomplete', function(key) {
      this.loadedAssets[key] = true;
    }, this);
  }

  create() {
    // Fetch skin lists from server, then continue loading
    var self = this;
    fetch('/api/skins').then(function(r) { return r.json(); }).then(function(data) {
      window.runnerSkins = data.runners || [];
      window.hunterSkins = data.hunters || [];
      self.loadAllSkins();
    }).catch(function() {
      window.runnerSkins = [];
      window.hunterSkins = [];
      self.loadAllSkins();
    });
  }

  loadAllSkins() {
    var rSkins = window.runnerSkins;
    var hSkins = window.hunterSkins;
    var needsLoad = false;

    for (var i = 0; i < rSkins.length; i++) {
      this.load.spritesheet('runner-skin-' + i, 'assets/runners/' + rSkins[i], { frameWidth: 256, frameHeight: 256 });
      needsLoad = true;
    }
    for (var j = 0; j < hSkins.length; j++) {
      this.load.spritesheet('hunter-skin-' + j, 'assets/hunters/' + hSkins[j], { frameWidth: 256, frameHeight: 256 });
      needsLoad = true;
    }

    if (needsLoad) {
      this.load.once('complete', function() {
        this.afterSkinsLoaded();
      }, this);
      this.load.start();
    } else {
      this.afterSkinsLoaded();
    }
  }

  afterSkinsLoaded() {
    // For assets that failed PNG load, try SVG before fallback
    var needsSvg = [];
    for (var i = 0; i < this.assetDefs.length; i++) {
      var a = this.assetDefs[i];
      if (!this.loadedAssets[a.key]) {
        needsSvg.push(a);
      }
    }

    if (needsSvg.length > 0) {
      for (var j = 0; j < needsSvg.length; j++) {
        var s = needsSvg[j];
        this.load.svg(s.key, 'assets/' + s.key + '.svg', { width: s.svgW, height: s.svgH });
      }
      this.load.once('complete', function() {
        this.applyFallbacks();
        this.startGame();
      }, this);
      this.load.start();
    } else {
      this.applyFallbacks();
      this.startGame();
    }
  }

  applyFallbacks() {
    var fallbacks = {
      'duck-hunter': function(scene) { scene.generateDuckTexture('duck-hunter', 0xcc3333); },
      'duck-runner': function(scene) { scene.generateDuckTexture('duck-runner', 0xf0c020); },
      'rock': function(scene) { scene.generateCircleTexture('rock', 0x888888, 40); },
      'tree-trunk': function(scene) { scene.generateCircleTexture('tree-trunk', 0x6b4226, 15); },
      'tree-canopy': function(scene) { scene.generateCircleTexture('tree-canopy', 0x2d7a2d, 35); },
      'bush': function(scene) { scene.generateCircleTexture('bush', 0x3a8a3a, 45); },
      'cage': function(scene) { scene.generateCircleTexture('cage', 0xaaaa, 80); },
      'cage-active': function(scene) { scene.generateCircleTexture('cage-active', 0xff66, 80); },
    };

    for (var key in fallbacks) {
      if (!this.loadedAssets[key]) {
        fallbacks[key](this);
      }
    }
  }

  startGame() {
    this.generateCircleTexture('ground', 0x4a8a2a, 16);

    // Hunter skin animations
    var hSkins = window.hunterSkins;
    for (var i = 0; i < hSkins.length; i++) {
      var hKey = 'hunter-skin-' + i;
      if (this.textures.exists(hKey)) {
        this.anims.create({ key: 'hunter-walk-' + i, frames: this.anims.generateFrameNumbers(hKey, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'hunter-idle-' + i, frames: [{ key: hKey, frame: 0 }], frameRate: 1 });
      }
    }

    // Runner skin animations
    var rSkins = window.runnerSkins;
    for (var j = 0; j < rSkins.length; j++) {
      var rKey = 'runner-skin-' + j;
      if (this.textures.exists(rKey)) {
        this.anims.create({ key: 'runner-walk-' + j, frames: this.anims.generateFrameNumbers(rKey, { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'runner-idle-' + j, frames: [{ key: rKey, frame: 0 }], frameRate: 1 });
      }
    }

    // Fight effect animation (6 frames: 3x2 grid)
    if (this.textures.exists('fight-effect')) {
      this.anims.create({ key: 'fight-effect', frames: this.anims.generateFrameNumbers('fight-effect', { start: 0, end: 5 }), frameRate: 12, repeat: 0 });
    }

    window.network.connect().then(function() {
      this.scene.start('Lobby');
    }.bind(this));
  }

  generateDuckTexture(key, color) {
    var g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillEllipse(16, 18, 28, 22);
    g.fillCircle(28, 12, 8);
    g.fillStyle(0xff8800, 1);
    g.fillTriangle(36, 12, 30, 8, 30, 16);
    g.fillStyle(0x000000, 1);
    g.fillCircle(30, 10, 2);
    g.generateTexture(key, 40, 32);
    g.destroy();
  }

  generateCircleTexture(key, color, radius) {
    var g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }
}
