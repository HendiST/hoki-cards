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

## Daily Login Reward

- `DAILY_REWARDS = [50,50,50,50,50,100,150]` diamonds (hari 1–5: 50💎, hari 6: 100💎, hari 7: 150💎)
- `DAILY_CASINO_REWARD = 50000` (Rp 50.000 untuk semua hari)
- Setiap klaim: +diamonds via Firestore increment + +Rp 50.000 via RTDB transaction di `casino/players/uid`
- **Modal** tampil otomatis saat login pertama hari itu; menampilkan kedua reward
- **Profil** — Kartu `#pf-daily-card` di tab Profil menampilkan kalender 7 hari + tombol Klaim jika ada reward belum diklaim

## Owner Panel

- **Akses Menu Rahasia** — Beri/cabut akses cheat ke player by UID; tersinkron otomatis ke Firestore
- **Owner check** — Cek UID hardcoded + Firestore `owners` collection + localStorage `hoki_is_owner`
- Jika panel tidak muncul, panggil `_addMeAsOwner()` di browser console satu kali
- **Edit Player Data** — Cari player by Firebase UID, shortId, atau username; edit nama, diamond, ban/unban
- **Live Match Monitor** — Lihat semua room (lobby & berjalan) di Firebase RTDB
- **Give Reward** — Kirim diamond ke player by UID
- **Give Uang Kasino** — Tambah/kurangi saldo Rp pemain yang sedang duduk di meja kasino; pilih meja, isi UID + nominal ±Rp
- **Global Message** — Broadcast pesan ke semua player yang sedang online, dengan pilihan durasi

## Kasino — Bug Fixes & Improvements

- **Rejoin saat PLAYING** — Duduk di kursi saat game PLAYING kini masuk sebagai `WAITING_NEXT_ROUND` (bukan `SITTING`), sehingga tidak mengganggu pemain lain. Pemain otomatis ikut ronde berikutnya setelah ronde selesai.
- **Countdown reset** — Saat player baru duduk (`doTakeSeat`) selama fase WAITING dan countdown sudah berjalan, timer di-reset ke 10s agar pemain baru punya waktu untuk pasang taruhan.
- **Owner bot/reset saat menonton** — Tombol Add Bot, Hapus Bot, Reset Meja sekarang tampil untuk owner meski hanya menonton (tidak duduk di kursi). `doResetCasino()` mengizinkan owner meski bukan host.
- **`_isSeatEmpty` auto-skip** — Jika pemain forfeit saat game berlangsung, host otomatis skip giliran mereka agar game tidak buntu.

## Casino Money HUD

- **`#cs-money-hud`** — HUD hijau di header kasino, tampil saat pemain duduk, menampilkan saldo Rp saat ini
- Update otomatis setiap `renderCasino()` dipanggil via `st.myMoney`
- Disembunyikan saat mode penonton (tidak duduk)

## Give Uang Kasino (Owner Panel) — Real-time Notification

**Arsitektur (final):**
- Jika pemain **sedang di meja**: owner langsung update `casino/rooms/$rid/seats/$sid` via transaction (path terbuka untuk semua auth user)
- Jika pemain **tidak di meja**: owner hanya menulis ke `pending_casino_gifts/uid` — SI PEMAIN SENDIRI yang update saldonya saat menerima notifikasi (karena `auth.uid === $uid` selalu diizinkan untuk write ke `casino/players/uid`)
- `pending_casino_gifts` listener: hapus notifikasi → jalankan transaction `casino/players/uid` (oleh pemain sendiri) → update HUD → tampil toast
- Input UID di owner panel juga support username/shortId (bukan hanya UID penuh Firebase)
- RTDB rules: `pending_casino_gifts/$uid` — hanya owner yang bisa tulis, pemain bisa hapus (setelah diklaim)

## Kasino Online System

- **5 Meja Permanen** — `CASINO_1` s/d `CASINO_5` ("Meja 1"–"Meja 5") dibuat saat server start, tidak pernah dihapus
- **4 Kursi per Meja** — `cs-s1` (kiri), `cs-s2` (atas), `cs-s3` (kanan), `cs-s4` (bawah), dealer badge di atas
- **Call-Based Betting** — Min taruhan Rp 5.000, maks Rp 10.000.000 per ronde; semua pemain harus CALL taruhan tertinggi sebelum game mulai
- **Starting Money** — Rp 5.000.000 per pemain per sesi kasino
- **Spectator Mode** — Pemain yang join saat game sedang berjalan menunggu di `WAITING_NEXT_ROUND`, bisa nonton
- **Animasi Pot** — Uang (gepok, lembaran 100K/50K/20K/10K/5K) muncul di tengah meja, max 20 objek
- **Dealer NPC** — Badge "🎰 DEALER" di atas meja (bukan pemain)
- **Shuffle Overlay** — Fullscreen overlay `#cs-shuffle-ov` saat dealer mengocok kartu
- **Socket Events**: `casino_get_rooms`, `casino_join`, `casino_take_seat`, `casino_leave_seat`, `casino_leave`, `casino_place_bet`, `casino_call`, `casino_play_cards`, `casino_skip_turn`

## Taruhan (Betting) System

- **Bet Selector** — Saat buat room (Bot, Mabar Privat, Online), pilih taruhan per pemain: Tanpa, 50K, 100K, 500K, 1JT, 2.5JT, 5JT, 10JT
- **Visual Pot di Meja** — Total taruhan (bet × jumlah pemain) ditampilkan di tengah meja sebagai:
  - **Gepok uang** (hijau, rubber band merah) untuk setiap Rp 1.000.000
  - **Lembaran 500K** (biru), **100K** (merah), **50K** (ungu) untuk sisa yang tidak genap 1JT
  - Max 12 objek uang di meja (performa terjaga)
  - Animasi pop-in saat objek muncul
- **Label POT** — Menampilkan total pot di bawah tumpukan uang
- **Propagasi bet_amount** — Tersimpan di server (socket.io mabar), RTDB (online), dan bot state

## Sound Effects & Animations

- Sound effects via Web Audio API (no external files): deal, place, pass, turn, win, lose, click
- **Suara baru**: sfxCardFlip (pilih kartu), sfxBlap (kartu ke meja), sfxBomb (dramatis + haptic), sfxDeckAppear, sfxRiffleWave, sfxSquareUp, sfxCardStack
- **Shuffle animation**: deck muncul → split jadi 2 → 2x riffle 3D → square up → fade out (±3.6 detik)
- **Enhanced deal animation**: kartu terbang 3D dengan rotateX/Y + perspective 900px + box-shadow depth
- **Win animation**: confetti hujan 90 partikel + 5 firework burst + teks "🏆 MENANG!" spring pop + haptic
- **Lose animation**: teks "💀 KALAH" + shake layar + haptic
- **Spring card selection**: `.card` transition cubic-bezier spring + scale 1.07 + shadow gold
- **Haptic vibration**: giliran (double-pulse), pilih kartu (18ms), bom (pattern dramatis), menang/kalah
- **Invite fix**: notifikasi undangan sekarang muncul di semua layar (kecuali saat di dalam game)

## Kasino Online — Arsitektur Data

- **5 meja permanen** selalu tampil di lobby dari hardcode `_CS_DEFAULT_ROOMS` (tidak bergantung RTDB)
- Data live (siapa duduk, taruhan, status game) di-overlay dari `casino/rooms/` di Firebase RTDB
- `_csInitRooms()` dipanggil saat login (`onUserLoggedIn`) dan saat lobby dibuka jika RTDB kosong
- Jika RTDB error/rules blokir → lobby tetap tampil 5 meja dengan status default (WAITING)

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
3. test fitur dengan akun `henn`/`123456`
4. Jika OK → lanjut ke fitur berikutnya
5. Setelah semua fitur selesai → git push otomatis

### 5. SELALU UPDATE RULES FIRESTORE & REALTIME DATABASE JIKA BUAT FITUR BARU
- Kirim file baru di folder firebase
- dan hapus file lamanya
- pastikan rules firebase sudah mencakup semua fitur yang butuh firebase 
