const C = require('../shared/constants');

function generateObstacles() {
  const obstacles = [];
  const rng = (min, max) => min + Math.random() * (max - min);

  // Rocks: 18 total, varied sizes, solid collision
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(200, C.MAP_RADIUS - 200);
    obstacles.push({
      type: 'rock',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: rng(20, 40),
    });
  }

  // Trees: 22 total, solid collision
  for (let i = 0; i < 22; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(200, C.MAP_RADIUS - 200);
    obstacles.push({
      type: 'tree',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: 30,
    });
  }

  // Bushes: 12 total, hide mechanic (no solid collision)
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = rng(300, C.MAP_RADIUS - 300);
    obstacles.push({
      type: 'bush',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      radius: 45,
    });
  }

  return obstacles;
}

function generateSpawnPoints(hunters, runners) {
  const spawns = {};

  hunters.forEach((id, i) => {
    const angle = (i / hunters.length) * Math.PI * 2;
    spawns[id] = {
      x: Math.cos(angle) * C.HUNTER_SPAWN_DISTANCE,
      y: Math.sin(angle) * C.HUNTER_SPAWN_DISTANCE,
    };
  });

  runners.forEach((id) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * C.RUNNER_SPAWN_RADIUS;
    spawns[id] = {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    };
  });

  return spawns;
}

module.exports = { generateObstacles, generateSpawnPoints };
