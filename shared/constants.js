const CONSTANTS = {
  MAP_RADIUS: 1000,
  WORLD_SIZE: 2000,
  TICK_RATE: 20,
  TICK_INTERVAL: 50,
  PLAYER_SPEED: 200,
  HUNTER_CARRY_SPEED_MULT: 0.6,
  CAPTURE_DISTANCE: 50,
  STRUGGLE_THRESHOLD: 30,
  IMMUNITY_DURATION: 3000,
  CAGE_RESCUE_THRESHOLD: 10,
  GAME_DURATION: 180,
  BUSH_VISIBILITY_DISTANCE: 150,
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 8,
  RECONNECT_WINDOW: 10000,
  CAGE_POSITIONS: [
    { x: 0, y: -750 },
    { x: 0, y: 750 },
    { x: 750, y: 0 },
    { x: -750, y: 0 },
  ],
  CAGE_ZONE_RADIUS: 80,
  HUNTER_SPAWN_DISTANCE: 850,
  RUNNER_SPAWN_RADIUS: 250,
  PLAYER_NAMES: [
    'ÇirkinÖrdek', 'KorkakTavuk', 'NinjaKaz', 'Gurba', 'PanikTavşan',
    'ÇirkinMalKöpek', 'KırmızıBoğa', 'LogitechFare', 'LinuxPenguen', 'YürüyenUçak',
    'ŞişkoAyıcık', 'ElmaKurdu', 'KayseriliPastırma', 'ÇubukTurşusu', 'AyvalıkTostu',
    'OstimBaykuşu', 'TatlıFokçuk', 'ZıpZıpMaymun', 'PremsesKedi', 'CiciKuş',
  ],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONSTANTS;
}
