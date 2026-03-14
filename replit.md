# Hoki Cards

A real-time multiplayer card game (Capsa/Big Two variant) built with Node.js and Socket.io.

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
- **Owner check** — Cek UID hardcoded + Firestore `owners` collection + localStorage `hoki_is_owner`
- Jika panel tidak muncul, panggil `_addMeAsOwner()` di browser console satu kali
- **Edit Player Data** — Cari player by Firebase UID, shortId, atau username; edit nama, diamond, ban/unban
- **Live Match Monitor** — Lihat semua room (lobby & berjalan) di Firebase RTDB
- **Give Reward** — Kirim diamond ke player by UID
- **Global Message** — Broadcast pesan ke semua player yang sedang online, dengan pilihan durasi

## Sound Effects & Animations

- Sound effects via Web Audio API (no external files): deal, place, pass, turn, win, lose, click
- Card deal animation: kartu terbang 1-per-1 dari tengah meja ke posisi pemain saat game dimulai

## Deployment / GitHub

- GitHub Actions: `.github/workflows/` — hanya build APK debug (bukan deploy ke Firebase Hosting)
- APK artifact tersedia di tab Actions setelah setiap push ke `main`
- Firebase Hosting BELUM dikonfigurasi (game ini pakai server Node.js, bukan static hosting)

---

## ATURAN WAJIB UNTUK AGENT (BACA SETIAP SESI)

> Instruksi dari owner proyek. Wajib diikuti tanpa pengecualian.

### 1. Alur kerja fitur
- Setiap fitur/perbaikan yang selesai **LANGSUNG ditulis ke `www/index.html`** (atau file `www/` lain yang relevan)
- **JANGAN pernah tulis hasil ke `attached_assets/`** — folder itu hanya untuk file yang diupload user
- Setelah menulis ke `www/`, restart workflow lalu **ambil screenshot** untuk verifikasi visual

### 2. Test setiap fitur sebelum lanjut
- Test menggunakan akun owner: **username `henn`, password `123456`**
- Login via mode Online (Firebase)
- Pastikan fitur berjalan benar di browser sebelum dianggap selesai
- Jika ada error, fix dulu — jangan lanjut ke fitur berikutnya

### 3. Git push otomatis
- Setelah **semua fitur dalam satu sesi selesai dan sudah ditest**, langsung push ke GitHub **tanpa menunggu perintah dari user**
- Perintah push: `git push "https://HendiST:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/HendiST/hoki-cards" HEAD:main`
- `GITHUB_PERSONAL_ACCESS_TOKEN` **sudah tersimpan sebagai Replit Secret** — langsung pakai, jangan minta ke user lagi
- Tidak perlu minta izin user untuk push — lakukan otomatis setelah semua selesai

### 4. Urutan kerja yang benar
1. Kerjakan fitur → tulis ke `www/`
2. Restart workflow
3. Screenshot + test dengan akun `henn`/`123456`
4. Jika OK → lanjut ke fitur berikutnya
5. Setelah semua fitur selesai → git push otomatis
