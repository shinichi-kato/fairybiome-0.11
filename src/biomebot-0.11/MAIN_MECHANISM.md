FiaryBiome-0.11 メインの動作機序
==========================================

mainはチャットボットの動作全体を統括する。

## 初期状態
チャットボットは初めて生成されたとき、名前が決まっていなければ{BOT_NAME_GENERATOR}を使って名前を新たに生成する。

## deploy
データのロード、必要な初期化を行う。
セッションタグを削除。
チャットボットは起動時に{ON_START}で決められたパートをactivateした状態で動作を始める。
0: firestore, graphql, indexedDBに存在するデータをsyncし、最新版がindexedDBに
    存在する状態にする。
↓
1 main: 

## run
1 main: タイマーを起動。以降ユーザやecosystemから入力を受け取ったら
        {type:input}としてブロードキャスト
↓
2 main: {ON_START}から選んだpartに対して{type: start}をブロードキャスト
↓
3 part: {type:start}を受け取ったらアクティベートして{!on_start}をretrieve、
        retrieveした内容で{type:propose}をブロードキャスト
↓
4 main: タイマーで決めた時間全partからのproposeを待機した後一つを選んで
      {type: engage}発行
↓
5 part: {type:engage}を受け取ったら出力文字列を生成して{type:render} 
↓
6 main: {type:render}を受け取ったらチャットにpost
