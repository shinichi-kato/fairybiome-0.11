/*
matrix
===================================
パートのスクリプトは以下の形式で記述される。

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
user text\ecoStatettimesamp
末尾に\tecoState timestampを追加すると、特徴量として扱われる

会話ログは加工せず辞書化できるようにする。そのため
1. user行が連続したらbotのpromptを挟む
2. ユーザが無入力かつチャットボットが返答生成中でない期間があったら空行として記憶
3. エコシステム入力があったらブロックを分ける。

*/
const RE_TAG_LINE = /^(\{[a-zA-Z0-9_]+\}) (.+)$/;
const RE_BLANK_LINE = /^#?[ 　]*$/;
const KIND_USER = 1;
const KIND_BOT = 2;
const KIND_ENV = 4;

/**
 * パートスクリプトの前処理
 * @param {Array} script パートスクリプト
 * @param {Array} validAvatars 有効なavatarのリスト
 * @return {array} 前処理済みスクリプト
 */
export function preprocess(script, validAvatars) {
  let newScript = [];
  let tagDict = {};
  let withLine = null;
  let prevKind = null;
  let block = [];

  for (let i = 0, l = script.length; i < l; i++) {
    const line = script[i];

    // システムタグ or ユーザ定義タグ
    const found = line.match(RE_TAG_LINE);
    if (found) {
      tagDict[found[1]] = found[2].split('\t');
      continue;
    }

    // with文
    if (line.startsWith('with ')) {
      withLine = withLine + line.slice(5);
    }

    // user行
    if (line.startsWith('user ')) {
      if(prevKind === KIND_USER) {
        // 連続したuser行にはpromptを挟む
        block.push("peace {prompt}")
      }
      if(prevKind === KIND_)
    }

  }
  return newScript;
}
