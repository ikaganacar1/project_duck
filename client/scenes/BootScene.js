class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    this.loadingText = this.add.text(w / 2, h / 2, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  create() {
    this.generateDuckTexture('duck-hunter', 0xcc3333);
    this.generateDuckTexture('duck-runner', 0xf0c020);

    this.generateCircleTexture('rock', 0x888888, 40);
    this.generateCircleTexture('tree-trunk', 0x6b4226, 15);
    this.generateCircleTexture('tree-canopy', 0x2d7a2d, 35);
    this.generateCircleTexture('bush', 0x3a8a3a, 45);
    this.generateCircleTexture('cage', 0xaaaaaa, 80);
    this.generateCircleTexture('cage-active', 0xff6666, 80);
    this.generateCircleTexture('ground', 0x4a8a2a, 16);

    window.network.connect().then(() => {
      this.scene.start('Lobby');
    });
  }

  generateDuckTexture(key, color) {
    const g = this.add.graphics();
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
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }
}
