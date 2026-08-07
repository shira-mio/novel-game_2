/* =========================================================
   BGM（音源ファイル）と SE（合成音）
   ========================================================= */
const Audio1 = (()=>{
  let ac=null, master=null, bgmBus=null, seGain=null;
  let cur=null;        // いま鳴っている段 {key, el, t, g, node}
  let nextLoop=null;   // ループ用に先読みしてある段
  let ticker=null;
  const decks = new Set();
  const FADE = 1.6;    // 曲を切り替えるときのクロスフェード秒
  const STEP = 40;     // 音量を更新する間隔(ms)

  // file:// では createMediaElementSource() を通すとグラフが無音化されるため、
  // BGMは <audio> の volume で直接鳴らす。http(s) では Web Audio を通す
  // （iOS Safari は element.volume が効かないため）。
  const VIA_WEBAUDIO = location.protocol !== 'file:';

  function init(){
    if(ac) return;
    try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    master = ac.createGain(); master.gain.value = 1; master.connect(ac.destination);
    bgmBus = ac.createGain(); bgmBus.gain.value = 1; bgmBus.connect(master);
    seGain = ac.createGain(); seGain.gain.value = CFG.se; seGain.connect(master);
  }
  const clamp = v => Math.max(0, Math.min(1, v));
  // 予約してあるランプを捨てて、いまの論理ゲインに即座に合わせる
  function applyVol(d){
    const v = clamp(d.g * CFG.bgm);
    if(d.node){
      if(ac) try{ d.node.gain.cancelScheduledValues(ac.currentTime); }catch(e){}
      d.node.gain.value = v;
    }
    else { try{ d.el.volume = v; }catch(e){} }
  }
  function deck(key, at){
    const t = BGM_TRACKS[key];
    const el = new Audio(BGM_DIR + t.f);
    el.preload = 'auto';
    const d = {key, el, t, g:0, node:null, rd:0, want:false};
    el.addEventListener('error', ()=>console.warn('BGMを読み込めません:', el.src, el.error && el.error.code));
    if(VIA_WEBAUDIO && ac){
      try{
        d.node = ac.createGain(); d.node.gain.value = 0;
        ac.createMediaElementSource(el).connect(d.node);
        d.node.connect(bgmBus);
      }catch(e){ d.node = null; }
    }
    applyVol(d);
    const seek = ()=>{ try{ el.currentTime = at||0; }catch(e){} };
    if(el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, {once:true});
    // ループの繋ぎは setInterval で見張っているが、タブが背面にあるとブラウザが
    // タイマーを毎分1回まで絞る。すると数秒しかない繋ぎの窓を跨げず、曲は終端まで
    // 走って止まり、二度と鳴らなくなる。メディア要素のイベントは絞られないので、
    // そちらからも見張って、行き過ぎたら頭出しし直す。
    el.addEventListener('timeupdate', ()=>{ if(d === cur) loopCheck(); });
    el.addEventListener('ended', ()=>{ if(d === cur && d.want) relight(d); });
    decks.add(d);
    return d;
  }
  // 終端まで行ってしまった段を、ループ開始位置へ戻して鳴らし直す。
  // クロスフェードは間に合わないので繋ぎ目は聞こえるが、無音よりはるかによい。
  function relight(d){
    if(nextLoop){ kill(nextLoop); nextLoop = null; }
    try{ d.el.currentTime = d.t.a; }catch(e){}
    d.el.play().catch(()=>{});
  }
  function ramp(d, to, sec){
    if(!d) return;
    if(d.node && ac){
      // Web Audio の予約はサンプル単位で進むので、タブが背面でタイマーが
      // 絞られてもクロスフェードが崩れない。論理ゲインは即座に目標値にして、
      // tick では触らないようにする（d.rd = 0）。
      const t0 = ac.currentTime, v = clamp(to * CFG.bgm);
      try{
        d.node.gain.cancelScheduledValues(t0);
        d.node.gain.setValueAtTime(d.node.gain.value, t0);
        d.node.gain.linearRampToValueAtTime(v, t0 + Math.max(0.01, sec));
      }catch(e){ d.node.gain.value = v; }
      d.g = to; d.rd = 0;
      start();                       // dieAt の始末とループ判定のために回しておく
      return;
    }
    // <audio> の volume は時間で刻むしかない。tick が遅れても
    // k が 1 に張り付いて目標値に着くので、絞られたときは繋ぎが硬くなるだけ。
    // ただし刻む必要がないほど短い指定（ループを late で切り替えるとき等）は、
    // tick を待たずにその場で当てる。待つと無音のまま次の tick まで放置される。
    if(sec <= 0.1){ d.g = to; d.rd = 0; applyVol(d); start(); return; }
    d.rf = d.g; d.rt = to; d.rs = performance.now(); d.rd = Math.max(1, sec*1000);
    start();
  }
  function kill(d){
    if(!d) return;
    decks.delete(d);
    try{ d.el.pause(); d.el.removeAttribute('src'); d.el.load(); }catch(e){}
    if(d.node) try{ d.node.disconnect(); }catch(e){}
  }
  function drop(d, sec){
    if(!d) return;
    ramp(d, 0, sec);
    d.dieAt = performance.now() + sec*1000 + 120;
  }
  function start(){ if(!ticker) ticker = setInterval(tick, STEP); }

  // 鳴らす気があるのに止まっている段を、鳴らし直す。
  // 自動再生を拒否されたあと、スリープ復帰、背面から戻ったとき——の3つに効く。
  let lastNudge = 0;
  function nudge(){
    const now = performance.now();
    if(now - lastNudge < 900) return;     // 拒否され続ける環境で play() を連打しない
    lastNudge = now;
    if(ac && ac.state === 'suspended') ac.resume();
    decks.forEach(d=>{
      if(!d.want) return;
      if(d === cur && d.el.ended) relight(d);
      else if(d.el.paused) d.el.play().catch(()=>{});
    });
  }
  // 外から戻ってきたときは、間隔をあけずに試し、ticker も張り直す
  // （死んだ id を掴んだままだと start() が素通りして二度と回らない）。
  function wake(){
    lastNudge = 0; nudge();
    if(decks.size){ if(ticker){ clearInterval(ticker); ticker = null; } start(); }
  }
  ['pointerdown','keydown','touchstart'].forEach(ev =>
    document.addEventListener(ev, wake, true));
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) wake(); });

  // ループの継ぎ目を跨ぐ。終端の x 秒手前で、戻り先の x 秒手前から重ねて入れ替える。
  // tick からも timeupdate からも呼ばれる（タイマーが絞られたときの保険）。
  function loopCheck(){
    if(!(cur && cur.el && !cur.el.paused)) return;
    const t = cur.t, at = cur.el.currentTime;
    if(at >= t.b - t.x - 4 && !nextLoop) nextLoop = deck(cur.key, Math.max(0, t.a - t.x));
    if(at >= t.b - t.x && nextLoop){
      // 絞られて窓を大きく行き過ぎた場合、予定どおり重ねると
      // 戻り先の頭が 3 秒かけて立ち上がるぶん音が痩せる。潔く切り替える。
      const late = at > t.b - t.x + 1;
      const nx = nextLoop; nextLoop = null;
      nx.want = true; nx.el.play().catch(()=>{});
      if(late) try{ nx.el.currentTime = t.a; }catch(e){}
      ramp(nx, t.v, late ? 0.05 : t.x);
      drop(cur, late ? 0.05 : t.x);
      cur = nx;
    }
  }

  function tick(){
    const now = performance.now();
    decks.forEach(d=>{
      if(d.rd){
        const k = Math.min(1, (now - d.rs) / d.rd);
        d.g = d.rf + (d.rt - d.rf) * k;
        if(k >= 1) d.rd = 0;
        applyVol(d);
      }
      if(d.dieAt && now >= d.dieAt) kill(d);
    });
    loopCheck();
    // スリープ復帰などで、鳴らす気のある段だけが止まっていることがある
    if(cur && cur.want && cur.el.paused) nudge();
    if(!decks.size){ clearInterval(ticker); ticker = null; }
  }
  return {
    play(key){
      init();
      if(ac && ac.state === 'suspended') ac.resume();
      if(key && !BGM_TRACKS[key]) key = null;
      // 同じ曲を頼まれたら普通は何もしない。ただし自動再生を拒否されて
      // 止まったままのことがあるので、そのときは鳴らし直す。
      if(cur && cur.key === key){ if(cur.el.paused) nudge(); return; }
      if(nextLoop){ drop(nextLoop, 0.05); nextLoop = null; }
      if(!key){ drop(cur, FADE); cur = null; return; }
      const prev = cur;
      cur = deck(key, 0);
      cur.want = true; cur.el.play().catch(()=>{});
      ramp(cur, cur.t.v, FADE);
      drop(prev, FADE);
      start();
    },
    stop(){ drop(cur, .8); if(nextLoop) drop(nextLoop, .05); cur=null; nextLoop=null; },
    vol(){ decks.forEach(applyVol); },
    sevol(v){ if(seGain) seGain.gain.value = v; },
    // 動作確認用。再生位置とループの先読み状況、実際の出力音量を覗く
    state(){
      const d = x => x && {key:x.key, t:+x.el.currentTime.toFixed(2), paused:x.el.paused,
                           ready:x.el.readyState, err:x.el.error&&x.el.error.code,
                           g:+x.g.toFixed(3), out:+(x.node? x.node.gain.value : x.el.volume).toFixed(3)};
      return {webaudio:VIA_WEBAUDIO, ctx: ac && ac.state, decks: decks.size, cur: d(cur), next: d(nextLoop)};
    },
    seek(sec){ if(cur) try{ cur.el.currentTime = sec; }catch(e){} },
    // 「鳴らそうとしている」だけでなく「実際に音が出ているか」を返す。
    // 自動再生を拒否されたかどうかは、これでしか分からない。
    //   ・要素が paused なら論外
    //   ・Web Audio 経由のときは AudioContext が suspended だと出力はゼロ
    //   ・上の2つを抜けても、再生位置が進んでいなければ鳴っていない
    // 再生位置の前進は1回では見られないので、呼び出し側で2回比べる。
    audible(){
      if(!cur || !cur.el || cur.el.paused) return {ok:false, why:'paused', t:0};
      if(cur.node && ac && ac.state !== 'running') return {ok:false, why:'ctx:'+ac.state, t:cur.el.currentTime};
      return {ok:true, why:'', t:cur.el.currentTime};
    },
    // --- SE は合成音（メディア要素を通さないので file:// でも鳴る） ---
    blip(){
      init(); if(!ac||CFG.se<=0) return;
      const t=ac.currentTime, o=ac.createOscillator(), g=ac.createGain(), f=ac.createBiquadFilter();
      o.type='square'; o.frequency.value = 1450;
      f.type='lowpass'; f.frequency.value=2600;
      g.gain.setValueAtTime(.03,t); g.gain.exponentialRampToValueAtTime(.0001,t+.045);
      o.connect(f); f.connect(g); g.connect(seGain); o.start(t); o.stop(t+.06);
    },
    click(){
      init(); if(!ac||CFG.se<=0) return;
      const t=ac.currentTime, o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.setValueAtTime(880,t); o.frequency.exponentialRampToValueAtTime(440,t+.12);
      g.gain.setValueAtTime(.12,t); g.gain.exponentialRampToValueAtTime(.0001,t+.2);
      o.connect(g); g.connect(seGain); o.start(t); o.stop(t+.22);
    },
    // シャッター音。主人公が写真部なので何度も鳴る
    shutter(){
      init(); if(!ac||CFG.se<=0) return;
      const t=ac.currentTime;
      const buf = ac.createBuffer(1, ac.sampleRate*0.09, ac.sampleRate);
      const dat = buf.getChannelData(0);
      for(let i=0;i<dat.length;i++){
        const k = i/dat.length;
        dat[i] = (Math.random()*2-1) * Math.exp(-k*26) * (k<0.35?1:0.45);
      }
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2200; f.Q.value=0.9;
      const g = ac.createGain(); g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(seGain); src.start(t);
    }
  };
})();
