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

## Online Features (Firebase)

- **Firebase Auth** — Login/register email & password
- **Firestore** — User data: nama, diamonds, owned skins/frames, ranked stats
- **Firebase RTDB** — Real-time multiplayer rooms, global chat, global message broadcast

## Economy System (Diamond & Shop)

- **Diamond** — Currency yang didapat dari menang, daily reward, dan reward dari Owner
- **Toko** — Beli skin kartu (Classic gratis, Dark Neon 💎100, Gold Luxury 💎300) dan avatar frame
- Shop item Classic & Default tampil langsung sebagai owned+equipped

## Owner Panel

- **Akses Menu Rahasia** — Beri/cabut akses cheat ke player by UID; tersinkron otomatis ke Firestore
- **Edit Player Data** — Cari player by Firebase UID, shortId, atau username; edit nama, diamond, ban/unban
- **Live Match Monitor** — Lihat semua room (lobby & berjalan) di Firebase RTDB
- **Give Reward** — Kirim diamond ke player by UID
- **Global Message** — Broadcast pesan ke semua player yang sedang online, dengan pilihan durasi

## Deployment

Configured as `vm` deployment (always-running) since it uses in-memory game state via WebSockets.
