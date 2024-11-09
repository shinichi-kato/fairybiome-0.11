/*
retrieve
==========================
類似度行列を利用してmessageに対する返答の候補を生成する
*/
import {
  zeros,
  divide,
  apply,
  concat,
  dot,
  row,
  add,
  diag,
  multiply,
  norm,
  randomInt,
  matrix,
  squeeze,
  cos,
} from 'mathjs';

import { botDxIo } from '../BotDxIo';
import { time2yearRad, time2dateRad } from '../../components/Ecosystem/dayCycle';
const RE_COND_TAG = /^\{(\?|!|\?!)([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const HOUR_WEIGHT = 0.6; // TVにおける時刻の重み付け(ハイパーパラメータ)
const DATE_WEIGHT = 1.0 - HOUR_WEIGHT; // TVにおける日付の重み付け(ハイパーパラメータ)

/**
 * messageから返答の候補を返す
 * @param {message} message 入力メッセージ
 * @param {Object} source 類似度行列
 * @param {String} botId botのId
 * @param {Object} noder noderインスタンス
 * @return {Object} 計算結果
 */
export async function retrieve(message, source, botId, noder) {
  /*
    ユーザや環境からのmessageを受取り、botIdで示されるbotについて
    matrixとの類似度を計算して類似度の高い候補を返す。

    類似度の計算にはwordMatrix, condMatrix, timeMatrixの3つを利用する。

    ## wordMatrix
    wordMatrixは単語や文節を特徴量として生成したvectorで、messageのなかの
    wvとの間で類似度を計算する。

    ## condMatrix

    condMatrixは{?tag}や{!tag}などの条件タグで、matrixに{?tag}があり
    memoryやmessageにも{tag}があるときは条件に一致したとみなして値は1とする。
    状況としては雨が降っているときに「雨が降ってるね」と発言しやすく
    なる。逆に{?tag}があるが{tag}がないときは値は-1にする。これにより
    雨が降っていないときに「雨が降ってるね」と発言しにくくなる。
    一方で{?tag}がない場合には{tag}がなくても類似度は影響されない
    ようにするため、matrixに{?tag},{!tag}ともにない場合はmemoryの記憶に
    関わらず値を0にする。

      matrix     memory       値    状況
    -----------------------------------------------------------------
      {?tag}     {tag}あり     1    雨が降っている？→YES
      {?tag}     {tag}なし    -1    雨が降っている？→NO
      {!tag}     {tag}あり    -1    雨が降っていない？→NO
      {!tag}     {tag}なし     1    雨が降っていない？→YES
                 {tag}あり     0    雨が降っているが無関係
                 {tag}なし     0    雨が降っていないが無関係
    -----------------------------------------------------------------

    この方法では雨が降っている条件下での会話には全て{?rain}のようなタグが
    が備わることになる。その結果IDF値が小さくなってしまうため、condMatrix
    の計算ではTFIDFは採用せず、単純な内積で計算を行う。
    なお、内積の値はcondWeight値で重み付けする。

    ## timeMatrix

    matrixに記述されたtimeMatrixは[timestamp,timestamp]という同じ値を2つ格納した
    ベクトルになっている。これを用いて日付と時刻についてそれぞれcosθを計算する。
    日付は1年で2πとなるラジアン表記、時刻は一日で2πとなるラジアン表記をして
    cosθを計算する。


    source= {
      wordVocabLength: wordVocabKeys.length,
      condVocabLength: condVocabKeys.length,
      wordVocab: wordVocab,
      condVocab: condVocab,
      wordMatrix: wv,
      condMatrix: cv,
      condWeight: condWeight,
      timeWeight: timeWeight,
      prevWv: prevWv,
      delayEffect: delayEffect
    }

    messageに含まれる{?tag}{!tag}は条件タグで、都度memoryに
    問い合わせて有無を調べる。retrieve()内では値をキャッシュする
  */

  //   wv, cv, tvの生成
  const nodes = noder.nodify(message.text);
  const [wv, unknown] = generateWv(nodes, source);
  const cv = await generateCv(nodes, source, botId);
  const tv = generateTv(message);

  if (unknown.state === -1) {
    await botDxIo.writeTag('{UNKNOWN}', [unknown.word], botId);
  }

  // 類似度計算
  const wvs = squeeze(wv);
  const wvdot = apply(source.wordMatrix, 1, (x) => dot(squeeze(x), wvs));
  const cvdot = apply(source.condMatrix, 1, (x) => dot(squeeze(x), cv));
  const tvsim = apply(source.timeMatrix, 1, (x) =>
    timeSimilarity(squeeze(x), tv)
  );

  // 重み付けスコア計算
  const scores = add(
    wvdot,
    multiply(cvdot, source.condWeight),
    multiply(tvsim, source.timeWeight)
  ).valueOf();

  // スコア最大の要素を抽出
  const maxScore = Math.max(...scores);
  const cands = [];
  let i;
  let l;
  for (i = 0, l = scores.length; i < l; i++) {
    if (scores[i] === maxScore) {
      cands.push(i);
    }
  }

  // 直前の状態を記憶
  source.prevWv = matrix(wv);

  return {
    score: maxScore,
    index: cands[randomInt(cands.length)],
  };
}

/**
 * wvの生成
 * @param {*} nodes 入力メッセージをnodifyしたもの
 * @param {*} source metrix Object
 * @param {*} noder noderインスタンス
 * @return {Array} [wv, unknown]
 */
function generateWv(nodes, source) {
  /* ---------------------------------------------

     wordVectorの生成
     wordVocabに存在するものは計数。
     最初に見つかった不明単語をunknownとする.

  ----------------------------------------------*/
  let wv = zeros(1, source.wordVocabLength);

  // state 0:未開始 1:unknownパース中 -1:パース終了
  let unknown = { word: '', state: 0 };

  for (const node of nodes) {
    if (node.feat in source.wordVocab) {
      // 既知のword

      const pos = source.wordVocab[node.feat];
      wv.set([0, pos], wv.get([0, pos]) + 1);
      if (unknown.state > 0) {
        // unknownの終了
        unknown.state = -1;
      }
    } else {
      // 未知のword
      // 最初に見つけた未知のワードは{UNKONWN}タグに置換し、
      // memoryの{UNKNOWN}に未知ワードを記憶する。
      // 未知のワードが連続していたら一つの単語とみなす。
      // 以降の未知ワードは無視する

      if (unknown.state === 0) {
        // 未知のワード先頭
        unknown = { word: node.surface, state: 1 };
      } else if (unknown.state === 1) {
        // 未知のワード連続
        unknown = { word: unknown.word + node.surface, state: 2 };
      }
    }
  }

  // wvの正規化
  // norm(x)が0の場合はwvはzerosでzerosのままとする
  const invWv = apply(wv, 1, (x) => { const n = norm(x); return n === 0 ? 1 : divide(1, n); });
  wv = multiply(diag(invWv), wv);

  // 直前のwvの影響をtailingに応じて受けたwvを得る
  let wvd = concat(source.prevWv, wv, 0);

  console.log(wvd, source.delayEffect)
  wvd = multiply(source.delayEffect, wvd);
  wvd = row(wvd, 1);
  console.log(wvd)

  return [wvd, unknown];
}

/**
 * memoryおよび入力文字列からのCVの生成
 * @param {Array} nodes テキストをnodifyして得られたnode列
 * @param {Object} source matrixObject
 * @param {String} botId botのId
 * @return {matrix} cv
 */
async function generateCv(nodes, source, botId) {
  const cv = zeros(1, source.condVocabLength);

  // memoryに格納されたcondTagをcvに取り込む
  const condSnap = await botDxIo.readCondTags(source.condVocab, botId);
  for (const item of condSnap) {
    const pos = source.condVocab[item.key];
    cv.set([0, pos], Number(item.value));
  }

  // 入力文字列に含まれる条件タグをcvに取り込む。
  // 辞書になかった条件タグは無視する
  let m;
  for (const node of nodes) {
    m = node.feat.match(RE_COND_TAG);
    if (m) {
      if (m[2] in source.condVocab) {
        const pos = source.condVocab[m[2]];
        cv.set([0, pos], m[1] === '?' ? 1 : -1);
      }
    }
  }
  return squeeze(cv);
}

/**
 * TVの生成
 * @param {Object} message 入力メッセージ
 * @return {matrix} tv
 */
function generateTv(message) {
  const ts = message.timestamp;
  return [time2yearRad(ts), time2dateRad(ts)];
}

/**
 * timestampの類似性を日付と時刻についてそれぞれ計算する
 * @param {Float} x [radian,radian]
 * @param {Float} y [radian,radian]
 * @return {Array} 類似度ベクトル
 */
function timeSimilarity(x, y) {
  /*
    x,yにはそれぞれ2つの成分がある。成分ごとに角度の差を計算し
    類似性を-1〜+1の値でもとめ、合計値を返す。NaNが含まれた
    成分は計算結果を0とする。
    第0成分は日付、第1成分は時刻に相当し、それぞれDATE_WEIGHT,
    HOUR_WEIGHTで重み付けする。
  */
  const e0 = x[0] - y[0];
  const e1 = x[1] - y[1];
  return (
    DATE_WEIGHT * (isNaN(e0) ? 0 : cos(e0)) +
    HOUR_WEIGHT * (isNaN(e1) ? 0 : cos(e1))
  );
}

/**
 * outScriptをnodes列に変換
 * @param {Array} outScript scriptのうちチャットボットの出力部分
 * @param {Object} noder noderインスタンス
 * @return {Array} 計算結果
 */
export function encodeOutScript(outScript, noder) {
  /*
  スクリプトは{head,text,timestamp}という形式で記述されている。
  この内timestampはoutScriptでは利用せず、textの内容のうちwordToTagや
  nameToTagの対象になった語句はdecodeの際に実際に使われた単語に
  置き換える必要があるためoutScriptもnode列に変換する。
  変換後は
  [{head, nodes}]
  という形式にする。
  */
  const script = [];
  for (const block of outScript) {
    for (const line of block) {
      const nodes = noder.nofidy(line.text);
      script.push({ head: line.head, nodes: nodes });
    }
  }
  return script;
}
