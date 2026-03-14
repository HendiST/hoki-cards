# Hoki Cards

A real-time multiplayer card game (Capsa/Big Two variant) built with Node.js and Socket.io. Players connect over a local hotspot to play against each other.

## Architecture

- **Backend**: `server.js` — Pure Node.js HTTP server + Socket.io for real-time multiplayer
- **Frontend**: `www/index.html` — Single-page HTML/CSS/JS game UI (served as static file)
- **Mobile**: Android app via Capacitor (`android/` directory)
- **Port**: 5000 (Replit webview)

## Running

The app runs with `node server.js`. No build step required.

## Game Rules

- Capsa / Big Two variant called "Hoki Cards"
- 2–4 players
- Cards ranked 3–2 (3 lowest, 2 highest), suits S > H > D > C
- Special cards: 3s are decoys, 2s are dangerous (lose if left with them)
- Play types: single, double, triple, straight (3–5+ same-suit consecutive), bomb (4-of-a-kind, JQKA flush, 5+ flush)

## Deployment

Configured as `vm` deployment (always-running) since it uses in-memory game state via WebSockets.
