/*
matrix
===================================
パート及びメインのスクリプトは以下の形式で記述される。

```
# コメント行
{ACTIVATION} 0.2,1.2,...  活性化係数 (optional)
{FORCED_ACTIVATION} 2.5,3.2, ... (optional)
{RETENTION} 0.7 ,... (optional)
{DEFALUT_AVATAR} xxx (optional)
{userTag} ,... (optional)
with {?tag} 指定したタグはユーザ発言には暗黙的に必ず付属するとみなす
user text\ttimestamp ユーザ入力
peace text\ttimestamp チャットボットの返答（avatar指定)
bot text\ttimestamp
cue tag
```
# で始まる行はコメント行で無視する。
大文字タグ {CAPITAL} で始まる行はシステムタグの定義
小文字タグ {userTag}で始まる行はチャットボットのメモリーに追加されるタグ
with で始まる行はユーザの発言には暗黙的にwithより後ろの内容が続くとみなす。

コーパス部分は以下の書式。
user text{ecoState}\t{timestamp}
{ecoState}は天候、場所などecosystemが提供する状態を示すタグ。
timestampを追加すると、特徴量として扱われる。timestampは
timestamp.toValue()で得られる値(msec)

会話ログは加工せず辞書化できるようにする。そのため
1. user行が連続したらbotのpromptを挟む
2. ユーザが無入力かつチャットボットが返答生成中でない期間があったら空行として記憶
3. エコシステム入力があったらブロックを分ける。

*/
import {
  zeros,
  ones,
  identity,
  divide,
  apply,
  concat,
  add,
  resize,
  subset,
  index,
  range,
  size,
  diag,
  multiply,
  dotMultiply,
  norm,
} from 'mathjs';

import { time2yearRad, time2dateRad, timeStr2dateRad, dateStr2yearRad } from '../../components/Ecosystem/dayCycle';

const RE_BLANK_LINE = /^\s*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_CUE = 4;

const RE_COND_TAG = /^\{(\?|!|\?!)([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const RE_LINE = /^([a-zA-Z0-9]+)\s+(.+)$/;
const RE_LINE_END = /[、。！？｡!?.,]$/;
const RE_DATETIME = /\s*\((?:(\d{1,2}\/\d{1,2}))? ?(?:(\d{1,2}:\d{1,2}))?\)$/;
const DELAY_RANGE = 4; // DelayEffectorでdelay効果が発現する最大行数

/**
 * inScriptから類似度行列を生成
 * @param {Array} inScript 入力スクリプト
 * @param {Object} params 計算条件
 * @param {Object} noder Noderオブジェクト
 * @return {Object} 計算結果
 */
export function matrixize(inScript, params, noder) {
  /*
  inScriptから類似度計算用の行列を生成する。
  inScriptの一行は{head,text,timestamp}で構成され、textは
  Noderによりnode列に変換される。nodeには以下のような種類がある。

  例                                         説明
  -----------------------------------------------------------
  {surface:"です",feat:"です"}               単純な形態素
  {surface:"お父さん",feat:"{0001}"}         トークン
  {surface:"お父さんは",feat:"{0001}\tは"}   トークン文節
  {surface:"{BOT_NAME}", feat:"{BOT_NAME}"   展開タグ
  {surface:"{ECO_RAIN}", feat:"{ECO_RAIN}"   環境タグ
  {surface:"{?tag}", feat:"{?tag}"}          条件タグ
  {surface:"{?!tag}", feat:"{?!tag}"}        条件タグ(否定)
  {surface:"{!tag}", feat:"{!tag}"}          条件タグ(否定)
  -----------------------------------------------------------

  inScriptには{ecoState}も含まれており、それらは通常の形態素と
  同様の重みで扱われる。

  ■条件タグ
  inScriptの中での{?tag}{!tag}という表記はそのタグが記憶されて
  いるかどうかを検査する意味で、条件タグと呼ぶ。?や!を伴わない
  {BOT_NAME}のようなタグも、{!BOT_NAME}のようにすることで
  その値が定義されているかどうかを検査できる。
  条件タグ以外はfeatの出現回数を正規化したもの行列化し、
  retrieve()内で内積をとって類似度とする。
  condのvectorはinスクリプトに書かれた条件タグを{?tag}は1、
   {?!tag}は-1という成分としてベクトル化し、正規化せずに
  返し、条件タグのベクトル長さはcondWeightで与える。
  inScriptにはタイムスタンプ情報も含まれており、それはユーザ入力
  のタイムスタンプとのcosθを類似度の一成分とする。
  タイムスタンプのベクトル長さはtsWeightで与える。

  similarity=(wordVector, tsWeight*cosθ, condWeight*condVector)

  ■params
  tailing

  larningFactor
  page0など、あとから学習したデータの重みづけ。originよりも学習
  データを優先する場合は1より大きい値、originを優先する場合は
  1より小さい値を設定する。
   */
  const { tailing, larningFactor, condWeight, timeWeight } = params;
  // console.log(params, tailing)
  let m;
  let i;
  const condVocab = {}; // 条件タグのvocab
  const wordVocab = {}; // 非条件タグのvocab
  const nodesBlocks = []; // node化したスクリプト
  /* ------------------------

         vocabの生成

  -------------------------*/
  for (const block of inScript) {
    const data = [];
    for (const line of block) {
      // line=[head,text,timestamp,doc]

      // textの標準化
      m = line[1].match(RE_LINE_END);
      if (!m) {
        line[1] += '。';
      }
      const nodes = noder.nodify(line[1]);
      data.push({ nodes: nodes, doc: line[3] });
      for (const node of nodes) {
        if (!node) {
          console.log(nodes, line[1])
        }
        m = node.feat.match(RE_COND_TAG);
        if (m) {
          condVocab[m[2]] = true;
        } else {
          wordVocab[node.feat] = true;
        }
      }
    }
    nodesBlocks.push(data);
  }

  const condVocabKeys = Object.keys(condVocab);
  const wordVocabKeys = Object.keys(wordVocab);

  // condVocab,wordVocabともに要素が2つ未満の場合
  // dot()計算が失敗するのでダミーを加える

  if (wordVocabKeys.length === 1) {
    wordVocabKeys.push('__dummy__');
  }
  if (condVocabKeys.length === 0) {
    condVocabKeys.push('__dummy0__', '__dummy1__');
  }
  if (condVocabKeys.length === 1) {
    condVocabKeys.push('__dummy0__');
  }


  let ic = 0;
  let iw = 0;
  for (const k of condVocabKeys) {
    condVocab[k] = ic++;
  }

  for (const k of wordVocabKeys) {
    wordVocab[k] = iw++;
  }

  /* --------------------------------------------------------------

    Word Vector: 各行内での単語の出現回数
    Cond Vector: 各行での各条件タグの「真」「偽」「非該当」状態

  ------------------------------------------------------------------  */

  let wv = zeros(1, wordVocabKeys.length); // 空の行列に縦積みできないのでzerosを仮置き
  let cv = zeros(1, condVocabKeys.length); // 空の行列に縦積みできないのでzerosを仮置き
  for (const block of nodesBlocks) {
    i = 0;
    let wvb = zeros(block.length, wordVocabKeys.length);
    const cvb = zeros(block.length, condVocabKeys.length);
    for (const data of block) {
      for (const node of data.nodes) {
        m = node.feat.match(RE_COND_TAG);
        if (m) {
          const pos = condVocab[m[2]];
          cvb.set([i, pos], m[1] === '?' ? 1 : -1);
        } else if (node.feat in wordVocab) {
          const pos = wordVocab[node.feat];
          wvb.set([i, pos], wvb.get([i, pos]) + data.doc === 'origin' ? 1.0 : larningFactor);
        }
      }
      i++;
    }
    if (block.length > 1) {
      const de = delayEffector(block.length, tailing);
      wvb = multiply(de, wvb);
    }
    wv = concat(wv, wvb, 0);
    cv = concat(cv, cvb, 0);
  }

  // 最上行の仮置きしたzerosを削除
  const wvSize = size(wv).toArray();
  const cvSize = size(cv).toArray();
  wv = subset(wv, index(range(1, wvSize[0]), range(0, wvSize[1])));
  cv = subset(cv, index(range(1, cvSize[0]), range(0, cvSize[1])));
  wvSize[0]--;
  cvSize[0]--;

  // 成分は非負で類似度計算の際、通常の単語はnorm=1に正規化した上で
  // 内積を計算して類似度とする。条件タグは
  // fv = concat([cond], [wv / norm(wv)])
  // つまり 長さを1に正規化。 tfの場合個数で割るが、
  // 長さを1に規格化するのであれば意味がないため省略

  // 条件タグ部分の行列。成分は+1,0,-1のいずれかで、
  // 類似度計算の際は正規化せずに内積を取り、それをcondWeight倍して
  // fvの内積に加える

  const invWv = apply(wv, 1, (x) => divide(1, norm(x) || 1));
  wv = multiply(diag(invWv), wv);

  /* -----------------------------------------------------

           タイムスタンプ行列(2列)の生成
     [date,time]を格納

  -------------------------------------------------------  */

  let timeMatrix = dotMultiply(ones(wvSize[0], 2), NaN);
  i = 0;
  for (const block of inScript) {
    for (const line of block) {
      const ts = line[2];
      if (Array.isArray(ts)) {
        timeMatrix = subset(timeMatrix, index(i, [0, 1]), [
          ts[0],
          ts[1],
        ]);
      } else {
        timeMatrix = subset(timeMatrix, index(i, [0, 1]), [
          time2yearRad(ts),
          time2dateRad(ts),
        ]);

      }
      i++;
    }
  }

  return {
    status: 'ok',
    wordVocabLength: wordVocabKeys.length,
    condVocabLength: condVocabKeys.length,
    wordVocab: wordVocab,
    condVocab: condVocab === 0 ? zeros(1, 1) : condVocab,
    wordMatrix: wv,
    condMatrix: cv,
    timeMatrix: timeMatrix,
    condWeight: condWeight,
    timeWeight: timeWeight,
    prevWv: zeros(1, wvSize[1]),
    prevCv: zeros(1, cvSize[1]),
    // delayEffect: delayEffector(2, tailing),
    tailing: tailing
  };
}

/**
 * 前処理済みスクリプトをin/outに分割
 * @param {Array} script proprocess()で処理したスクリプト
 * @return {Array} 分割済みスクリプト
 */
export function tee(script) {
  /* proprocessで処理されたスクリプトはブロックのリストになっている。
     一つのブロックはinput(cueまたはuser)、output(bot行)が交互に
     現れる。これらをブロックごとにinScript,outScriptに分割 */

  const inScript = [];
  const outScript = [];
  let inBlock = [];
  let outBlock = [];
  const errors = [];

  let i = 0;
  for (const block of script) {
    for (const line of block) {
      if (line[0] === 'user' || line[0] === 'cue') {
        inBlock.push(line);
      } else {
        outBlock.push(line);
      }
      i++;
    }
    if (inBlock.length !== outBlock.length) {
      errors.push(`${i}行目: 入力と出力の数が異なっています`);
    }
    if (inBlock.length === 0) {
      errors.push(`${i}行目: ブロックサイズが0です`);
    }
    inScript.push([...inBlock]);
    outScript.push(...outBlock);
    inBlock = [];
    outBlock = [];
  }

  return {
    inScript: inScript,
    outScript: outScript,
    status: errors.length === 0 ? 'ok' : 'error',
    errors: errors,
  };
}

/**
 * パートスクリプトの前処理
 * @param {Array} script パートスクリプト
 * @param {Array} validAvatars 有効なavatarのリスト
 * @param {String} defaultAvatar 「bot」で始まる行で使うavatar
 * @return {array} [前処理済みスクリプト,エラー]
 */
export function preprocess(script, validAvatars, defaultAvatar) {
  /* スクリプトはuploadされるときにタグ定義文が削除され、タグ定義は
     db.memoryに格納される。

     preprocessはは以下のフォーマットに従ったscriptを仮定する。
     [
      {
        text:"head text{ecoState}",
        timestamp: timestamp
      },...
     ]
     head: "bot", validAvatars, "user", "cue"のいずれか
     text: 台詞
     timstamp: 発言の行われた日付時刻(valueOf()形式)
     ecoState: 天候とロケーションの情報をコード化したもの
     textは必須でtimestamp,ecoStateはoptional


     scriptに対して以下の処理を行う。
     ・with行に書かれた内容は以降のline末尾にコピーされる。
     ・一つの話題をブロックと呼び、
       ブロックは空行、eco行で区切られる。
     ・userの連続した発言は間にbot {prompt}行を自動で追加する。
     ・botの連続した発言は\nで区切られた一つの行に統合する。
     ・botで始まる行は{DEFAULT_AVATAR}で定義されるavatarに読み替える
     ・validAvatarsにないvatarが指定されたらdefaultAvatarに読み替える
     ・blockにuser行もenv行も含まれない場合前のブロックの続きとみなす
     ・blockにbot行が含まれない場合{prompt}で補う
     ・block末尾のoutScriptに{DEACTIVATE}を追加する


     出力する中間スクリプトは以下のフォーマットに従う
     [
      [                         # block
        [head,text,timestamp],  # corpus
        ...
      ],
      ...
     ]
  */
  const newScript = [];
  let withLine = '';
  let prevKind = null;
  let block = [];
  let isCueOrUserExists = false;
  let isBotExists = false;
  const errors = [];

  const parseLine = (line) => {
    let head = '';
    let text = '';
    let ts = null;
    let date = null;
    let time = null;

    if ('head' in line) {
      head = line.head;
      text = line.text;
    } else if (line.text !== '') {
      const pos = line.text.indexOf(' ');
      head = line.text.slice(0, pos);
      text = line.text.slice(pos + 1);
    }

    if ('timestamp' in line) {
      if ('seconds' in line.timestamp) {
        ts = new Date(line.timestamp.seconds * 1000);
      } else {
        ts = line.timestamp;
      }
    } else {
      [text, ts] = text.split('\t', 2);
      ts = ts ? new Date(Number(ts)) : null;

      const m = text.match(RE_DATETIME);
      if (m) {
        if (m[1]) {
          time = timeStr2dateRad(m[1]);
        }
        if (m[2]) {
          date = dateStr2yearRad(m[2]);
        }
        text = text.replace(RE_DATETIME, '');
        ts = [date, time]
      }
    }

    return [head, text, ts, line.doc];
  };

  const isBlockStructureOk = (i) => {
    if (!isCueOrUserExists) {
      errors.push(`${i}行目: ブロックに cueまたはuser行が含まれていません`);
      return false;
    }
    if (!isBotExists) {
      errors.push(`${i}行目: ブロックに botの発言行が含まれていません`);
      return false;
    }
    if (prevKind !== KIND_BOT) {
      errors.push(`${i}行目: ブロック末尾がbotの発言行になっていません`);
      return false;
    }
    return true;
  };

  // headのbot指定
  const scriptAvatars = {
    bot: defaultAvatar,
    peace: 'peace',
  };

  for (const va of validAvatars) {
    scriptAvatars[va] = va;
  }

  for (let i = 0, l = script.length; i < l; i++) {
    const parsed = parseLine(script[i]);
    let [head, text, timestamp, doc] = parsed;
    // タグ業は飛ばす
    if (head.startsWith('{')) {
      continue;
    }

    // コメント行は飛ばす
    if (head.startsWith('#')) {
      continue;
    }
    // with文
    if (head === 'with') {
      withLine = text;
      continue;
    }
    // avatar文
    if (head === 'avatar') {
      scriptAvatars.bot = text;
      continue;
    }

    // 空行はブロックのはじめとみなす
    if (text.match(RE_BLANK_LINE)) {
      if (block.length !== 0 && isBlockStructureOk(i)) {
        // ブロック末尾のbot発言に{DEACTIVATE}を挿入
        const bl = block.length - 1;
        block[bl][1] += '{DEACTIVATE}';

        // ブロックをnewScriptに追加
        newScript.push([...block]);
        block = [];
        isBotExists = false;
        isCueOrUserExists = false;
        prevKind = null;

      }
      continue;
    }


    // cue行
    if (head === 'cue') {
      // cue行はブロックのはじめとみなす
      if (block.length !== 0 && isBlockStructureOk(i)) {
        // ブロック末尾のbot発言に{DEACTIVATE}を挿入
        const bl = block.length - 1;
        block[bl][1] += '{DEACTIVATE}';

        newScript.push([...block]);
        block = [];
        isBotExists = false;
        isCueOrUserExists = false;
      }
      block.push([head, text + withLine, timestamp, doc]);
      isCueOrUserExists = true;
      prevKind = KIND_CUE;
      continue;
    }

    // user行
    if (head === 'user') {
      if (prevKind === KIND_USER) {
        // user行が連続する場合は{prompt}を挟む
        block.push(['peace', `{prompt}${withLine}`, null, doc]);
      }
      block.push([head, text + withLine, timestamp, doc]);
      prevKind = KIND_USER;
      isCueOrUserExists = true;
      continue;
    }

    // bot行
    if (head in scriptAvatars) {
      parsed[0] = scriptAvatars[head];

      if (prevKind === KIND_BOT) {
        // bot行が連続したら一つにまとめる
        const bl = block.length - 1;
        block[bl][1] += `\n${text}`;
      } else {
        block.push([head, text, null, doc]);
      }
      isBotExists = true;
      prevKind = KIND_BOT;
      continue;
    }
    errors.push(`${i}行目:${head} ${text} ${timestamp}は正常ではありません`);
  }

  if (block.length !== 0) {
    newScript.push(block);
  }

  if (prevKind !== KIND_BOT) {
    // 最後はbot行で終わること
    errors.push(
      `最終行${script[script.length - 1]}がbotの発言になっていません`
    );
  }
  console.log(newScript)
  return {
    script: newScript,
    status: errors.length === 0 ? 'ok' : 'error',
    errors: errors,
  };
}

/**
 * パートスクリプトの前処理 ver2
 * @param {Array} script パートスクリプト
 * @param {Array} validAvatars 有効なavatarのリスト
 * @param {String} defaultAvatar 「bot」で始まる行で使うavatar
 * @return {array} [前処理済みスクリプト,エラー]
 */
export function preprocess2(script, validAvatars, defaultAvatar) {
  /*
  スクリプトはuploadされるときタグ定義文と分離され、scriptには
  origin,page0などのソースデータが格納される。
  preprocess2は以下のフォーマットに従ったscriptを仮定する。
  [
    {i: 行番号, line: 行の内容 }, ...
  ]
  
  lineの書式
  # コメント行
  head text(MM/DD hh:mm)
  head text(MM/DD)
  head text(hh:mm)

  headはvalidAvatarsのうちのいずれか、またはcue,bot,userのいずれか。
  textはセリフで中にタグを含んでも良い。

  scriptに対して以下の処理を行う。
  ・with行に書かれた内容は以降のline末尾にコピーされる。
  ・一つの話題をブロックと呼び、
    ブロックは空行、eco行で区切られる。
  ・userの連続した発言は間にbot {prompt}行を自動で追加する。
  ・botの連続した発言は\nで区切られた一つの行に統合する。
  ・botで始まる行は{DEFAULT_AVATAR}で定義されるavatarに読み替える
  ・validAvatarsにないvatarが指定されたらdefaultAvatarに読み替える
  ・blockにuser行もenv行も含まれない場合前のブロックの続きとみなす
  ・blockにbot行が含まれない場合{prompt}で補う
  ・block末尾のoutScriptに{DEACTIVATE}を追加する


  出力する中間スクリプトは以下のフォーマットに従う
  [
  [                         # block
    [head,text,timestamp],  # corpus
    ...
  ],
  ...
  ]
  */

  const newScript = [];
  let withLine = '';
  let prevKind = null;
  let block = [];
  let isCueOrUserExists = false;
  let isBotExists = false;
  let isStartsWithInput = false;
  const errors = [];

  const parseLine = (line) => {
    let head = '';
    let text = '';
    let time = null;
    let date = null;
    const m = line.match(RE_LINE);
    if (m) {
      head = m[1];
      text = m[2];
      const t = text.match(RE_DATETIME);
      if (t) {
        if (t[1]) {
          date = dateStr2yearRad(t[1])
        }
        if (t[2]) {
          time = timeStr2dateRad(t[2]);
        }
        text = text.replace(RE_DATETIME, '');
      }
    }
    return [head, text, [date, time]];

  };

  const isBlockStructureOk = (i) => {
    if (!isStartsWithInput) {
      errors.push(`${i}行目: ブロックがcueまたはuserで始まっていません`);
      return false;
    }
    if (!isCueOrUserExists) {
      errors.push(`${i}行目: ブロックに cueまたはuser行が含まれていません`);
      return false;
    }
    if (!isBotExists) {
      errors.push(`${i}行目: ブロックに botの発言行が含まれていません`);
      return false;
    }
    if (prevKind !== KIND_BOT) {
      errors.push(`${i}行目: ブロック末尾がbotの発言行になっていません`);
      return false;
    }
    return true;
  };

  // headのbot指定
  const scriptAvatars = {
    bot: defaultAvatar,
    peace: 'peace',
  };

  for (const va of validAvatars) {
    scriptAvatars[va] = va;
  }

  // console.log(script)
  for (const i in script) {
    const item = script[i];
    const parsed = parseLine(item.line);
    let [head, text, ts] = parsed;

    // タグ行は飛ばす
    if (head.startsWith('{')) {
      continue;
    }

    // コメント行は飛ばす
    if (head.startsWith('#')) {
      continue;
    }
    // with文
    if (head === 'with') {
      withLine = text;
      continue;
    }
    // avatar文
    if (head === 'avatar') {
      scriptAvatars.bot = text;
      continue;
    }

    // 空行はブロックのはじめとみなす
    if (text.match(RE_BLANK_LINE)) {
      if (block.length !== 0 && isBlockStructureOk(i)) {
        // ブロック末尾のbot発言に{DEACTIVATE}を挿入
        const bl = block.length - 1;
        block[bl][1] += '{DEACTIVATE}';

        // ブロックをnewScriptに追加
        newScript.push([...block]);
        block = [];
        isBotExists = false;
        isCueOrUserExists = false;
        isStartsWithInput = false;
        prevKind = null;

      }
      continue;
    }

    // cue行
    if (head === 'cue') {
      // cue行はブロックのはじめとみなす
      if (block.length !== 0 && isBlockStructureOk(i)) {
        // ブロック末尾のbot発言に{DEACTIVATE}を挿入
        const bl = block.length - 1;
        block[bl][1] += '{DEACTIVATE}';

        newScript.push([...block]);
        block = [];
        isBotExists = false;
        isCueOrUserExists = false;

      }
      block.push([head, text + withLine, ts, item.page]);
      isCueOrUserExists = true;
      isStartsWithInput = true;
      prevKind = KIND_CUE;
      continue;
    }

    // user行
    if (head === 'user') {
      if (block.length === 0) {
        isStartsWithInput = true;
      }
      if (prevKind === KIND_USER) {
        // user行が連続する場合は{prompt}を挟む
        block.push(['peace', `{prompt}${withLine}`, item.page]);
      }
      block.push([head, text + withLine, ts, item.page]);
      prevKind = KIND_USER;
      isCueOrUserExists = true;
      continue;
    }

    // bot行
    if (head in scriptAvatars) {
      parsed[0] = scriptAvatars[head];

      if (prevKind === KIND_BOT) {
        // bot行が連続したら一つにまとめる
        const bl = block.length - 1;
        block[bl][1] += `\n${text}`;
      } else {
        block.push([head, text, null, item.page]);
      }
      isBotExists = true;
      prevKind = KIND_BOT;
      continue;
    }
    errors.push(`${i}行目:${item.line}は正常ではありません`);
  }

  if (block.length !== 0) {
    newScript.push(block);
  }
  if (prevKind !== KIND_BOT) {
    // 最後はbot行で終わること
    errors.push(
      `最終行${script[script.length - 1]}がbotの発言になっていません`
    );
  }
  console.log(newScript)
  return {
    script: newScript,
    status: errors.length === 0 ? 'ok' : 'error',
    errors: errors,
  };
}

/**
 * ディレイ行列の生成
 * @param {Number} size 正方行列の幅・高さ
 * @param {Number} level したの行に影響を及ぼす強度
 * @return {math.matrix} ディレイ行列
 */
export function delayEffector(size, level) {
  /* 正方行列で、levelをlとしたとき
   
   [[1   0   0   0]
    [l   1   0   0]
    [l^2 l   1   0]
    [l^3 l^2 l   1]]

   のように幅と高さがsizeの単位行列に、対角成分のx行下が
   l^xである成分が加わった行列deを返す。
   任意の行列 M に対して de×M をすることで前の行の情報が
   次の行に影響を及ぼす、残響のような効果を与える
  
   */
  let m = identity(size, size);
  let x = identity(size, size);
  const z = zeros(1, size);
  let k = 1;
  for (let i = 1; i < size && size < DELAY_RANGE; i++) {
    k *= level;
    x = concat(z, x, 0); // xの上にzerosを重ね、
    x = resize(x, [size, size]); // xの最下行を削ることでひとつ下にシフト。
    x = multiply(x, k); // それをk倍して
    m = add(m, x); // もとのmに加える
  }
  return m;

}
