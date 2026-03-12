// server.js — Hoki Cards Game Server
// Jalankan: node server.js

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { Server } = require('socket.io');

const PORT = 3000;

// ══════════════════════════════════════════════
//  GAME LOGIC
// ══════════════════════════════════════════════
const SUITS        = ['S','H','D','C'];
const SUIT_SYM     = {S:'♠',H:'♥',D:'♦',C:'♣'};
const SUIT_COL     = {S:'black',H:'red',D:'red',C:'black'};
const VALUES       = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const VAL_IDX      = Object.fromEntries(VALUES.map((v,i)=>[v,i]));
const LETTER_VALS  = ['J','Q','K','A'];
const NUMBER_VALS  = ['4','5','6','7','8','9','10'];

const cDisp = (s,v) => v + SUIT_SYM[s];
const cDict = (s,v) => ({suit:s,value:v,display:cDisp(s,v),color:SUIT_COL[s]});
const cVal  = c => VAL_IDX[c.value];

function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}

function dealCards(n){
  const deck=[];
  for(const s of SUITS) for(const v of VALUES) deck.push({suit:s,value:v});
  shuffle(deck);
  const hands=Array.from({length:n},()=>[]);
  deck.forEach((c,i)=>hands[i%n].push(c));
  return hands;
}

function removeCard(hand,card){
  const i=hand.findIndex(c=>c.suit===card.suit&&c.value===card.value);
  if(i!==-1)hand.splice(i,1);
}

function sameSuit(cards){return new Set(cards.map(c=>c.suit)).size===1;}

function validStraight(cards){
  if(cards.length<3||!sameSuit(cards))return false;
  const allNum=cards.every(c=>NUMBER_VALS.includes(c.value));
  const allLet=cards.every(c=>LETTER_VALS.includes(c.value));
  if(!allNum&&!allLet)return false;
  const v=cards.map(c=>VAL_IDX[c.value]).sort((a,b)=>a-b);
  for(let i=1;i<v.length;i++)if(v[i]!==v[i-1]+1)return false;
  return true;
}

function isJQKA(cards){
  if(cards.length!==4)return false;
  const v=cards.map(c=>c.value).sort();
  return JSON.stringify(v)===JSON.stringify(['A','J','K','Q'])&&sameSuit(cards);
}

function getPlayType(cards){
  const n=cards.length;
  if(n===0)return[null,0];
  if(n===1)return['single',cVal(cards[0])];
  if(n===2){if(cards[0].value===cards[1].value)return['double',cVal(cards[0])];return[null,0];}
  if(n===3){
    if(new Set(cards.map(c=>c.value)).size===1)return['triple',cVal(cards[0])];
    if(validStraight(cards)){const h=[...cards].sort((a,b)=>cVal(a)-cVal(b)).at(-1);return['straight3',cVal(h)];}
    return[null,0];
  }
  if(n===4){
    if(isJQKA(cards))return['jqka',99];
    if(new Set(cards.map(c=>c.value)).size===1)return['bomb4',cVal(cards[0])];
    if(validStraight(cards)){const h=[...cards].sort((a,b)=>cVal(a)-cVal(b)).at(-1);return['straight4',cVal(h)];}
    return[null,0];
  }
  if(n>=5&&validStraight(cards)){const h=[...cards].sort((a,b)=>cVal(a)-cVal(b)).at(-1);return['straight5plus',cVal(h)];}
  return[null,0];
}

function isAllTwos(cards){ return cards.length>0&&cards.every(c=>c.value==='2'); }
function isBomb(pt){ return['bomb4','jqka','straight5plus'].includes(pt); }

function canBeat(play,table,ttype){
  if(!table||!table.length||ttype===null)return true;
  const[pt,pv]=getPlayType(play);
  if(pt===null)return false;
  const[,tv]=getPlayType(table);
  // Hanya single 2 yang bisa kena BOM — 22 double dan 222 triple TIDAK bisa kena BOM
  if(ttype==='single'&&table[0].value==='2')return isBomb(pt);
  // 22 double dan 222 triple: tidak ada yang bisa mengalahkan
  if(isAllTwos(table)&&table.length>1)return false;
  if(pt!==ttype)return false;
  if(['straight3','straight4','straight5plus'].includes(ttype)&&play.length!==table.length)return false;
  return pv>tv;
}

function effHand(hand){return hand.filter(c=>c.value!=='3');}

function checkLose(hand){
  const eff=effHand(hand);
  if(eff.length===0&&hand.length>0)return[true,'Sisa kartu 3 semua (pengecoh) — langsung kalah!'];
  // Sisa semua kartu 2 (1, 2, atau 3 kartu 2) → langsung kalah
  if(eff.length>0&&eff.every(c=>c.value==='2'))return[true,`Sisa ${eff.length} kartu 2 saja — tidak bisa menang dengan kartu 2!`];
  return[false,''];
}

// Cek apakah kartu yang BARU DIMAINKAN menyebabkan kalah
// (habis kartu, tapi kartu terakhir yang dimainkan mengandung kartu 2)
function checkPlayedLose(played, handBefore){
  const newHand = [...handBefore];
  for(const c of played){ const i=newHand.findIndex(x=>x.suit===c.suit&&x.value===c.value); if(i!==-1)newHand.splice(i,1); }
  if(newHand.length===0 && played.some(c=>c.value==='2')) return[true,'Kartu 2 dimainkan sebagai kartu terakhir — kalah!'];
  return[false,''];
}

class GameState{
  constructor(n){
    this.numPlayers=n;
    this.hands=[];
    this.currentPlayer=0;
    this.tableCards=[];
    this.tableType=null;
    this.rankings=[];
    this.activePlayers=[];
    this.stoppedPlayers=new Set();
    this.skippedThisRound=new Set();
    this.lastPlayerPlayed=null;
    this.started=false;
    this.gameOver=false;
    this.message='';
    this.phase='opening';
    this.openingDone=new Set();
    this.openerIdx=0;
    this.decoyCards=[];
    this.openingTable=[];
  }

  startGame(){
    this.hands=dealCards(this.numPlayers);
    this.rankings=[];
    this.stoppedPlayers=new Set();
    this.skippedThisRound=new Set();
    this.activePlayers=Array.from({length:this.numPlayers},(_,i)=>i);
    this.tableCards=[];this.tableType=null;this.lastPlayerPlayed=null;
    this.started=true;this.gameOver=false;this.phase='opening';
    this.openingDone=new Set();this.decoyCards=[];this.openingTable=[];
    // Cek langsung kalah: tangan mengandung semua 4 kartu 2 (2222)
    for(let i=0;i<this.hands.length;i++){
      const twos=this.hands[i].filter(c=>c.value==='2');
      if(twos.length===4){
        this.activePlayers=this.activePlayers.filter(p=>p!==i);
        this.message=`💀 Pemain ${i+1} langsung KALAH! Dapat semua 4 kartu 2!`;
        if(this.activePlayers.length===1){
          const winner=this.activePlayers[0];
          this.rankings.push(winner);this.activePlayers=[];
          this.gameOver=true;
          this.message+=` | 🏆 Pemain ${winner+1} Menang!`;
          return;
        }
      }
    }
    for(let i=0;i<this.hands.length;i++){
      for(const c of this.hands[i]){
        if(c.value==='3'&&c.suit==='S'){
          this.currentPlayer=i;this.openerIdx=i;
          this.message=`🃏 Ronde pembukaan! Semua boleh buang kartu 3 atau skip. Pemain ${i+1} wajib keluarkan 3♠!`;
          return;
        }
      }
    }
  }

  playOpening(pidx,sel){
    if(this.openingDone.has(pidx))return[false,'Kamu sudah aksi di ronde pembukaan!'];
    if(!this.activePlayers.includes(pidx))return[false,'Kamu tidak aktif!'];
    let msg='';
    if(sel.length>0){
      for(const c of sel){
        if(c.value!=='3')return[false,'Hanya boleh keluarkan kartu 3 di ronde pembukaan!'];
        if(!this.hands[pidx].find(h=>h.suit===c.suit&&h.value===c.value))return[false,'Kartu tidak ada di tangan!'];
      }
      if(pidx===this.openerIdx&&!sel.find(c=>c.suit==='S'&&c.value==='3'))
        return[false,'Kamu pegang 3♠, wajib keluarkan 3♠ di ronde pembukaan!'];
      for(const c of sel){removeCard(this.hands[pidx],c);this.openingTable.push(c);}
      msg=`Pemain ${pidx+1} buang ${sel.map(c=>cDisp(c.suit,c.value)).join(', ')} (pengecoh)`;
    } else {
      if(pidx===this.openerIdx&&this.hands[pidx].find(c=>c.suit==='S'&&c.value==='3'))
        return[false,'Kamu pegang 3♠, wajib keluarkan 3♠ sebelum skip!'];
      msg=`Pemain ${pidx+1} simpan kartu 3 (skip)`;
    }
    this.openingDone.add(pidx);
    if(this.openingDone.size>=this.activePlayers.length){
      this.phase='normal';this.currentPlayer=this.openerIdx;
      this.tableCards=[];this.tableType=null;this.skippedThisRound=new Set();
      this.lastPlayerPlayed=null;this.openingTable=[];
      msg+=` | ✅ Ronde pembukaan selesai! Pemain ${this.openerIdx+1} mulai ronde normal!`;
    } else {
      msg+=` | Menunggu ${this.activePlayers.length-this.openingDone.size} pemain lagi...`;
    }
    this.message=msg;return[true,msg];
  }

  playCards(pidx,sel){
    if(this.phase==='opening')return this.playOpening(pidx,sel);
    if(pidx!==this.currentPlayer)return[false,'Bukan giliran kamu!'];
    if(!sel||!sel.length)return[false,'Pilih kartu dulu!'];

    // Kartu 3 pengecoh
    if(sel.length===1&&sel[0].value==='3'){
      const c3=sel[0];removeCard(this.hands[pidx],c3);this.decoyCards=[c3];
      let msg=`Pemain ${pidx+1} buang ${cDisp(c3.suit,c3.value)} (pengecoh) — harus main lagi!`;
      const[il,lm]=checkLose(this.hands[pidx]);
      if(il){
        this.hands[pidx]=[];msg+=` | 💀 ${lm} Pemain ${pidx+1} KALAH!`;
        const ai=this.activePlayers.indexOf(pidx);if(ai!==-1)this.activePlayers.splice(ai,1);
        if(this.activePlayers.length===1){
          const winner=this.activePlayers[0];
          this.rankings.push(winner);this.activePlayers=[];
          msg+=` | 🏆 Pemain ${winner+1} Menang!`;
          this.gameOver=true;
        } else if(this.activePlayers.length===0){this.gameOver=true;}
        if(!this.gameOver)this._next(pidx);
        this.message=msg;return[true,msg];
      }
      this.message=msg;return[true,msg];
    }

    const[pt,pv]=getPlayType(sel);
    if(pt===null)return[false,'Kombinasi kartu tidak valid!'];
    const isFree=!this.tableCards.length;
    if(!isFree&&!canBeat(sel,this.tableCards,this.tableType))return[false,'Kartu tidak bisa mengalahkan kartu di meja!'];

    // Bom victim — hanya single 2 yang bisa di-BOM
    let bomVic=null;
    if(!isFree && this.tableType==='single' && this.tableCards[0].value==='2' && isBomb(pt))
      bomVic=this.lastPlayerPlayed;

    // Wajib 2 duluan — kalau sisa tangan semua kartu 2, tidak boleh main kartu lain
    const eb=effHand(this.hands[pidx]);
    if(eb.length>0 && eb.every(c=>c.value==='2') && !sel.every(c=>c.value==='2'))
      return[false,'⚠️ Sisa kartu kamu semua kartu 2 — hanya bisa BOM atau kena BOM saja!'];
    // Kalau sisa 2+ kartu efektif dan ada kartu 2 di antaranya, wajib keluarkan 2 duluan
    if(eb.length>=2&&eb.some(c=>c.value==='2')&&!sel.some(c=>c.value==='2')){
      // Cek apakah sel akan menghabiskan semua kartu non-2
      const remaining=[...this.hands[pidx]];
      for(const c of sel){const i=remaining.findIndex(x=>x.suit===c.suit&&x.value===c.value);if(i!==-1)remaining.splice(i,1);}
      const remEff=effHand(remaining);
      if(remEff.every(c=>c.value==='2'))
        return[false,'⚠️ Kartu terakhir kamu adalah kartu 2 — wajib mainkan 2 lebih dulu!'];
    }

    // Simpan tangan sebelum dimainkan untuk cek kalah kartu 2 terakhir
    const handBefore=[...this.hands[pidx]];
    for(const c of sel)removeCard(this.hands[pidx],c);
    const prevLast=this.lastPlayerPlayed;
    this.tableCards=sel;this.tableType=pt;this.lastPlayerPlayed=pidx;
    this.skippedThisRound=new Set();this.decoyCards=[];
    let msg=`Pemain ${pidx+1} main: ${sel.map(c=>cDisp(c.suit,c.value)).join(', ')}`;

    if(bomVic!==null&&this.activePlayers.includes(bomVic)){
      const ai=this.activePlayers.indexOf(bomVic);if(ai!==-1)this.activePlayers.splice(ai,1);
      msg+=` | 💥 BOM! Pemain ${bomVic+1} langsung kalah!`;
      if(this.activePlayers.length===1){
        const winner=this.activePlayers[0];
        this.rankings.push(winner);this.activePlayers=[];
        msg+=` | 🏆 Pemain ${winner+1} Menang!`;
        this.gameOver=true;
      } else if(this.activePlayers.length===0){this.gameOver=true;}
    }
    if(pt==='straight4'&&prevLast!==null&&prevLast!==pidx&&this.activePlayers.includes(prevLast)){
      this.stoppedPlayers.add(prevLast);msg+=` | 🛑 Pemain ${prevLast+1} di-stop 1 putaran!`;
    }

    // Cek kalah: kartu 2 dimainkan sebagai kartu terakhir (tangan jadi kosong)
    const[ilp,lmp]=checkPlayedLose(sel, handBefore);
    if(ilp){
      msg+=` | 💀 ${lmp} Pemain ${pidx+1} KALAH!`;this.hands[pidx]=[];
      const ai1=this.activePlayers.indexOf(pidx);if(ai1!==-1)this.activePlayers.splice(ai1,1);
      if(this.activePlayers.length===1){
        const winner=this.activePlayers[0];
        this.rankings.push(winner);this.activePlayers=[];
        msg+=` | 🏆 Pemain ${winner+1} Menang!`;
        this.gameOver=true;
      } else if(this.activePlayers.length===0){ this.gameOver=true; }
      if(!this.gameOver)this._next(pidx);
      this.message=msg;return[true,msg];
    }
    // Cek instant lose: sisa tangan semua kartu 2 atau semua kartu 3
    const[il,lm]=checkLose(this.hands[pidx]);
    if(il){
      msg+=` | 💀 ${lm} Pemain ${pidx+1} KALAH!`;this.hands[pidx]=[];
      const ai1=this.activePlayers.indexOf(pidx);if(ai1!==-1)this.activePlayers.splice(ai1,1);
      if(this.activePlayers.length===1){
        const winner=this.activePlayers[0];
        this.rankings.push(winner);this.activePlayers=[];
        msg+=` | 🏆 Pemain ${winner+1} Menang!`;
        this.gameOver=true;
      } else if(this.activePlayers.length===0){
        this.gameOver=true;
      }
      if(!this.gameOver)this._next(pidx);
      this.message=msg;return[true,msg];
    }
    // Cek habis kartu = menang (kartu terakhir bukan kartu 2)
    if(this.hands[pidx].length===0){
      this.rankings.push(pidx);
      const ai0=this.activePlayers.indexOf(pidx);if(ai0!==-1)this.activePlayers.splice(ai0,1);
      msg+=` | 🏆 Pemain ${pidx+1} Juara ${this.rankings.length}!`;
      if(this.activePlayers.length===1){
        const loser=this.activePlayers[0];
        this.activePlayers=[];
        msg+=` | 💀 Pemain ${loser+1} Kalah!`;
        this.gameOver=true;
      } else if(this.activePlayers.length===0){
        this.gameOver=true;
      }
      if(!this.gameOver)this._next(pidx);
      this.message=msg;return[true,msg];
    }
    this._next();this.message=msg;return[true,msg];
  }

  skipTurn(pidx){
    if(this.phase==='opening')return this.playOpening(pidx,[]);
    if(pidx!==this.currentPlayer)return[false,'Bukan giliran kamu!'];
    this.skippedThisRound.add(pidx);this.decoyCards=[];
    let msg=`Pemain ${pidx+1} skip`;
    this._next();
    const others=this.activePlayers.filter(p=>p!==this.lastPlayerPlayed);
    if(others.length>0&&others.every(p=>this.skippedThisRound.has(p))){
      this.tableCards=[];this.tableType=null;this.skippedThisRound=new Set();
      msg+=` | Meja reset! Pemain ${this.currentPlayer+1} bebas main!`;
    }
    this.message=msg;return[true,msg];
  }

  _next(from=null){
    const a=this.activePlayers;if(!a.length)return;
    let s=from!==null?from:this.currentPlayer;
    if(!a.includes(s))s=a[0];
    const si=a.indexOf(s);
    for(let i=1;i<=a.length;i++){
      const nxt=a[(si+i)%a.length];
      if(this.stoppedPlayers.has(nxt)){this.stoppedPlayers.delete(nxt);continue;}
      this.currentPlayer=nxt;return;
    }
  }

  toDict(fp=null){
    return{
      num_players:this.numPlayers,current_player:this.currentPlayer,
      table_cards:this.tableCards.map(c=>cDict(c.suit,c.value)),
      table_type:this.tableType,rankings:this.rankings,
      active_players:this.activePlayers,stopped_players:[...this.stoppedPlayers],
      game_over:this.gameOver,message:this.message,phase:this.phase,
      opener_idx:this.openerIdx,opening_done:[...this.openingDone],
      decoy_cards:this.decoyCards.map(c=>cDict(c.suit,c.value)),
      opening_table:this.openingTable.map(c=>cDict(c.suit,c.value)),
      hand:fp!==null?this.hands[fp].map(c=>cDict(c.suit,c.value)):[],
      hand_counts:this.hands.map(h=>h.length),
    };
  }
}

// ══════════════════════════════════════════════
//  HTTP + SOCKET.IO
// ══════════════════════════════════════════════
const httpServer=http.createServer((req,res)=>{
  let fp=path.join(__dirname,'www',req.url==='/'?'index.html':req.url);
  const ext=path.extname(fp);
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':mime[ext]||'text/plain'});res.end(data);
  });
});

const io=new Server(httpServer,{cors:{origin:'*'}});
const rooms={};const sidRoom={};

function genId(){
  const ch='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  while(true){let id='';for(let i=0;i<6;i++)id+=ch[Math.floor(Math.random()*ch.length)];if(!rooms[id])return id;}
}

function getState(roomId,fp=null){
  const r=rooms[roomId];const s=r.game.toDict(fp);
  s.room_id=roomId;s.player_names=r.playerNames;
  s.num_players=r.numPlayers;s.players_joined=Object.keys(r.players).length;
  return s;
}

function broadcast(roomId){
  const r=rooms[roomId];if(!r)return;
  for(const[sid,pidx] of Object.entries(r.players))
    io.to(sid).emit('state_update',getState(roomId,pidx));
}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function botThink(roomId){
  await sleep(1500);
  while(rooms[roomId]){
    const r=rooms[roomId];const gs=r.game;
    if(gs.gameOver)break;

    // Opening: simultan
    if(gs.phase==='opening'){
      let acted=false;
      for(const bi of r.botIndices){
        if(gs.openingDone.has(bi)||!gs.activePlayers.includes(bi))continue;
        await sleep(900);
        if(!rooms[roomId])return;
        const gs2=rooms[roomId].game;
        if(gs2.phase!=='opening'||gs2.openingDone.has(bi))continue;
        const threes=gs2.hands[bi].filter(c=>c.value==='3');
        if(bi===gs2.openerIdx){
          const t3s=threes.find(c=>c.suit==='S');
          gs2.playOpening(bi,t3s?[t3s]:[]);
        } else {
          gs2.playOpening(bi,threes.length&&Math.random()>0.4?[threes[0]]:[]);
        }
        acted=true;broadcast(roomId);
      }
      if(!acted)await sleep(400);
      continue;
    }

    // Normal
    const cp=gs.currentPlayer;
    if(!r.botIndices.includes(cp)){await sleep(400);continue;}
    await sleep(r.botDiff==='hard'?700:1200);
    if(!rooms[roomId])break;
    const gs3=rooms[roomId].game;
    if(gs3.gameOver)break;
    const cpN=gs3.currentPlayer;
    if(!r.botIndices.includes(cpN))continue;

    const hand=gs3.hands[cpN];
    const non3=hand.filter(c=>c.value!=='3');
    let played=false;

    if(gs3.tableCards.length){
      const tt=gs3.tableType;
      if(tt==='single'){
        const cands=non3.filter(c=>canBeat([c],gs3.tableCards,tt))
          .sort((a,b)=>VAL_IDX[a.value]-VAL_IDX[b.value]);
        if(cands.length){const[ok]=gs3.playCards(cpN,[cands[0]]);if(ok)played=true;}
      }
      if(!played)gs3.skipTurn(cpN);
    } else {
      if(non3.length){
        const c=[...non3].sort((a,b)=>VAL_IDX[a.value]-VAL_IDX[b.value])[0];
        const[ok]=gs3.playCards(cpN,[c]);if(ok)played=true;
      }
      if(!played&&hand.length)gs3.skipTurn(cpN);
    }
    broadcast(roomId);await sleep(200);
  }
}

// ── EVENTS ──
io.on('connection',socket=>{
  console.log(`[+] ${socket.id}`);

  socket.on('disconnect',()=>{
    const rid=sidRoom[socket.id];
    if(rid&&rooms[rid]){
      const r=rooms[rid];const pidx=r.players[socket.id];
      delete r.players[socket.id];delete sidRoom[socket.id];
      io.to(rid).emit('player_left',{message:`Pemain ${r.playerNames[pidx]||pidx+1} keluar!`});
    }
    console.log(`[-] ${socket.id}`);
  });

  socket.on('create_room',data=>{
    const n=parseInt(data.num_players)||2;
    const name=data.name||'Pemain 1';
    const botMode=!!data.bot_mode;
    const botDiff=data.bot_diff||'easy';
    const rid=genId();
    const gs=new GameState(n);
    const botNames=['Bot-A','Bot-B','Bot-C'];
    const pnames={0:name};
    if(botMode)for(let i=1;i<n;i++)pnames[i]='🤖 '+botNames[i-1];

    rooms[rid]={game:gs,players:{[socket.id]:0},playerNames:pnames,
      numPlayers:n,hostSid:socket.id,started:false,
      botMode,botDiff,botIndices:botMode?Array.from({length:n-1},(_,i)=>i+1):[]};
    sidRoom[socket.id]=rid;socket.join(rid);

    if(botMode){
      rooms[rid].game.startGame();rooms[rid].started=true;
      socket.emit('room_created',{room_id:rid,player_idx:0,num_players:n});
      socket.emit('game_started',getState(rid,0));
      botThink(rid);
    } else {
      socket.emit('room_created',{room_id:rid,player_idx:0,num_players:n,
        message:`Room ${rid} dibuat! Bagikan kode ke teman.`});
    }
    console.log(`[ROOM] ${rid} by ${name} bot=${botMode}`);
  });

  socket.on('join_room_game',data=>{
    const rid=(data.room_id||'').toUpperCase().trim();
    const name=data.name||'Pemain';
    if(!rooms[rid])return socket.emit('error',{message:`Room ${rid} tidak ditemukan!`});
    const r=rooms[rid];
    if(r.started)return socket.emit('error',{message:'Game sudah dimulai!'});
    if(Object.keys(r.players).length>=r.numPlayers)return socket.emit('error',{message:'Room sudah penuh!'});
    const used=new Set(Object.values(r.players));
    let pidx=0;for(let i=0;i<r.numPlayers;i++)if(!used.has(i)){pidx=i;break;}
    r.players[socket.id]=pidx;r.playerNames[pidx]=name;
    sidRoom[socket.id]=rid;socket.join(rid);
    socket.emit('joined_room',{room_id:rid,player_idx:pidx,num_players:r.numPlayers,
      message:`Bergabung ke room ${rid} sebagai Pemain ${pidx+1}`});
    const joined=Object.keys(r.players).length;
    io.to(rid).emit('player_joined',{message:`${name} bergabung! (${joined}/${r.numPlayers})`,
      players_joined:joined,num_players:r.numPlayers,player_names:r.playerNames});
    console.log(`[JOIN] ${name} → ${rid} P${pidx+1}`);
  });

  socket.on('start_game',()=>{
    const rid=sidRoom[socket.id];if(!rid||!rooms[rid])return;
    const r=rooms[rid];
    if(r.hostSid!==socket.id)return socket.emit('error',{message:'Hanya host yang bisa mulai game!'});
    if(Object.keys(r.players).length<2)return socket.emit('error',{message:'Minimal 2 pemain!'});
    r.game.startGame();r.started=true;
    for(const[sid,pidx] of Object.entries(r.players))
      io.to(sid).emit('game_started',getState(rid,pidx));
    console.log(`[START] ${rid}`);
  });

  socket.on('play_cards',data=>{
    const rid=sidRoom[socket.id];if(!rid||!rooms[rid])return;
    const r=rooms[rid];const pidx=r.players[socket.id];if(pidx===undefined)return;
    const cards=(data.cards||[]).map(c=>({suit:c.suit,value:c.value}));
    const[ok,msg]=r.game.playCards(pidx,cards);
    if(!ok)return socket.emit('error',{message:msg});
    broadcast(rid);
  });

  socket.on('skip_turn',()=>{
    const rid=sidRoom[socket.id];if(!rid||!rooms[rid])return;
    const r=rooms[rid];const pidx=r.players[socket.id];if(pidx===undefined)return;
    const[ok,msg]=r.game.skipTurn(pidx);
    if(!ok)return socket.emit('error',{message:msg});
    broadcast(rid);
  });

  socket.on('get_state',()=>{
    const rid=sidRoom[socket.id];if(!rid||!rooms[rid])return;
    const r=rooms[rid];const pidx=r.players[socket.id]??0;
    socket.emit('state_update',getState(rid,pidx));
  });
});

// ── START ──
function getIP(){
  for(const nets of Object.values(os.networkInterfaces()))
    for(const n of nets)if(n.family==='IPv4'&&!n.internal)return n.address;
  return'localhost';
}
httpServer.listen(PORT,'0.0.0.0',()=>{
  const ip=getIP();
  console.log('\n================================');
  console.log('  🃏 HOKI CARDS SERVER AKTIF!');
  console.log('================================');
  console.log(`\n  Buka di HP ini:\n  http://localhost:${PORT}`);
  console.log(`\n  Buka di HP teman:\n  http://${ip}:${PORT}`);
  console.log('\n================================\n');
});
