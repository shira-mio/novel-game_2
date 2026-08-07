/* =========================================================
   起動とイベント配線
   ========================================================= */
$('#stage').addEventListener('click', e=>{
  if(e.target.closest('#ctrl, #choices, .modal, #title, #nameask, #endroll, .btn')) return;
  if(!st) return;
  if(uiHidden){ setUI(false); return; }   // 鑑賞モード中の左クリックは復帰だけ
  if(skipMode){ setSkip(false); return; }
  advance();
});
// 右クリックでメッセージ窓とボタンを退けて立ち絵だけにする
$('#stage').addEventListener('contextmenu', e=>{
  if(e.target.closest('.modal, #title, #nameask, #endroll')) return;
  e.preventDefault();
  if(!st || atEnd) return;
  setUI(!uiHidden);
});
document.addEventListener('keydown', e=>{
  if($('#nameask').classList.contains('on')){
    if(e.key==='Enter') $('#namego').click();
    return;
  }
  if(e.key==='Escape'){
    if(document.querySelector('.modal.on')) closeModals();
    else setUI(false);
    return;
  }
  if(!st) return;
  if(e.key==='h'||e.key==='H'){ setUI(!uiHidden); return; }
  if(uiHidden){ setUI(false); return; }
  if(e.key===' '||e.key==='Enter'){ e.preventDefault(); advance(); }
  if(e.key==='Control'){ setSkip(true); }
  if(e.key==='a'||e.key==='A'){ setAuto(!autoMode); }
  if(e.key==='l'||e.key==='L'){ openLog(); }
  if(e.key==='ArrowUp'){ openLog(); }
});
document.addEventListener('keyup', e=>{ if(e.key==='Control') setSkip(false); });
document.querySelectorAll('#ctrl .btn').forEach(b=>{
  b.onclick=()=>{
    Audio1.click();
    const a=b.dataset.a;
    if(a==='auto') setAuto(!autoMode);
    if(a==='skip') setSkip(!skipMode);
    if(a==='log') openLog();
    if(a==='save') openSlots('save');
    if(a==='load') openSlots('load');
    if(a==='cfg') openCfg();
    if(a==='title') backToTitle();
  };
});
document.querySelectorAll('[data-close]').forEach(b=> b.onclick=()=>{ Audio1.click(); closeModals(); });
$('#t-new').onclick=()=>{ Audio1.click(); Audio1.play(GAME.titleBgm); $('#nameask').classList.add('on'); setTimeout(()=>$('#nameinput').select(),50); };
$('#namego').onclick=()=>{ Audio1.click(); startNew(($('#nameinput').value||'湊').trim().slice(0,8)); };
$('#t-cont').onclick=()=>{ Audio1.click(); Audio1.play(GAME.titleBgm); openSlots('load'); };
$('#t-end').onclick=()=>{ Audio1.click(); Audio1.play(GAME.titleBgm); openEndings(); };
$('#t-cfg').onclick=()=>{ Audio1.click(); Audio1.play(GAME.titleBgm); openCfg(); };
// atEnd のまま呼ぶ。手前で false にすると「戻りますか？」の確認が出てしまう
$('#endback').onclick=()=>{ Audio1.click(); backToTitle(); };

/* ---- 起動 ---- */
document.title = GAME.title;
Audio1.sevol(CFG.se);
migrateOldSaves();   // refreshTitle() より先。「つづきから」の可否がこれで決まる
preloadBg();
refreshTitle();

/* BGMの自動再生について

   ブラウザは「ユーザーがまだ一度も操作していないページ」に音を出させない。
   これは仕様であって、コードで回避する方法はない（あればどのサイトも
   勝手に音を出せてしまう）。muted で再生してあとから unmute する手も、
   操作なしの unmute はその場で停止させられるので通らない。

   できるのは次の2つだけ。

     1. とにかく鳴らしにいく。許可されている環境なら、そのまま鳴る
        （ブラウザの設定で許可済み、あるいは Chrome なら同じサイトで
         何度も再生していると自動再生が許される）
     2. 拒否されたときだけ、最初の一操作を受け取る画面を出す。
        そのクリックでBGMを鳴らしてタイトルへ送る

   1が通ったかどうかは「鳴らしたつもり」では分からない。play() が
   拒否されても例外は投げず、Promise が reject されるだけで、
   Web Audio 経由なら要素は再生されたまま出力だけがゼロになる。
   そこで Audio1.audible() で再生位置が実際に進んでいるかを測って決める。 */
Audio1.play(GAME.titleBgm);

function openGate(){
  const gate = $('#gate');
  if(!gate.classList.contains('on')) return;
  Audio1.click();                 // 合成音なのでメディア要素の制限を受けない
  Audio1.play(GAME.titleBgm);     // このクリックはユーザー操作なので通る
  gate.classList.add('off');
  setTimeout(()=>gate.classList.remove('on','off'), 700);
}
// 自動再生が通ったかを測って、駄目なときだけゲートを出す。
// 動作確認用に単体で呼べるようにしてある（下の README 参照）。
function checkAutoplay(){
  const gate = $('#gate'), first = Audio1.audible();
  setTimeout(()=>{
    const now = Audio1.audible();
    // 再生位置が進んでいれば本当に鳴っている。ゲートは出さずに終わる
    if(now.ok && now.t > first.t + 0.05) return;
    console.info('BGMの自動再生が拒否されました（' + (now.why || '再生位置が進まない') + '）。起動ゲートを出します。');
    gate.classList.remove('off');
    gate.classList.add('on');
  }, 500);
}
$('#gate').addEventListener('pointerdown', openGate);
document.addEventListener('keydown', e=>{ if($('#gate').classList.contains('on')) openGate(); });
checkAutoplay();
