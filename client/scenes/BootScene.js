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

    // Try loading custom assets — missing files are handled gracefully
    this.assetList = [
      { key: 'duck-hunter', path: 'assets/duck-hunter.svg', type: 'svg', w: 40, h: 32 },
      { key: 'duck-runner', path: 'assets/duck-runner.svg', type: 'svg', w: 40, h: 32 },
      { key: 'rock', path: 'assets/rock.svg', type: 'svg', w: 80, h: 80 },
      { key: 'tree-trunk', path: 'assets/tree-trunk.svg', type: 'svg', w: 30, h: 30 },
      { key: 'tree-canopy', path: 'assets/tree-canopy.svg', type: 'svg', w: 70, h: 70 },
      { key: 'bush', path: 'assets/bush.svg', type: 'svg', w: 90, h: 90 },
      { key: 'cage', path: 'assets/cage.svg', type: 'svg', w: 160, h: 160 },
      { key: 'cage-active', path: 'assets/cage-active.svg', type: 'svg', w: 160, h: 160 },
    ];

    this.loadedAssets = {};
    for (var i = 0; i < this.assetList.length; i++) {
      var a = this.assetList[i];
      if (a.type === 'svg') {
        this.load.svg(a.key, a.path, { width: a.w, height: a.h });
      } else {
        this.load.image(a.key, a.path);
      }
    }

    // Don't fail on missing files
    this.load.on('loaderror', function(file) {
      this.loadedAssets[file.key] = false;
    }, this);

    this.load.on('filecomplete', function(key) {
      this.loadedAssets[key] = true;
    }, this);
  }

  create() {
    // Generate fallback textures for any asset that failed to load
    var fallbacks = {
      'duck-hunter': function(scene) { scene.generateDuckTexture('duck-hunter', 0xcc3333); },
      'duck-runner': function(scene) { scene.generateDuckTexture('duck-runner', 0xf0c020); },
      'rock': function(scene) { scene.generateCircleTexture('rock', 0x888888, 40); },
      'tree-trunk': function(scene) { scene.generateCircleTexture('tree-trunk', 0x6b4226, 15); },
      'tree-canopy': function(scene) { scene.generateCircleTexture('tree-canopy', 0x2d7a2d, 35); },
      'bush': function(scene) { scene.generateCircleTexture('bush', 0x3a8a3a, 45); },
      'cage': function(scene) { scene.generateCircleTexture('cage', 0xaaaaaa, 80); },
      'cage-active': function(scene) { scene.generateCircleTexture('cage-active', 0xff6666, 80); },
    };

    for (var key in fallbacks) {
      if (!this.loadedAssets[key]) {
        fallbacks[key](this);
      }
    }

    // Ground is always generated (no asset needed)
    this.generateCircleTexture('ground', 0x4a8a2a, 16);

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
