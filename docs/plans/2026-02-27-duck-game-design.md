# Duck Hunt Multiplayer Game - Design Document

## Overview

A real-time multiplayer duck-themed tag game where Hunters chase Runners on a circular forest map. Built with Phaser.js (client) and Node.js + Socket.io (server), deployed via Docker. Mobile-first with virtual joystick.

## Core Parameters

| Parameter | Value |
|-----------|-------|
| Players | 4-8 |
| Game Duration | 180 seconds (3 min) |
| Map Radius | 2000px |
| Tick Rate | 20/s (50ms interval) |
| Player Speed | 200px/s |
| Carry Speed Multiplier | 0.6 |
| Capture Distance | 50px |
| Struggle Threshold | 10 taps |
| Cage Rescue Threshold | 15 taps |
| Bush Visibility Distance | 150px |
| Reconnect Window | 10 seconds |

## Architecture

Monorepo, single Express server serves both Socket.io and static client files.

```
jam/
├── server/
│   ├── index.js          # Express + Socket.io startup
│   ├── lobby.js          # Lobby management, ready system
│   ├── game.js           # Game loop, tick broadcast
│   ├── teams.js          # Team assignment (H = R - 1)
│   ├── capture.js        # Capture, carry, cage logic
│   ├── struggle.js       # Struggle/rescue mechanics
│   ├── collision.js      # Server-side collision validation
│   └── map.js            # Map data (obstacles, cage positions)
├── client/
│   ├── index.html        # Main HTML with viewport meta
│   ├── scenes/
│   │   ├── BootScene.js  # Asset loading
│   │   ├── LobbyScene.js # Lobby UI, ready button
│   │   ├── GameScene.js  # Main game scene
│   │   └── ResultScene.js# Result screen
│   ├── input/
│   │   └── joystick.js   # Virtual joystick
│   ├── network/
│   │   └── socket.js     # Socket.io client wrapper
│   └── assets/           # Sprites, sounds
├── shared/
│   └── constants.js      # Shared constants
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Technologies

- **Runtime:** Node.js 20+
- **Server:** Express 4 + Socket.io 4
- **Game engine:** Phaser 3 (Arcade Physics)
- **Joystick:** phaser3-rex-plugins
- **Container:** Docker + docker-compose

## Game Flow

### Lobby

1. Player connects → joins lobby
2. Player sees connected player list with ready status
3. Player toggles "Ready" button
4. When all players ready AND player count >= 4 → 3 second countdown → game starts
5. If a player disconnects during lobby, they are removed immediately

### Team Assignment

Formula: `H = R - 1` (Hunters = Runners - 1)

| Total | Hunters | Runners |
|-------|---------|---------|
| 4 | 1 | 3 |
| 5 | 2 | 3 |
| 6 | 2 | 4 |
| 7 | 3 | 4 |
| 8 | 3 | 5 |

Random assignment at game start.

### Game Loop (server, 20 ticks/s)

1. Apply each player's input (joystick direction + speed)
2. Boundary check (circular map, push back if outside)
3. Obstacle collision (rocks, trees - static bodies)
4. Capture check (Hunter-Runner distance < 50px)
5. Cage zone check (Hunter carrying Runner near cage)
6. Broadcast state to all players

### Capture System

1. Hunter approaches Runner within 50px → server confirms capture
2. Runner state becomes `"carried"`, `carriedBy: hunterId`
3. Runner follows behind Hunter with offset
4. Hunter speed reduced to 60%
5. Hunter enters cage zone → Runner deposited in cage, state `"caged"`

### Struggle Mechanic

- Captured Runner taps screen → sends `"struggle"` event
- Server maintains `struggleCount` per captured runner
- Counter decreases by 1 per second (must keep tapping)
- `struggleCount >= 10` → Runner freed, state back to `"free"`

### Cage Rescue

- Same-team Runner approaches cage and taps → `"rescue"` event
- Cage `rescueProgress` increments (shared across all rescuing players)
- `rescueProgress >= 15` → ALL prisoners in that cage freed
- Caged players cannot free themselves

### Win Condition

- Timer reaches 0:
  - Caged Runners > Free Runners → **Hunters win**
  - Otherwise → **Runners win**
- All Runners caged before timer → **Hunters win instantly**

## Map Design

### Circular Map
- Center: `(0, 0)`, Radius: `2000px`
- Phaser world size: 4000x4000
- Boundary: if `sqrt(x² + y²) > MAP_RADIUS` → push player back

### Obstacles
- **Rocks:** 15-20, varied sizes (40-80px), solid collision
- **Trees:** 20-25, shadow/leaf sprites, solid collision
- **Bushes:** 10-15, enter to become semi-invisible
  - Enemy within 150px: alpha linearly increases (0 → 1)
  - Teammates always see bush-hidden players

### Cage Positions (4 cages)
- North: `(0, -1500)`
- South: `(0, 1500)`
- East: `(1500, 0)`
- West: `(-1500, 0)`

### Spawn Points
- Runners: random spread near center
- Hunters: spread along map edge (1500px from center)

## Network Protocol

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join` | `{ name }` | Join lobby |
| `ready` | `{ ready: bool }` | Ready toggle |
| `input` | `{ angle, moving }` | Joystick direction |
| `struggle` | `{}` | Struggle tap |
| `rescue` | `{ cageIndex }` | Cage rescue tap |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `lobby:update` | `{ players }` | Lobby state |
| `lobby:countdown` | `{ seconds }` | Countdown |
| `game:start` | `{ players, cages, mapData }` | Game begins |
| `game:state` | `{ players, cages, timer }` | Tick update |
| `game:capture` | `{ hunterId, runnerId }` | Capture event |
| `game:freed` | `{ playerId }` | Struggle success |
| `game:caged` | `{ playerId, cageIndex }` | Caged event |
| `game:rescued` | `{ cageIndex }` | Cage rescued |
| `game:end` | `{ winner, stats }` | Game over |

## Broadcast State Shape

```js
{
  players: {
    [id]: { x, y, angle, team, state, carriedBy, inBush }
  },
  cages: [
    { x, y, prisoners: [id], rescueProgress: 0 }
  ],
  timer: secondsRemaining
}
```

## Visual Design

- **Hunters:** Red ducks
- **Runners:** Yellow ducks
- Camera follows player, map larger than viewport (no full map view)
- Interpolation (lerp) between server ticks for smooth movement

## Mobile Optimization

- Viewport meta: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`
- Phaser Scale Manager: `Phaser.Scale.RESIZE`
- Virtual joystick scaled to screen size
- Tap events for struggle/rescue

## Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

```yaml
services:
  game:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
```

## Disconnection Handling

- In-game: 10 second reconnect window, same player on reconnect
- If Hunter disconnects while carrying → Runner freed
- Lobby: immediate removal
- No reconnect after timeout → removed from game
