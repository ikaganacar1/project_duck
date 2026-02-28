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

    // Spritesheets — 2x2 grid, 1024x1024 per frame
    this.load.spritesheet('hunter-sheet', 'assets/hunter-animation.png', { frameWidth: 1024, frameHeight: 1024 });
    this.load.spritesheet('runner-sheet', 'assets/runner-animation.png', { frameWidth: 1024, frameHeight: 1024 });

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

    // Create walk animations from spritesheets if loaded
    if (this.textures.exists('hunter-sheet')) {
      this.anims.create({ key: 'hunter-walk', frames: this.anims.generateFrameNumbers('hunter-sheet', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: 'hunter-idle', frames: [{ key: 'hunter-sheet', frame: 0 }], frameRate: 1 });
    }
    if (this.textures.exists('runner-sheet')) {
      this.anims.create({ key: 'runner-walk', frames: this.anims.generateFrameNumbers('runner-sheet', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
      this.anims.create({ key: 'runner-idle', frames: [{ key: 'runner-sheet', frame: 0 }], frameRate: 1 });
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
