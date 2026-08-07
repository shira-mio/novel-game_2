/* =========================================================
   素材の表。ここだけ見れば「何を使っているか」が分かるようにしてある。
   ========================================================= */

/* ---------- 背景 ---------- */
const BG_DIR = 'assets/bg/';
// 元画像は img/bg/*.png（ChatGPT 製と Gemini 製が混在）。
// tools/conv_bg.py が全部を 1904x1088（きっかり 7:4）の WebP に揃えて
// assets/bg/ へ書き出す。d は同スクリプトが平均輝度から出した暗幕の濃さ。
// 画面比が 7:4 と違っても CSS の cover が中央基準で切るので、破綻はしない。
// black は画像なしの単色で、暗転に使う。
const BG = {
  title    :{f:'title.webp',     d:0.00},  // タイトル用（旧校舎の外観・夕）
  old_out  :{f:'old_out.webp',   d:0.32},  // 旧校舎 外観（春・昼）
  old_hall :{f:'old_hall.webp',  d:0.14},  // 旧校舎 廊下（埃と斜光）
  old_lib  :{f:'old_lib.webp',   d:0.00},  // 旧校舎 図書室
  old_music:{f:'old_music.webp', d:0.00},  // 旧校舎 音楽室
  old_room :{f:'old_room.webp',  d:0.00},  // 旧校舎 空き教室（文化祭の会場にも使う）
  class    :{f:'class.webp',     d:0.34},  // 新校舎 教室（昼）― 白が強いので最大まで沈める
  class_eve:{f:'class_eve.webp', d:0.15},  // 新校舎 教室（夕）
  council  :{f:'council.webp',   d:0.05},  // 生徒会室（空き教室を間借りしている）
  court    :{f:'court.webp',     d:0.12},  // 中庭・渡り廊下
  gate     :{f:'gate.webp',      d:0.01},  // 校門から続く並木道（夕）
  snow     :{f:'snow.webp',      d:0.34},  // 冬の校庭
  sakura   :{f:'sakura.webp',    d:0.34},  // 春の校庭（エピローグ）
  black    :{f:null,             d:1.00}
};

/* ---------- 立ち絵 ---------- */
// dir は assets/chr/<dir>/ に対応。alias は名前欄と照合して話者を判定するために使う
// （話していない人物を暗くする）。呼び名の揺れは全部並べておくこと。
// 名前欄には主人公から見た呼び方を出す（親しさが見えるように）。
// alias には表記の揺れを全部入れておくこと。ここに無い名前で喋らせると
// 話者を特定できず、誰も暗くならない。
const CHARS = {
  shiori:{ name:'綾瀬',   dir:'001', alias:['綾瀬','綾瀬 詩織','詩織'] },        // 2年・図書委員
  hinata:{ name:'ひなた', dir:'002', alias:['ひなた','日野','日野 ひなた'] },   // 2年・新制服モニター
  maki  :{ name:'柊先輩', dir:'003', alias:['柊先輩','柊','柊 真希','真希','生徒会長'] }, // 3年・生徒会長
  kaede :{ name:'一ノ瀬', dir:'004', alias:['一ノ瀬','一ノ瀬 楓','楓'] }        // 2年・旧霧ヶ丘
};

// 素材は8表情。シナリオからは意味の分かる名前で呼び、ここで実ファイルに寄せる。
// 同じ絵に複数の名前を割り当ててよい（文脈で使い分けたいときのため）。
const EXPR = {
  normal  :'neutral',  think  :'neutral',  quiet :'neutral',
  soft    :'smile',    smile  :'smile',    tender:'smile',
  laugh   :'laugh',    bright :'laugh',
  angry   :'anger',    sulk   :'anger',    firm  :'anger',
  sad     :'sad',      cry    :'sad',      down  :'sad',
  surprise:'surprise', startled:'surprise',shock :'surprise',
  shy     :'shy',      blush  :'shy',
  trouble :'trouble',  worry  :'trouble',  awkward:'trouble'
};

const chrSrc = (id, ex) => `assets/chr/${CHARS[id].dir}/${EXPR[ex] || EXPR.normal}.webp`;

/* ---------- BGM ---------- */
const BGM_DIR = 'assets/bgm/';
// 音量はファイルを書き換えず再生ゲインで揃える（-20 LUFS 基準）。
// a/b はループ区間（秒）、x はループの繋ぎに使うクロスフェード秒数。
// この表は tools/make_bgm_table.py の出力を、最大ゲインが 1.0 になるよう
// 全体を一律に割ってから貼ったもの（element.volume が 1.0 で頭打ちになるため）。
const BGM_TRACKS = {
  kira      :{f:'kira.mp3',      v:0.4032, a:76.394,  b:165.001, x:3.0},  // 日常
  forest    :{f:'forest.mp3',    v:1.0000, a:4.458,   b:58.793,  x:3.0},  // 日常・穏やか
  swing     :{f:'swing.mp3',     v:0.3977, a:20.852,  b:125.202, x:3.0},  // 希望
  confession:{f:'Confession.mp3',v:0.6887, a:55.542,  b:110.388, x:3.0},  // 親密
  cloud     :{f:'cloud.mp3',     v:0.4222, a:108.391, b:236.008, x:3.0},  // タイトル・エピローグ
  decode    :{f:'decode.mp3',    v:0.4286, a:9.567,   b:129.567, x:3.0},  // 不安
  flutter   :{f:'Flutter.mp3',   v:0.7320, a:5.016,   b:101.007, x:3.0},  // 不可思議
  mystery   :{f:'mystery.mp3',   v:0.6194, a:43.979,  b:88.979,  x:3.0},  // 謎めいた
  dark      :{f:'dark.mp3',      v:0.4164, a:4.319,   b:96.223,  x:3.0},  // 重い思案
  pursuit   :{f:'pursuit.mp3',   v:0.2037, a:6.966,   b:48.112,  x:3.0},  // 危機
  decide    :{f:'decide.mp3',    v:0.3886, a:63.623,  b:194.305, x:3.0},  // 決意
  quiet     :{f:'quiet.mp3',     v:0.4310, a:12.028,  b:129.382, x:3.0},  // 打ち明け話
  memory    :{f:'memory.mp3',    v:0.7245, a:3.204,   b:106.580, x:2.9},  // 思い出
  longing   :{f:'longing.mp3',   v:0.9462, a:27.028,  b:130.171, x:3.0},  // 幼い日・オルゴール
  reflect   :{f:'Reflect.mp3',   v:0.1838, a:4.133,   b:297.773, x:3.0},  // 走り出す
  noir      :{f:'NOIR.mp3',      v:0.4023, a:4.923,   b:113.220, x:3.0}   // エピローグ
};

/* ---------- エンディング ---------- */
const ENDINGS = {
  omoide:{title:'エンディング 1 ／ 記録',
          desc:'校舎を、校舎として撮り切った。写真は正確で、誰の顔も写っていない。'},
  hitori:{title:'エンディング 2 ／ ひとりの三月',
          desc:'最後まで、ファインダー越しにしか見なかった。誰も責めなかったのが、いちばんこたえた。'},
  atarashii:{title:'エンディング 3 ／ あたらしい制服',
          desc:'残すのではなく、続けることを選んだ。柊真希と最後まで組んだ者だけが辿り着く結末。'},
  gunzou:{title:'エンディング 4 ／ 群像',
          desc:'四人ぶんの三月を撮った。校舎はなくなり、写真だけが残った。'}
};

/* ---------- 作品情報 ---------- */
const GAME = {
  // localStorage のキーに使う作品ID。**作品ごとに必ず変えること。**
  // 同じ雛形から作った別の作品を同じブラウザで遊ぶと、ここが同じなら
  // セーブも既読もエンディング記録も混ざる（実際に旧作と衝突した）。
  // file:// で開く場合はどの作品も同じオリジン扱いになるので、なおさら効く。
  id:'seifuku',
  title:'制服の残る場所',
  titleChar:'shiori',      // タイトル画面に立たせる立ち絵
  titleExpr:'quiet',
  titleBgm:'cloud',
  endBgm:'noir'
};
