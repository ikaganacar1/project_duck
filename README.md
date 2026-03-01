# Prison Quack 🦆

> **"Sakın Yakalanma!"** — Don't Get Caught!

A real-time multiplayer browser game built at **Ostim Tech Jam 2026** by **İsmail Kağan Acar** and **Özge Koç**.

Vibe coded with **Claude** (Anthropic). Game art generated with **Gemini** via Nano Banana, featuring the iconic duck from **[Kurzgesagt](https://kurzgesagt.org)**.

---

## What Is It?

Prison Quack is an asymmetric multiplayer tag game for 3–15 players. Two teams face off on a circular arena:

- **Hunters (Kovalayanlar 🔴)** — chase down runners, carry them to cages, and lock them up
- **Runners (Kaçanlar 🟡)** — dodge hunters, hide in bushes, and rescue caged teammates

No download required. Open a browser, join the lobby, pick your team, and play.

---

## How to Play

### Hunters win if they cage every runner before time runs out.
### Runners win if at least one runner stays free for the full 3 minutes.

### Controls
- **Move** — virtual joystick (drag anywhere on screen)
- **Struggle** — tap the screen rapidly when a hunter is carrying you (30 taps = escape)
- **Rescue** — tap the screen when standing next to a cage with prisoners (10 taps = free everyone)

### Hunter Mechanics
- Get close to a free runner to automatically grab them
- Carrying a runner slows you down (40% speed penalty)
- Walk into a cage zone to deposit your prisoner
- There are 4 cages — North, South, East, West

### Runner Mechanics
- Hide inside **bushes** — hunters can't see you unless they're very close
- **Struggle** when carried to break free (earn 3 seconds of immunity after escaping)
- **Rescue** captured teammates from cages by standing next to one and tapping
- Runners spawn near the center; hunters start at the outer ring

### Map
Every game generates a fresh circular arena with:
- **10 rocks** — solid obstacles, block movement
- **12 trees** — solid obstacles, block movement
- **8 bushes** — passthrough, runners can hide inside them

---

## Lobby & Setup

1. Open the game in a browser — you get a random Turkish animal name
2. Tap your name to cycle to a different one
3. Pick **Hunter** or **Runner** (hunter slots are capped to keep teams balanced)
4. Choose a skin for your duck character
5. Hit **HAZIR** (Ready) when you're set
6. Once everyone is ready, a 3-second countdown starts and the game begins

You can also join as a **Spectator** — watch the full map with drag-to-pan, no team needed.

---

## Game Flow

```
Boot → Lobby → Countdown (3-2-1-BAŞLA!) → Game (3 min) → Result → Lobby
```

- The result screen shows who won and how many runners were caged vs. free
- After 5 seconds it returns to the lobby automatically for a rematch

---

## Running Locally

**With Docker (recommended):**
```bash
docker compose up -d
```
Game is available at `http://localhost:25565`

**Without Docker:**
```bash
npm install
node server/index.js
```
Game is available at `http://localhost:3000`

**With a custom base path (subdirectory deployment):**
```bash
APP_BASE_PATH=/duck node server/index.js
# Game available at http://your-host/duck
```

---

## Technical Stack

| Layer | Technology |
|---|---|
| Game engine | Phaser 3 |
| Backend | Node.js + Express 5 |
| Real-time | Socket.IO 4 over WebSocket |
| Container | Docker (Node 20 Alpine) |
| Assets | PNG spritesheets, MP3 audio |

### Architecture
- **Server tick rate**: 20 Hz (50ms) — movement, collision, captures all resolved server-side
- **Client prediction**: local player movement runs client-side and reconciles with server state
- **Interpolation**: remote players are smoothly interpolated between server ticks
- **Transport**: WebSocket-first with polling fallback
- **Asset loading**: lazy — skins load on team selection, audio loads per scene; initial load is ~3 MB

### Project Structure
```
project_duck/
├── server/
│   ├── index.js       # Express + Socket.IO server
│   ├── game.js        # Game loop, physics, capture logic
│   ├── lobby.js       # Lobby state, team balancing, ready system
│   └── map.js         # Procedural obstacle + spawn generation
├── client/
│   ├── scenes/
│   │   ├── BootScene.js       # Asset loading, connection setup
│   │   ├── LobbyScene.js      # Team/skin selection UI
│   │   ├── CountdownScene.js  # 3-2-1 transition screen
│   │   ├── GameScene.js       # Main gameplay
│   │   ├── SpectatorScene.js  # Spectator view (drag-to-pan)
│   │   └── ResultScene.js     # Win/lose screen
│   ├── network/
│   │   └── socket.js          # Socket.IO client wrapper
│   └── input/
│       └── joystick.js        # Virtual joystick
└── shared/
    └── constants.js           # Shared game constants (speeds, distances, limits)
```

---

## Credits

Made at **Ostim Tech Jam 2026** by:

- **İsmail Kağan Acar**
- **Özge Koç**

Vibe coded with **Claude** (Anthropic) — code, logic, and architecture.
Game art generated with **Gemini** via **Nano Banana**.
Duck character based on the iconic duck from **[Kurzgesagt – In a Nutshell](https://kurzgesagt.org)**.
