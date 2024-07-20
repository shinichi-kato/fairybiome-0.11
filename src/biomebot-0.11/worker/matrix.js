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
eco tag
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
  subset,
  index,
  range,
  size,
  diag,
  multiply,
  dotMultiply,
  norm,
} from 'mathjs';

import {time2yearRad, time2dateRad} from '../../components/Ecosystem/dayCycle';

const RE_BLANK_LINE = /^\s*$/;
const KIND_USER = 1;
const KIND_BOT = 2;

const RE_COND_TAG = /^\{(\?|!|\?!)([a-zA-Z_][a-zA-Z0-9_]*)\}/;

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
  {tag}は条件タグとして扱わない。
  条件タグ以外はfeatの出現回数を正規化したもの行列化し、
  retrieve()内で内積をとって類似度とする。
  condのvectorはinスクリプトに書かれた条件タグを{?tag}は1、
   {?!tag}は-1という成分としてベクトル化し、正規化せずに
  返し、条件タグのベクトル長さはcondWeightで与える。
  inScriptにはタイムスタンプ情報も含まれており、それはユーザ入力
  のタイムスタンプとのcosθを類似度の一成分とする。
  タイムスタンプのベクトル長さはtsWeightで与える。

  similarity=(wordVector, tsWeight*cosθ, condWeight*condVector)

   */
  const {tailing, condWeight, timeWeight} = params;
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
      // line={head,text,timestamp}
      const nodes = noder.nodify(line[1]);
      data.push(nodes);
      for (const node of nodes) {
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

  // condVocab,wordVocabともに1つしか要素がない場合
  // dot()計算が失敗するのでダミーを加える

  if (wordVocabKeys.length === 1) {
    wordVocabKeys.push('__dummy__');
  }
  if (condVocabKeys.length === 1) {
    condVocabKeys.push('__dummy__');
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
    for (const nodes of block) {
      for (const node of nodes) {
        m = node.feat.match(RE_COND_TAG);
        if (m) {
          const pos = condVocab[m[2]];
          cvb.set([i, pos], m[1] === '?' ? 1 : -1);
        } else if (node.feat in wordVocab) {
          const pos = wordVocab[node.feat];
          wvb.set([i, pos], wvb.get([i, pos]) + 1);
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
     [ts,ts]がretrieveの際に[date,time]として扱われる

  -------------------------------------------------------  */

  const timeMatrix = dotMultiply(ones(wvSize[0], 2), NaN);
  i = 0;
  for (const block of inScript) {
    for (const line of block) {
      const ts = line[2];
      subset(timeMatrix, index(i, [0, 1]), [
        time2yearRad(ts),
        time2dateRad(ts),
      ]);
    }
  }

  return {
    status: 'ok',
    wordVocabLength: wordVocabKeys.length,
    condVocabLength: condVocabKeys.length,
    wordVocab: wordVocab,
    condVocab: condVocab,
    wordMatrix: wv,
    condMatrix: cv,
    timeMatrix: timeMatrix,
    condWeight: condWeight,
    timeWeight: timeWeight,
    prevWv: zeros(1, wvSize[1]),
    prevCv: zeros(1, cvSize[1]),
    delayEffect: delayEffector(2, tailing),
  };
}

/**
 * 前処理済みスクリプトをin/outに分割
 * @param {Array} script proprocess()で処理したスクリプト
 * @return {Array} 分割済みスクリプト
 */
export function tee(script) {
  /* proprocessで処理されたスクリプトはブロックのリストになっている。
     一つのブロックはinput(ecoまたはuser)、output(bot行)が交互に
     現れる。これらをブロックごとにinScript,outScriptに分割 */

  const inScript = [];
  const outScript = [];
  let inBlock = [];
  let outBlock = [];
  const errors = [];

  let i = 0;
  for (const block of script) {
    for (const line of block) {
      if (line[0] === 'user' || line[0] === 'eco') {
        inBlock.push(line);
      } else {
        outBlock.push(line);
      }
      i++;
    }
    inScript.push([...inBlock]);
    outScript.push([...outBlock]);
    inBlock = [];
    outBlock = [];
    if (inBlock.length !== outBlock.length) {
      errors.push(`${i}行目: 入力と出力の数が異なっています`);
    }
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
     head: "bot", validAvatars, "user", "eco"のいずれか
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
  let isEcoOrUserExists = false;
  let isBotExists = false;
  const errors = [];

  const parseLine = (line) => {
    const [head, text] = line.text.split(' ', 2);
    const [body, ts1] = text.split('\t', 2);
    const ts = line.timestamp || ts1;
    return [head, body, ts && new Date(Number(ts))];
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
    const [head, text] = parsed;

    // コメント行は飛ばす
    if (head.startsWith('#')) {
      continue;
    }
    // with文
    if (head === 'with') {
      withLine = text;
      continue;
    }

    // with情報の付加
    parsed[1] = parsed[1] + withLine;

    // 空行
    if (text.match(RE_BLANK_LINE)) {
      // 空行はブロックのはじめとみなす
      if (block.length !== 0 && isEcoOrUserExists && isBotExists) {
        newScript.push([...block]);
        block = [];
        isBotExists = false;
        isEcoOrUserExists = false;
      }
      continue;
    }

    // eco行
    if (head === 'eco') {
      // eco行はブロックのはじめとみなす
      if (block.length !== 0 && isEcoOrUserExists && isBotExists) {
        newScript.push([...block]);
        block = [];
        isBotExists = false;
        isEcoOrUserExists = false;
      }
      block.push(parsed);
      isEcoOrUserExists = true;
      continue;
    }

    // user行
    if (head === 'user') {
      if (prevKind === KIND_USER) {
        // user行が連続する場合は{prompt}を挟む
        block.push(['peace', `{prompt}${withLine}`, null, null]);
      }
      block.push(parsed);
      prevKind = KIND_USER;
      isEcoOrUserExists = true;
      continue;
    }

    // bot行
    if (head in scriptAvatars) {
      parsed[0] = scriptAvatars[head];

      if (prevKind == KIND_BOT) {
        // bot行が連続したら一つにまとめる
        const bl = block.length - 1;
        block[bl][1] += `\n${text}`;
      } else {
        block.push(parsed);
      }
      isBotExists = true;
      prevKind = KIND_BOT;
      continue;
    }
    errors.push(`${i}行目:${script[i]}は正常ではありません`);
  }

  if (block.length !== 0) {
    newScript.push(block);
  }

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
   1 0 0 0
   l 1 0 0
   0 l 1 0
   0 0 l 1
   のように幅と高さがsizeの単位行列に、対角成分のひとつ下が
   lである成分が加わった行列deを返す。
   任意の行列 M に対して de×M をすることで上の行の情報が
   下の行に影響を及ぼす、やまびこのような効果を与える
  */
  const m = identity(size);
  let d = multiply(identity(size - 1), level);
  d = concat(zeros(1, size - 1), d, 0);
  d = concat(d, zeros(size, 1));
  return add(m, d);
}
