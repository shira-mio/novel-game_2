/* =========================================================
   進行・描画・セーブ
   ========================================================= */

/* ---- 先読み ---- */
const bgPre = {};
function preloadBg(){
  Object.values(BG).forEach(b=>{
    if(!b.f || bgPre[b.f]) return;
    const im = new Image(); im.src = BG_DIR + b.f; bgPre[b.f] = im;
  });
}
// 立ち絵は初回表示時にまとめて先読みする（表情替えでちらつかせない）。
// 読むのはシナリオが実際に使う表情だけ。
let EXPR_LIST = null;
function usedExprFiles(){
  if(EXPR_LIST) return EXPR_LIST;
  const s = new Set([EXPR.normal, EXPR[GAME.titleExpr] || EXPR.normal]);
  Object.values(S).forEach(sc=>sc.forEach(c=>{
    if(c.sp && c.ex && EXPR[c.ex]) s.add(EXPR[c.ex]);
    if(c.ex && c.e && EXPR[c.e]) s.add(EXPR[c.e]);
  }));
  return EXPR_LIST = [...s];
}
const preloaded = {};
function preloadChar(id){
  if(preloaded[id]) return; preloaded[id] = [];
  usedExprFiles().forEach(f=>{
    const im = new Image(); im.src = `assets/chr/${CHARS[id].dir}/${f}.webp`; preloaded[id].push(im);
  });
}

/* ---- 状態 ---- */
let st = null;          // 進行中の状態
let typing = false, typeTimer = null, fullText = '', shownChars = {};
let autoMode=false, skipMode=false, autoTimer=null, waiting=false, atEnd=false;
let uiHidden=false, hintTimer=null;
let silent=false;       // セーブ復元中。演出を出さずに状態だけ合わせる
let backlog = [];
let bgSlot = 0;

/* ---- 描画 ---- */
function setBg(key, instant){
  const b = BG[key] || BG.black;
  const cursel = bgSlot, next = 1-bgSlot;
  const el = document.getElementById('bg'+next);
  el.style.backgroundImage = b.f ? `url("${BG_DIR}${b.f}")` : 'none';
  el.style.setProperty('--dim', b.d);
  if(instant){ el.style.transition='none'; }
  el.classList.add('on');
  document.getElementById('bg'+cursel).classList.remove('on');
  if(instant){ requestAnimationFrame(()=>{ el.style.transition=''; }); }
  bgSlot = next;
  st && (st.bg = key);
}
// 立ち位置と大きさは人数で決まる。高さは画面幅では縮めない――縮めると
// 顔がメッセージ窓の裏に沈む。横は重なってよい（#chars で切る）。
const LAYOUT = {
  1:{x:{L:50,C:50,R:50}, vh:78},
  2:{x:{L:26,C:50,R:74}, vh:74},
  3:{x:{L:18,C:50,R:82}, vh:68},
  4:{x:{L:14,C:38,R:62,R2:86}, vh:62}
};
// 寄り。k は上の高さに掛ける倍率、t は頭の上を画面上端から何 vh に置くか。
// 立ち絵は4人とも「髪の上端から顎まで」が高さの 0.24 を占める（実測）。
// close ではその顔が画面高さの約 38% を占め、メッセージ窓の上端がちょうど
// 胸のあたりに来る。bust は腰のあたりで切れる。
//   wide  … 登場・状況説明・3人以上の場面
//   bust  … ふつうに会話している場面
//   close … 打ち明ける・言い切る場面。1人か2人のときだけ使う
// t:null は「下端をメッセージ窓のわずか裏（下から16vh）に合わせる」の意味。
const ZOOM = {
  wide :{k:1.00, t:null},
  bust :{k:1.41, t:4},
  close:{k:2.03, t:3}
};
function layoutChars(){
  const els = [...document.querySelectorAll('.chr')].filter(e=>!e._rm);
  const L = LAYOUT[Math.min(4, Math.max(1, els.length))];
  els.forEach(el=>{
    const z = ZOOM[el.dataset.zoom] || ZOOM.wide;
    const h = L.vh * z.k;
    el.style.setProperty('--x', (L.x[el.dataset.pos] ?? 50) + '%');
    el.style.setProperty('--h', h.toFixed(1) + 'vh');
    el.style.setProperty('--t', (z.t === null ? 100 - 16 - h : z.t).toFixed(1) + 'vh');
  });
}
function showChar(id,pos,ex,zoom){
  preloadChar(id);
  let el = document.querySelector('.chr[data-id="'+id+'"]');
  if(el && el._rm){ clearTimeout(el._rm); el._rm=null; }
  if(!el){
    el = document.createElement('div');
    el.className='chr'; el.dataset.id=id;
    el.innerHTML = '<img alt="">';
    $('#chars').appendChild(el);
  }
  el.dataset.pos = pos;
  el.dataset.zoom = ZOOM[zoom] ? zoom : 'wide';
  el.querySelector('img').src = chrSrc(id, ex);
  layoutChars();
  requestAnimationFrame(()=>el.classList.add('on'));
  shownChars[id] = {pos, ex, zoom:el.dataset.zoom};
}
function setExpr(id,ex){
  const el = document.querySelector('.chr[data-id="'+id+'"]');
  if(!el) return;
  el.querySelector('img').src = chrSrc(id, ex);
  if(shownChars[id]) shownChars[id].ex = ex;
}
// 表示中の立ち絵の寄りだけを変える
function setZoom(id,zoom){
  const el = document.querySelector('.chr[data-id="'+id+'"]');
  if(!el) return;
  el.dataset.zoom = ZOOM[zoom] ? zoom : 'wide';
  if(shownChars[id]) shownChars[id].zoom = el.dataset.zoom;
  layoutChars();
}
function hideChar(id){
  const el = document.querySelector('.chr[data-id="'+id+'"]');
  if(el){ el.classList.remove('on'); el._rm = setTimeout(()=>{ el.remove(); layoutChars(); },480); }
  delete shownChars[id];
  layoutChars();
}
function clearChars(){ Object.keys(shownChars).forEach(hideChar); }
function focusChar(name){
  const all = [...document.querySelectorAll('.chr')];
  // 話者を特定できない（地の文・主人公など）ときは、誰も暗くしない
  const hit = name ? Object.keys(CHARS).filter(id=>CHARS[id].alias.includes(name)) : [];
  if(!hit.length){ all.forEach(el=>el.classList.remove('dim')); return; }
  all.forEach(el=>el.classList.toggle('dim', !hit.includes(el.dataset.id)));
}
const nameOf = s => (s||'').replace(/%name%/g, st ? st.name : '湊');

/* ---- 章タイトル ---- */
function showChapter(text, done){
  const el = $('#chapter');
  el.style.transitionDuration = '';
  el.firstElementChild.textContent = text;
  el.classList.add('on');
  setTimeout(()=>{
    el.classList.remove('on');
    setTimeout(done, 700);
  }, 1900);
}

/* ---- 場面転換 ----
   暗転 →（背景を差し替え・立ち絵を消去・キャプションを黒地に出す）→ 明転。
   背景のクロスフェード（0.7秒）だけだと、部屋を移ったのか季節が変わったのかが
   同じ速さで流れてしまい、時間の感覚が出ない。段階を分けて長さで語らせる。

   out  暗くなるまで
   hold 真っ暗のまま持つ長さ（キャプションを読ませる時間でもある）
   in   明るくなるまで                                        単位はミリ秒 */
const TRANS = {
  scene:{out: 520, hold: 220, in: 620},   // 同じ日のうちに場所が変わる      計 1.4秒
  time :{out: 800, hold: 650, in: 850},   // 同じ日で時間が飛ぶ（放課後・夜） 計 2.3秒
  day  :{out:1100, hold:1200, in:1100},   // 日付が変わる                    計 3.4秒
  chap :{out:1400, hold:2400, in:1300}    // 季節・章が変わる                計 5.1秒
};
let transSkip = null;      // 転換中だけ入る。クリックで飛ばすために使う

function clearCharsNow(){ $('#chars').innerHTML=''; shownChars={}; }

function runTrans(T, bgKey, cap, done){
  const fl = $('#flash'), ch = $('#chapter');
  let timers = [];
  const at = (ms, fn)=>{ timers.push(setTimeout(fn, ms)); };
  const apply = ()=>{
    if(bgKey) setBg(bgKey, true);
    clearCharsNow();                       // 転換なので立ち絵は畳む。黒幕の裏なので瞬時でよい
    if(cap) st.chapter = cap;
  };
  const finish = (ms)=>{
    ch.style.transitionDuration = Math.min(ms, 500)+'ms';
    ch.classList.remove('on');
    fl.style.transitionDuration = ms+'ms';
    fl.classList.remove('on');
    at(ms, ()=>{
      transSkip = null; ch.style.transitionDuration='';
      // 先に本文を差し替えてから窓を戻す。順を逆にすると前の行が一瞬見える
      done();
      $('#stage').classList.remove('intrans');
    });
  };
  // 待たされるのを嫌う人のために、クリックで残りを畳めるようにしておく
  transSkip = ()=>{ timers.forEach(clearTimeout); timers=[]; apply(); finish(220); };

  $('#stage').classList.add('intrans');
  fl.style.transitionDuration = T.out+'ms';
  fl.classList.add('on');
  at(T.out, ()=>{
    apply();
    if(cap){ ch.style.transitionDuration='600ms'; ch.firstElementChild.textContent = cap; ch.classList.add('on'); }
    at(T.hold, ()=> finish(T.in));
  });
}
// 転換の途中でタイトルへ戻る・ロードするときの後始末
function cancelTrans(){
  transSkip = null;
  const fl = $('#flash'), ch = $('#chapter');
  fl.style.transitionDuration=''; fl.classList.remove('on');
  ch.style.transitionDuration=''; ch.classList.remove('on');
  $('#stage').classList.remove('intrans');
}

/* ---- 本文 ---- */
function showText(cmd){
  const who = cmd.n ? nameOf(cmd.n) : '';
  const body = nameOf(cmd.t);
  st.mark = st.idx - 1;          // 復帰位置＝この行の先頭
  autoSave();
  $('#namebox').textContent = who;
  focusChar(who);
  backlog.push({who, text:body});
  if(backlog.length>200) backlog.shift();
  GLOBAL.seen[st.label+':'+(st.idx-1)] = 1;
  const el = $('#text');
  fullText = body; typing = true;
  $('#next').classList.remove('on');
  clearInterval(typeTimer);
  const speed = skipMode ? 0 : CFG.speed;
  if(speed<=0){ el.textContent = body; endTyping(); return; }
  let i=0; el.textContent='';
  typeTimer = setInterval(()=>{
    el.textContent = body.slice(0, ++i);
    if(i%3===0) Audio1.blip();
    if(i>=body.length){ endTyping(); }
  }, speed);
}
function endTyping(){
  clearInterval(typeTimer); typing=false;
  $('#text').textContent = fullText;
  $('#next').classList.add('on');
  if(skipMode){ autoTimer=setTimeout(()=>advance(), 24); }
  else if(autoMode){ autoTimer=setTimeout(()=>advance(), CFG.autowait + fullText.length*18); }
}

/* ---- 進行 ---- */
function cur(){ const sc=S[st.label]; return sc ? sc[st.idx] : null; }
function exec(c){
  if(c.bg){ setBg(c.bg, silent); return; }
  if(c.bgm!==undefined){ if(!silent) Audio1.play(c.bgm); st.bgm=c.bgm; return; }
  if(c.sp){ showChar(c.sp, c.pos, c.ex, c.zoom); return; }
  if(c.ex && c.e){ setExpr(c.ex, c.e); return; }
  if(c.zm){ setZoom(c.zm, c.z); return; }
  if(c.hide){ hideChar(c.hide); return; }
  if(c.clear){ clearChars(); return; }
  if(c.se){ if(!silent && !skipMode && Audio1[c.se]) Audio1[c.se](); return; }
  if(c.title!==undefined){
    st.chapter = c.title;
    if(silent || skipMode) return;
    waiting = true;
    showChapter(c.title, ()=>{ waiting=false; run(); });
    return 'stop';
  }
  if(c.trans){
    // 復元中とスキップ中は演出を飛ばし、結果だけ合わせる
    if(silent || skipMode){
      if(c.tbg) setBg(c.tbg, true);
      clearCharsNow();
      if(c.cap) st.chapter = c.cap;
      return;
    }
    waiting = true;
    runTrans(TRANS[c.trans] || TRANS.scene, c.tbg, c.cap, ()=>{ waiting=false; run(); });
    return 'stop';
  }
  if(c.fade!==undefined){
    $('#flash').classList.toggle('on', !!c.fade);
    if(silent || skipMode) return;
    waiting = true;
    setTimeout(()=>{ waiting=false; run(); }, 620);
    return 'stop';
  }
  if(c.wait){ if(silent || skipMode) return; waiting=true; setTimeout(()=>{ waiting=false; run(); }, c.wait); return 'stop'; }
  if(c.jump){ st.label=c.jump; st.idx=0; st.mark=0; autoSave(); return; }
  if(c.branch){ st.label=c.branch(st.v); st.idx=0; st.mark=0; autoSave(); return; }
  // 初対面なら紹介へ寄り道し、終わったら呼び出し元へ戻る
  if(c.meet){
    st.v.met = st.v.met || {};
    if(st.v.met[c.meet] || !S['intro_'+c.meet]) return;
    st.v.met[c.meet] = 1;
    st.ret = {label:st.label, idx:st.idx};
    st.label = 'intro_'+c.meet; st.idx=0; st.mark=0; autoSave(); return;
  }
  if(c.back){
    const r = st.ret || {label:'prologue', idx:0};
    st.ret = null; st.label=r.label; st.idx=r.idx; st.mark=r.idx; autoSave(); return;
  }
  if(c.ch){ showChoices(c.ch); return 'stop'; }
  if(c.end){ doEnding(c.end); return 'stop'; }
}
function run(){
  if(waiting) return;
  let guard=0;
  while(guard++<4000){
    const c = cur();
    if(!c){ console.warn('シーン終端に到達:', st.label); return; }
    if(c.t!==undefined){ st.idx++; showText(c); return; }
    st.idx++;
    if(exec(c)==='stop') return;
  }
}
function advance(){
  clearTimeout(autoTimer);
  // 転換の途中なら、待たせず残りを畳む
  if(transSkip){ transSkip(); return; }
  if(waiting || atEnd) return;
  if($('#choices').classList.contains('on')) return;
  if(document.querySelector('.modal.on')) return;
  if(typing){ endTyping(); return; }
  run();
}
function showChoices(list){
  const box = $('#choices'); box.innerHTML=''; box.classList.add('on');
  setSkip(false); setAuto(false); setUI(false);
  $('#ctrl').classList.remove('on');
  list.forEach((o,i)=>{
    const b=document.createElement('button');
    b.className='chbtn'+(GLOBAL.seen['ch:'+st.label+':'+i]?' seen':'');
    b.style.animationDelay=(i*.09)+'s';
    b.textContent = nameOf(o.s);
    b.onclick = (e)=>{
      // ボタンはこの直後にDOMから外れる。伝播を止めないと画面全体のクリック処理に
      // 「選択肢の外を押した」と誤判定され、次の1行が飛ぶ
      e.stopPropagation();
      Audio1.click();
      GLOBAL.seen['ch:'+st.label+':'+i]=1; saveGlobal();
      Object.entries(o.v||{}).forEach(([k,val])=>{
        st.v[k] = (typeof val==='number') ? (st.v[k]||0)+val : val;
      });
      backlog.push({who:'', text:'▶ '+nameOf(o.s)});
      box.classList.remove('on'); box.innerHTML='';
      $('#ctrl').classList.add('on');
      if(o.to){ st.label=o.to; st.idx=0; st.mark=0; }
      autoSave(); run();
    };
    box.appendChild(b);
  });
}
function doEnding(key){
  setUI(false); atEnd = true;
  setAuto(false); setSkip(false);
  GLOBAL.endings[key]=1; saveGlobal();
  const e = ENDINGS[key] || Object.values(ENDINGS)[0];
  $('#endroll h2').textContent = e.title;
  const got = Object.keys(ENDINGS).filter(k=>GLOBAL.endings[k]).length;
  $('#endroll p').textContent = 'THE END　—　COMPLETE '+got+' / '+Object.keys(ENDINGS).length;
  $('#endroll').classList.add('on');
  Audio1.play(GAME.endBgm);
  $('#msgwin').classList.remove('on'); $('#ctrl').classList.remove('on');
}

/* ---- セーブ / ロード ---- */
// 保存するのはラベル・位置・変数・名前・背景・BGM・戻り先だけ。画面の状態は保存しない。
function snapshot(){
  return {
    g:GAME.id,
    label:st.label, idx:(st.mark!==undefined?st.mark:st.idx), v:JSON.parse(JSON.stringify(st.v)),
    name:st.name, chapter:st.chapter, bg:st.bg, bgm:st.bgm, ret:st.ret||null,
    time:new Date().toLocaleString('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
  };
}
function autoSave(){ if(st && !atEnd) LS.set(K_SAVE+'auto', snapshot()); }

// このデータで実際に再開できるかを確かめる。
// キーの名前空間を切る前は旧作とセーブを共有してしまっていて、
// 知らないラベル（旧作の 'finale' など）を読み込むと本文が空のまま操作不能になった。
// シナリオを書き換えてラベルが消えたときにも同じことが起きるので、常に通す。
function validSave(d){
  if(!d || typeof d !== 'object') return false;
  if(d.g && d.g !== GAME.id) return false;           // 別の作品のデータ
  const sc = S[d.label];
  if(!sc) return false;                              // 知らないシーン
  if(!(typeof d.idx === 'number' && d.idx >= 0 && d.idx <= sc.length)) return false;
  if(!d.v || typeof d.v !== 'object') return false;
  if(d.ret && !S[d.ret.label]) return false;         // 戻り先が消えている
  return true;
}
// 壊れている枠は「無い」ものとして扱う。消しはしない（誤判定で失うほうが痛い）
function readSave(k){
  const d = LS.get(K_SAVE+k);
  if(!d) return null;
  if(validSave(d)) return d;
  console.warn('読み込めないセーブを無視しました:', K_SAVE+k, d && d.label);
  return null;
}

// 名前空間を切る前のキーから、この作品のものだけを引き継ぐ。一度だけ動く。
// 旧作とはラベルまで衝突しうる（両方 'prologue' がある）ので、
// 変数の形で見分ける。この作品の v は必ず bond と mode を持っている。
function migrateOldSaves(){
  if(LS.get(K_PREFIX+'migrated')) return;
  LS.set(K_PREFIX+'migrated', 1);
  const mine = d => d && d.v && ('bond' in d.v) && ('mode' in d.v) && validSave(d);
  let n = 0;
  ['auto',1,2,3,4,5,6].forEach(k=>{
    if(LS.get(K_SAVE+k)) return;                     // すでにこちらにあるなら触らない
    const d = LS.get(K_OLD+'save.'+k);
    if(mine(d)){ d.g = GAME.id; LS.set(K_SAVE+k, d); n++; }
  });
  // エンディング記録は、この作品のキーだけを拾えば取り違えようがない
  const og = LS.get(K_OLD+'global');
  if(og && og.endings){
    const got = {};
    Object.keys(ENDINGS).forEach(e=>{ if(og.endings[e]) got[e] = 1; });
    if(Object.keys(got).length){
      GLOBAL.endings = Object.assign(got, GLOBAL.endings); saveGlobal();
    }
  }
  if(n) console.info(`旧キーから ${n} 件のセーブを引き継ぎました。`);
  // 旧キー自体は消さない。旧作をまだ遊ぶかもしれないので、こちらから触らない。
}
function loadFrom(d){
  // 一覧は readSave() で濾してあるが、直接呼ばれることもあるのでここでも見る。
  // 知らないラベルで読み込むと、本文が空のまま進めなくなる。
  if(!validSave(d)){
    console.warn('このセーブは読み込めません:', d && d.label);
    alert('このセーブデータは、いまの作品では読み込めません。');
    return;
  }
  $('#title').classList.add('off');
  $('#nameask').classList.remove('on');
  $('#endroll').classList.remove('on');
  cancelTrans();
  setUI(false);
  atEnd=false; waiting=false; backlog=[]; shownChars={};
  $('#chars').innerHTML='';
  st = {label:d.label, idx:0, mark:d.idx, v:d.v, name:d.name, chapter:d.chapter||'', bg:d.bg||'black', bgm:d.bgm||null, ret:d.ret||null};
  setBg(st.bg, true);
  // 直前までのシーンを無音で再生（テキスト以外のみ）
  silent = true;
  const sc = S[st.label]||[];
  for(let i=0;i<Math.min(d.idx, sc.length);i++){
    const c = sc[i];
    if(c.t===undefined) exec(c);
  }
  silent = false;
  Audio1.play(st.bgm);
  st.idx = d.idx;
  $('#msgwin').classList.add('on'); $('#ctrl').classList.add('on');
  run();
}
function hasAnySave(){
  if(readSave('auto')) return true;
  for(let i=1;i<=6;i++) if(readSave(i)) return true;
  return false;
}
function openSlots(mode){
  const box=$('#slots'); box.innerHTML='';
  $('#savetitle').textContent = mode==='save'?'SAVE':'LOAD';
  const keys = ['auto',1,2,3,4,5,6];
  keys.forEach(k=>{
    const d = readSave(k);
    const el=document.createElement('div');
    el.className='slot'+(d?'':' empty');
    el.innerHTML = `<div class="sn">${k==='auto'?'AUTO SAVE':'SLOT '+k}</div>
      <div class="sc">${d? (d.chapter||'―') : '― 空き ―'}</div>
      <div class="sd">${d? d.time+'　/　'+d.name : ''}</div>`;
    el.onclick = ()=>{
      Audio1.click();
      if(mode==='save'){
        if(k==='auto') return;
        if(!st || atEnd) return;
        if(d && !confirm('SLOT '+k+' に上書きしますか？')) return;
        LS.set(K_SAVE+k, snapshot()); openSlots('save');
      }else{
        if(!d) return;
        closeModals(); loadFrom(d);
      }
    };
    box.appendChild(el);
  });
  $('#m-save').classList.add('on');
}
function openLog(){
  const b=$('#logbody'); b.innerHTML='';
  backlog.slice().reverse().forEach(r=>{
    const d=document.createElement('div'); d.className='logrow';
    d.innerHTML = (r.who?`<span class="logwho">${r.who}</span>`:'') + r.text.replace(/</g,'&lt;');
    b.appendChild(d);
  });
  $('#m-log').classList.add('on');
}
function openCfg(){
  const rows=[
    ['文字表示速度','speed',0,80,1,v=>v==0?'瞬間':v+'ms',true],
    ['オート待ち時間','autowait',300,4000,100,v=>(v/1000).toFixed(1)+'秒'],
    ['BGM音量','bgm',0,1,.02,v=>Math.round(v*100)+'%'],
    ['効果音音量','se',0,1,.02,v=>Math.round(v*100)+'%']
  ];
  const b=$('#cfgbody'); b.innerHTML='';
  rows.forEach(([label,key,min,max,step,fmt,rev])=>{
    const row=document.createElement('div'); row.className='cfgrow';
    row.innerHTML=`<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${CFG[key]}"><span class="cfgval">${fmt(CFG[key])}</span>`;
    const inp=row.querySelector('input'), val=row.querySelector('.cfgval');
    if(rev) inp.style.direction='rtl';
    inp.oninput=()=>{
      CFG[key]=parseFloat(inp.value); val.textContent=fmt(CFG[key]); saveCfg();
      if(key==='bgm') Audio1.vol(CFG.bgm);
      if(key==='se'){ Audio1.sevol(CFG.se); Audio1.blip(); }
    };
    b.appendChild(row);
  });
  const row=document.createElement('div'); row.className='cfgrow';
  row.innerHTML=`<label>未読もスキップ</label><button class="btn" id="skipunread">${CFG.skipUnread?'ON':'OFF'}</button><span style="flex:1"></span>`;
  b.appendChild(row);
  row.querySelector('#skipunread').onclick=(e)=>{ CFG.skipUnread=!CFG.skipUnread; e.target.textContent=CFG.skipUnread?'ON':'OFF'; saveCfg(); };
  const keys=document.createElement('div'); keys.className='cfgrow';
  keys.innerHTML=`<label>操作</label><span style="flex:1;font-size:13px;line-height:2;opacity:.8">`+
    `右クリック / H … メッセージ窓を消して立ち絵だけ表示<br>`+
    `Ctrl 押しっぱなし … スキップ　／　A … オート　／　L・↑ … バックログ<br>`+
    `Space・Enter・クリック … 読み進める</span>`;
  b.appendChild(keys);
  const row2=document.createElement('div'); row2.className='cfgrow';
  row2.innerHTML=`<label>既読・セーブの消去</label><button class="btn" id="wipe">すべて消去</button><span style="flex:1"></span>`;
  b.appendChild(row2);
  row2.querySelector('#wipe').onclick=()=>{
    if(!confirm('セーブデータ・既読・エンディング記録をすべて消去します。よろしいですか？')) return;
    ['auto',1,2,3,4,5,6].forEach(k=>LS.del(K_SAVE+k));
    GLOBAL={seen:{},endings:{}}; saveGlobal();
    alert('消去しました。'); refreshTitle();
  };
  $('#m-cfg').classList.add('on');
}
function openEndings(){
  const g=$('#endgrid'); g.innerHTML='';
  const keys=Object.keys(ENDINGS);
  const got=keys.filter(k=>GLOBAL.endings[k]).length;
  $('#comp').textContent=`COMPLETE ${got} / ${keys.length}　（${Math.round(got/keys.length*100)}%）`;
  keys.forEach(k=>{
    const e=ENDINGS[k], on=!!GLOBAL.endings[k];
    const d=document.createElement('div'); d.className='endcard'+(on?'':' lock');
    d.innerHTML=`<h4>${on?e.title:'？？？？？'}</h4><p>${on?e.desc:'まだ辿り着いていないエンディングです。'}</p>`;
    g.appendChild(d);
  });
  $('#m-end').classList.add('on');
}
function closeModals(){ document.querySelectorAll('.modal').forEach(m=>m.classList.remove('on')); }

/* ---- モード ---- */
function setAuto(on){
  autoMode=on; document.querySelector('[data-a="auto"]').classList.toggle('active',on);
  if(on){ setSkip(false); if(!typing) advance(); } else clearTimeout(autoTimer);
}
function setSkip(on){
  skipMode=on; document.querySelector('[data-a="skip"]').classList.toggle('active',on);
  if(on){ autoMode=false; document.querySelector('[data-a="auto"]').classList.remove('active'); advance(); }
  else clearTimeout(autoTimer);
}
// 立ち絵鑑賞モード。ゲーム中だけ有効
function setUI(hidden){
  if(!st || atEnd) hidden = false;
  if(hidden === uiHidden) return;
  uiHidden = hidden;
  $('#stage').classList.toggle('hideui', hidden);
  clearTimeout(hintTimer);
  $('#uihint').classList.toggle('on', hidden);
  if(hidden) hintTimer = setTimeout(()=>$('#uihint').classList.remove('on'), 2600);
}

/* ---- タイトル ---- */
function refreshTitle(){
  $('#t-cont').disabled = !hasAnySave();
  $('#titlebg').style.backgroundImage = `url("${BG_DIR}${BG.title.f}")`;
  const im = $('#titlechr');
  if(!im.src){
    im.onload = ()=> im.classList.add('on');
    im.src = chrSrc(GAME.titleChar, GAME.titleExpr);
  }else im.classList.add('on');
}
function backToTitle(){
  if(st && !atEnd && !confirm('タイトルへ戻ります。（オートセーブは残ります）')) return;
  clearTimeout(autoTimer); clearInterval(typeTimer);
  setAuto(false); setSkip(false); setUI(false); closeModals();
  $('#endroll').classList.remove('on');
  cancelTrans();
  $('#msgwin').classList.remove('on'); $('#ctrl').classList.remove('on');
  $('#chars').innerHTML=''; shownChars={}; st=null; atEnd=false; waiting=false;
  $('#title').classList.remove('off');
  refreshTitle();
  Audio1.play(GAME.titleBgm);
}
function startNew(name){
  $('#nameask').classList.remove('on');
  $('#title').classList.add('off');
  $('#endroll').classList.remove('on');
  cancelTrans();
  setUI(false);
  atEnd=false; waiting=false; backlog=[]; shownChars={}; $('#chars').innerHTML='';
  st = {label:'prologue', idx:0, mark:0, v:{bond:0, maki:0, mode:'', met:{}}, name:name||'湊', chapter:'', bg:'black', bgm:null, ret:null};
  setBg('black', true);
  $('#msgwin').classList.add('on'); $('#ctrl').classList.add('on');
  autoSave(); run();
}
