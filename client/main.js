// Try to lock orientation to landscape
try {
  screen.orientation.lock('landscape').catch(function() {});
} catch (e) {}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  backgroundColor: '#1a3a0a',
  scene: [BootScene, LobbyScene, GameScene, ResultScene],
};

const game = new Phaser.Game(config);
