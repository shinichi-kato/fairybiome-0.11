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

```mermaid
sequenceDiagram
title Run
participant provider
participant main
participant part1 as target part
participant part0 as other part

provider-) main: run
Note over main: pick {ON_SELECT}
main-)+part1: broadcast start
Note right of part1: retrieve {!on_start}
part1--)-main: broadcast propose
main--)provider: replying
Note over main : integrate
main-)+part1: broadcast approve
Note right of part1: render
part1--)-main: broadcast reply
main--)provider: reply

provider-)main: input
main-)+part0: broadcast input
main-)+part1: broadcast input
Note right of part1: retrieve
Note right of part0: retrieve
part1--)-main: broadcast propose
main--)provider: replying
part0--)-main: broadcast propose
main--)provider: replying
activate main
Note over main: integrate

main-)part0: breoadcast approve
Note right of part0: inactivate
main-)+part1: broadcast approve
Note right of part1: render

part1--)-main: broadcast reply
main--)provider: reply

```

## すべてのパートが応答できなかった場合の動作
```mermaid
sequenceDiagram
title Run
participant provider
participant main
participant part1 as target part
participant part0 as other part
provider-)main: input
main-)+part0: broadcast input
main-)+part1: broadcast input
Note right of part1: retrieve
Note right of part0: retrieve
part1--)-main: broadcast propose
main--)provider: replying
part0--)-main: broadcast propose
main--)provider: replying
activate main
Note over main: integrate

main-)+part1: input '{NO_ANSWER}'
Note right of part1: retrieve

```

## TODO
integrate前にpartからの返答が始まったら「反応中」という応答を返す

