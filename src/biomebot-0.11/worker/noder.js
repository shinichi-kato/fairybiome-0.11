/*
自然言語文字列のノード化
========================================

チャットボットの返答生成では、様々な入力に対して柔軟な出力を返し、また
場面に応じた適切な返答を出力することが重要である。これらを実現するため
下記のタグを用いる。

## 交換可能概念識別タグ(Interchangeable Concept Identification Tag, ICIタグ)

例えば「私はテニスが好きだ」に対して「あなたはテニスが好きなんですね」と
返す。辞書としてこの入出力のペアを記憶しておくことが素朴な方法であるが、
これを一般化すれば「私は{X}が好きだ」に対して「あなたは{X}が好きなん
ですね」であり、さらに「私は{X}が{Y}だ」に対して「あなたは{X}が{Y}なん
ですね」となると小さい辞書でもかなり柔軟性の高い応答が可能になる。
ここで{X}に入ってもよいのは
テニス,庭球
のような同義語にとどまらず、
テニス,庭球,ゴルフ,野球,山登り,料理,...
のように同じ文脈に現れうるものは幅広く許容される。そこで{X}や{Y}に
当てはまる語句のグループを予め定義しておき、inScriptやoutScriptに
対応する語句が現れた場合それを{0023}のように数字４桁以上からなる名前の
タグに置き換える。対応する表層形は記憶しておき、テキストマッチングの際は
表層形ではなくタグの一致で評価する。outScriptに記憶済みのICIタグに
対応した語句が現れた場合、これを記憶した内容に置き換える。

## テキストのエンコード
## テキストのエンコード
入出力文字列は内部的にNode列に変換して扱う。各Nodeはsurface(表層形)と
tokenからなり、以下のように表す。
```
surface   私は     昨日   お兄さんと      山に         登った    よ     。
         -------- ------- -------------- ------------ -------- ------ ----
token     {I}\tは  {0233}   {0003}\tと      {3434}\tに  {4433}   よ      。
```
トークンは「私は」「俺は」など言い回しが違うが意味が同じになるものを
統合して扱う単位である。トークンの中で同じ意味とみなす語句はICI(交換
可能概念識別子,Interchangeable Concept Identifer)とよび、そのIDを
tokenに格納する。なお、「お兄さんは」の接頭語「お」、接尾語「さん」は
表記ゆれとみなし同じICIとし、助詞「は」はtokenの中でICIの後ろに
タブ区切りで格納する

この前処理によって少量のコーパスで様々な会話に対応することを目指す。

## unknownタグ

辞書をエンコードする場合は全辞書を走査した後vocabを生成するため未知語は
生じないが、ユーザ入力には未知語が含まれることがある。tfidfでは
その場合演算できなくなる。そこでvocabにない語句はできるだけ連続した
一つにまとめ、そのうちの一つに{UNKNOWN}というトークンを割り当て、
それ以外は無視する。

## 固有名詞のタグ
ユーザとチャットボットが会話している実際のテキストには両者の名前が
実際のユーザ名、ニックネームのどちらでも書かれている可能性がある。
これらは{USER}、{USER_NICKNAME}、{BOT}、{BOT_NICKNAME}などのタグに
変換する必要があるが、これらの固有名詞は実行時にはわかるが
辞書の時点では現在のuidからわかるユーザ名を仮定する。
これらの最新情報はDexie上にあり、適宜それを利用する

*/

import { TinySegmenter } from './tinysegmenter';

import { botDxIo } from '../BotDxIo';

const RE_TAG = /\{(\?|\?!|!|\+|-|)[a-zA-Z_][a-zA-Z_0-9]*\}/g;
const POST_PA = {
  が: '格助詞',
  を: '格助詞',
  に: '格助詞',
  へ: '格助詞',
  と: '格助詞',
  より: '格助詞',
  から: '格助詞',
  で: '格助詞',
  や: '格助詞',
  の: '格助詞',
  ながら: '接続助詞',
  ので: '接続助詞',
  し: '接続助詞',
  たり: '接続助詞',
  て: '接続助詞',
  も: '副助詞',
  は: '副助詞',
  でも: '副助詞',
  など: '副助詞',
  か: '副助詞',
};

/**
 * Nodeクラス
 */
export class Node {
  /**
   * コンストラクタ
   * @param {String} surface 表層形
   * @param {String} feat 特徴量
   */
  constructor(surface, feat) {
    this.surface = surface;
    this.feat = feat;
  }
}

/**
 * Node化クラス
 */
export class Noder {
  /**
   * コンストラクタ
   * @param {String} botId チャットボットのid
   */
  constructor(botId) {
    this.botId = botId;
    this.segmenter = new TinySegmenter();
    this.nameToTags = [];
    this.wordToTags = [];
    this.loadTags = this.loadTags.bind(this);
    this.nodify = this.nodify.bind(this);
  }

  /**
   * scriptで指定されたタグを読み込む
   */
  async loadTags() {
    const readTag1 = async (key) => {
      return await botDxIo.readTag(key, this.botId);
    };

    const tags = [
      '{USER_NAME}',
      '{USER_NICKNAME}',
      '{BOT_NAME}',
      '{BOT_NICKNAME}',
    ];
    const namesList = await Promise.all(tags.map(readTag1));
    for (let i = 0; i < namesList.length; i++) {
      for (const name of namesList[i]) {
        this.nameToTags.push({ tag: tags[i], name: name });
      }
    }
    this.nameToTags = this.nameToTags.sort(
      (a, b) => b.name.length - a.name.length
    );

    this.wordToTags = await botDxIo.downloadDxWordToTagList();
  }

  /**
   * テキストをノード列に分解
   * @param {String} text 入力文字列
   * @return {Array} nodeのリスト
   */
  nodify(text) {
    const tagDict = {};
    let nodes = [];
    let i = 0;

    // text中の条件タグと通常のタグはそのまま透過する。
    // replaceする際に多重replaceが起きるのを防ぐため、一旦\v{i}\vに置換
    text = text.replace(RE_TAG, (match) => {
      tagDict[i] = { surf: match, feat: match };
      return `\v${i++}\v`;
    });

    // text中の固有名詞はタグ化する。
    for (const { tag, name } of this.nameToTags) {
      if (text.indexOf(name) !== -1) {
        tagDict[i] = { surf: name, feat: tag };
        text = text.replaceAll(name, `\v${i++}\v`);
      }
    }

    // text中のシステムタグ類はタグ化する
    for (const { tag, word } of this.wordToTags) {
      if (text.indexOf(word) !== -1) {
        tagDict[i] = { surf: word, feat: tag };
        text = text.replaceAll(word, `\v${i++}\v`);
      }
    }

    // segment化
    const segments = this.segmenter.segment(text);

    // タグをfeatにセット
    let phase = 0;
    for (const seg of segments) {
      if (phase === 0) {
        if (seg === '\v') {
          phase = 1;
          continue;
        } else if (seg === '？\v') {
          // tinesegmenterで予期せぬsegが作られる。
          // そのパッチ的対策
          nodes.push(new Node('？', '？'));
          phase = 1;
          continue;
        }
      } else if (phase === 1) {
        console.error(segments)
        const t = tagDict[seg];
        nodes.push(new Node(t.surf, t.feat));
        phase = 2;
        continue;
      } else if (phase === 2) {
        // seg === '\v'
        phase = 0;
        continue;
      } else {
        nodes.push(new Node(seg, seg));
      }
    }

    // タグに続く助詞を取り込む
    nodes = joinPostParticle(nodes);
    return nodes;
  }
}

/**
 * タグに続く助詞をタグのノードに取り込む
 * @param {Array} nodes node列
 * @return {Array} 処理後のnode列
 */
function joinPostParticle(nodes) {
  const newNodes = [];
  let phase = 0;
  for (const n of nodes) {
    if (phase === 0 && n.feat.startsWith('{')) {
      phase = 1;
      newNodes.push(n);
      continue;
    }

    if (phase === 1) {
      if (n.surface in POST_PA) {
        const lastIndex = newNodes.length - 1;
        newNodes[lastIndex].surface += n.surface;
        newNodes[lastIndex].feat += `\t${n.surface}`;
      } else {
        newNodes.push(n);
      }
      phase = 0;
      continue;
    }

    newNodes.push(n);
  }

  return newNodes;
}
