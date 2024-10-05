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
surface   私は     昨日  お兄さんと     山に      登った    よ     。
         -------- ------ ------------- ---------- -------- ------ ----
token     {I}\tは  0233   0003\tと      3434\tに   4433     \tよ   \t。
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

import { useEffect, useCallback, useRef, useState } from 'gatsby';
import { useStaticQuery, graphql } from 'gatsby';
import { TinySegmenter } from './worker/tinysegmenter';

import { readTag } from './BotDxIo';

const RE_TAG = /\{(\?|\?!|\+|-|)[a-zA-Z_][a-zA-Z_0-9]*\}/g;

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

const query = graphql`
  query {
    allJson(filter: {token: {type: {in: ["system", "ici"]}}}) {
      nodes {
        token {
          values
          type
        }
      }
    }
  }
`;

const getValueTagList = (snap) => {
  const valueTagList = [];
  for (const node of snap.data.allJson.nodes) {
    const tokens = node.token.values;
    const pos = tokens.indexOf(' ');
    const tag = tokens.slice(0, pos);
    const values = tokens.slice(pos + 1);
    for (const v of values.split(',')) {
      valueTagList.push([tag, v.trim()]);
    }
  }
  return valueTagList;
};

/**
 * Noder関数の提供
 * @param {String} uid ユーザid
 * @param {String} botId チャットボットのid
 * @return {Array} [noder]
 */
export default function useNoder(uid, botId) {
  const snap = useStaticQuery(query);
  const wordToTagListRef = useRef(getValueTagList(snap));
  const segmenterRef = useRef(new TinySegmenter());
  const [tagToNameList, setTagToNameList] = useState({});

  const tags = [
    '{USER_NAME}',
    '{USER_NICKNAME}',
    '{BOT_NAME}',
    '{BOT_NICKNAME}',
  ];

  // -----------------------------------------------------
  // 単語やユーザ名をタグに変換する辞書の生成
  useEffect(() => {
    const readTag1 = async (key) => {
      return await readTag(key, botId);
    };

    (async () => {
      const valsList = await Promise.all(tags.map(readTag1));
      const nameTags = [];
      for (let i = 0; i < valsList.length; i++) {
        for (const val of valsList[i]) {
          nameTags.push([tags[i], val]);
        }
      }
      setTagToNameList(nameTags);
    })();
  }, [uid]);

  /*
    node
  */
  const noder = useCallback(
    (text) => {
      const tagDict = {};
      const nodes = [];
      let i = 0;

      // text中の条件タグと通常のタグはそのまま透過する。
      // replaceする際に多重replaceが起きるのを防ぐため、一旦\v{i}\vに置換
      text = text.replace(RE_TAG, (match) => {
        tagDict[i] = { surf: match, feat: match };
        return `\v${i++}\v`;
      });

      // text中の固有名詞はタグ化する。
      for (const [tag, val] of tagToNameList) {
        if (text.indexOf(val) !== -1) {
          tagDict[i] = { surf: tag, feat: val };
          text = text.replace(val, `\v${i++}\v`);
        }
      }

      // text中のシステムタグ類はタグ化する
      for (const [tag, val] of wordToTagListRef.current) {
        if (text.indexOf(val) !== -1) {
          tagDict[i] = { surf: tag, feat: val };
          text = text.replace(val, `\v${i++}\v`);
        }
      }

      // segment化
      const segments = segmenterRef.current.segment(text);

      let phase = 0;
      for (const seg of segments) {
        if (phase === 0 && seg === '\v') {
          phase = 1;
          continue;
        } else if (phase === 1) {
          // console.error(seg)
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
      return nodes;
    },
    [botId]
  );

  return [noder];
}
