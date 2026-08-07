/* =========================================================
   シナリオを書くための命令。1シーン＝命令の配列で、S.<ラベル> に入れる。

     t('地の文')
     n('名前','「台詞」')          名前欄つきの台詞
     me('「台詞」')                主人公。%name% が入力名に置換される
     bg('old_lib')                 背景
     sp('shiori','C','soft')       立ち絵を出す（id, 位置 L/C/R, 表情, 寄り）
     fx('shiori','laugh')          表情だけ差し替え
     zm('shiori','close')          寄りだけ変える（wide / bust / close）
     hide('shiori') / clr()        個別に消す / 全部消す
     bgm('kira') / bgm(null)       BGM
     se('shutter')                 効果音
     wait(400)                     ミリ秒だけ待つ（スキップ中は無視）
     tr('day','class','四月')      場面転換（暗転→背景差し替え→明転、任意でキャプション）
     fade() / fadein()             暗転 / 明転（手動）
     title('一学期')               章タイトルを出す（暗転しない。ふつうは tr を使う）
     meet('shiori')                初対面なら intro_shiori へ寄り道して戻る
     back()                        寄り道から戻る
     ch([{s:'選択肢', v:{bond:1}, to:'ラベル'}])
     jump('ラベル')
     {branch:(v)=> ...}            変数を見て行き先を決める
     {end:'gunzou'}                ENDINGS のキー

   各シーンは必ず jump / ch / branch / end / back のいずれかで終わること。
   シーンの先頭では bg と sp を明示すること（セーブ復元がシーン先頭からの
   再生に依存しているため、前のシーンの状態に頼ると背景が消える）。

   寄り（第4引数 / zm）の使い分け。
     wide  … 既定。登場、状況説明、3人以上並ぶ場面
     bust  … ふつうに会話している場面。腰のあたりで切れる
     close … 打ち明ける・言い切る場面。顔が画面の4割を占める。
             横幅を食うので 1人か2人のときだけにすること
   sp() は毎回 wide に戻す（明示しなければ）。寄ったままにしたくなければ
   何もしなくてよく、寄せたい行の直前で zm() を入れて、終わったら戻す。

   場面転換 tr(段階, 背景, キャプション) の使い分け。
   背景を bg() で切り替えるだけだと 0.7 秒のクロスフェードで一律になり、
   部屋を移ったのか季節が変わったのかが同じ速さで流れて時間の感覚が出ない。
   大きく動くところは tr() にして、長さで語らせる。

     scene  1.4秒  同じ日のうちに場所が変わる
     time   2.3秒  同じ日で時間が飛ぶ（放課後・その夜）
     day    3.4秒  日付が変わる
     chap   5.1秒  季節・章が変わる。キャプションを添える

   tr() は暗転中に背景を差し替え、**立ち絵を全部消す**。残したいなら bg() を使う。
   歩きながら部屋が移るような連続した動きは bg() のクロスフェードのほうが合う。
   キャプションはセーブ一覧の見出し（st.chapter）にもなる。
   ========================================================= */
const t  = s => ({t:s});
const n  = (w,s) => ({n:w,t:s});
const me = s => ({n:'%name%',t:s});
const bg = k => ({bg:k});
const sp = (id,pos,ex,zoom) => ({sp:id,pos:pos||'C',ex:ex||'normal',zoom:zoom||'wide'});
const fx = (id,ex) => ({ex:id,e:ex});
const zm = (id,z) => ({zm:id,z:z||'wide'});
const hide = id => ({hide:id});
const clr = () => ({clear:true});
const bgm = m => ({bgm:m});
const se  = k => ({se:k});
const ch  = arr => ({ch:arr});
const jump = l => ({jump:l});
const title = s => ({title:s});
const meet = id => ({meet:id});
const back = () => ({back:1});
const wait = ms => ({wait:ms});
const tr = (level,bgKey,cap) => ({trans:level||'scene', tbg:bgKey||null, cap:cap||''});
const fade = () => ({fade:1});
const fadein = () => ({fade:0});

const S = {};
