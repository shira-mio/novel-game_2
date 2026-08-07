/* =========================================================
   設定と既読の保存。localStorage が使えない環境でも落ちないようにしてある。
   ========================================================= */
const $ = s => document.querySelector(s);

const LS = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
// キーは作品IDで名前空間を切る。同じ雛形から作った別の作品と同じブラウザで
// 遊ぶと、切っていないとセーブが混ざる（旧作「まだ名前のない星の話」と衝突した）。
const K_PREFIX = 'nvg.' + GAME.id + '.';
const K_CFG = K_PREFIX+'cfg', K_GLOBAL = K_PREFIX+'global', K_SAVE = K_PREFIX+'save.';
const K_OLD = 'nvg2.';   // 名前空間を切る前に使っていたキー。引き継ぎのためだけに見る

// BGMは各曲を -20 LUFS 相当に揃えたうえで全体を一律に割ってあるので、
// 既定音量はやや高めでちょうどよい。
let CFG = Object.assign({speed:26, autowait:1400, bgm:.68, se:.3, skipUnread:false}, LS.get(K_CFG,{}));
let GLOBAL = Object.assign({seen:{}, endings:{}}, LS.get(K_GLOBAL,{}));
const saveCfg = ()=>LS.set(K_CFG,CFG);
const saveGlobal = ()=>LS.set(K_GLOBAL,GLOBAL);
