class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Result' });
  }

  init(data) {
    this.resultData = data;
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const { winner, stats } = this.resultData;

    const isHunterWin = winner === 'hunter';
    const winColor = isHunterWin ? '#ff4444' : '#f0c020';
    const winText = isHunterWin ? 'HUNTER KAZANDI!' : 'RUNNER KAZANDI!';

    this.add.text(w / 2, h / 2 - 80, winText, {
      fontSize: '36px',
      color: winColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const statsText = [
      'Toplam Runner: ' + stats.totalRunners,
      'Kafesteki: ' + stats.cagedRunners,
      'Serbest: ' + stats.freeRunners,
    ].join('\n');

    this.add.text(w / 2, h / 2 + 10, statsText, {
      fontSize: '20px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(w / 2, h / 2 + 100, 'Lobiye donuluyor...', {
      fontSize: '16px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.time.delayedCall(5000, () => {
      this.scene.start('Lobby');
    });
  }
}
