// Try to lock orientation to landscape
try {
  screen.orientation.lock('landscape').catch(function() {});
} catch (e) {}

var config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 812,
    height: 375,
  },
  backgroundColor: '#1a3a0a',
  scene: [BootScene, LobbyScene, CountdownScene, GameScene, ResultScene],
};

var game = new Phaser.Game(config);
