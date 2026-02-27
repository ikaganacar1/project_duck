const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#1a3a0a',
  scene: [BootScene, LobbyScene, GameScene, ResultScene],
};

const game = new Phaser.Game(config);
