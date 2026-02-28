class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Result' });
  }

  init(data) {
    this.resultData = data;
  }

  preload() {
    if (!this.cache.audio.exists('sfx-game-win')) {
      this.load.audio('sfx-game-win', 'assets/game-win.mp3');
    }
    if (!this.cache.audio.exists('sfx-game-lose')) {
      this.load.audio('sfx-game-lose', 'assets/game-lose.mp3');
    }
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const { winner, stats } = this.resultData;

    // Win/lose sound based on my team
    const myTeam = this.resultData.myTeam || null;
    const iWon = myTeam === winner;
    if (myTeam) {
      this.sound.play(iWon ? 'sfx-game-win' : 'sfx-game-lose', { volume: 0.5 });
    } else {
      this.sound.play('sfx-game-win', { volume: 0.5 });
    }

    const isHunterWin = winner === 'hunter';
    const winColor = isHunterWin ? '#ff4444' : '#f0c020';
    const winText = isHunterWin ? 'KOVALAYANLAR KAZANDI!' : 'KAÇANLAR KAZANDI!';

    this.add.text(w / 2, h / 2 - 80, winText, {
      fontSize: '36px',
      color: winColor,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const statsText = [
      'Toplam Kaçan: ' + stats.totalRunners,
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
