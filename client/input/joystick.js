class VirtualJoystick {
  constructor(scene) {
    this.scene = scene;
    this.angle = 0;
    this.moving = false;
    this.pointer = null;
    this.baseX = 0;
    this.baseY = 0;
    this.stickX = 0;
    this.stickY = 0;
    this.maxDistance = 50;
    this.deadZone = 10;

    this.base = scene.add.circle(0, 0, 60, 0x000000, 0.3)
      .setScrollFactor(0).setDepth(1000).setVisible(false);
    this.stick = scene.add.circle(0, 0, 25, 0xffffff, 0.5)
      .setScrollFactor(0).setDepth(1001).setVisible(false);

    scene.input.on('pointerdown', (ptr) => this.onDown(ptr));
    scene.input.on('pointermove', (ptr) => this.onMove(ptr));
    scene.input.on('pointerup', (ptr) => this.onUp(ptr));
  }

  onDown(ptr) {
    if (ptr.x > this.scene.cameras.main.width * 0.5) return;
    this.pointer = ptr;
    this.baseX = ptr.x;
    this.baseY = ptr.y;
    this.base.setPosition(ptr.x, ptr.y).setVisible(true);
    this.stick.setPosition(ptr.x, ptr.y).setVisible(true);
  }

  onMove(ptr) {
    if (!this.pointer || ptr.id !== this.pointer.id) return;
    const dx = ptr.x - this.baseX;
    const dy = ptr.y - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > this.deadZone) {
      this.moving = true;
      this.angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, this.maxDistance);
      this.stickX = this.baseX + Math.cos(this.angle) * clampedDist;
      this.stickY = this.baseY + Math.sin(this.angle) * clampedDist;
    } else {
      this.moving = false;
      this.stickX = this.baseX;
      this.stickY = this.baseY;
    }
    this.stick.setPosition(this.stickX, this.stickY);
  }

  onUp(ptr) {
    if (!this.pointer || ptr.id !== this.pointer.id) return;
    this.pointer = null;
    this.moving = false;
    this.base.setVisible(false);
    this.stick.setVisible(false);
  }

  destroy() {
    this.base.destroy();
    this.stick.destroy();
  }
}
