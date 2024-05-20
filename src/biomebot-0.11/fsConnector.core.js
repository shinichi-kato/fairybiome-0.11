/* 
  firestore connector
　===============================

  firestoreのモジュールは大きいため、各part上でロードさせるのは効率が悪い。
  そのためfirestoreのI/Oを行う専門のweb workerを用意する。
  

  {type:'initialize', firestore}
  初期化されて有効になったfirestoreを取得

  {type:'load', botId}
  chatbotのデータはgraphql,firestore,dexieの三点で運用する。
  graphql(gq)はソースであり、firestore(fs),dexie(dx)にアップロードして利用する。
  firestoreは主記憶、dexieはそのキャッシュである。

  gq,fs,dxのうちgqが最も新しいばあい、gqの内容をdxにアップロードする。
  fsが最も新しい場合、fsの内容をdxにアップロードする。
  dxが最も新しい場合、dxの内容をfsにアップロードする。

  
  キャッシュの方が新しい場合はそれをfirestoreにアップロードし、
  firestoreのほうが新しい場合はそれをdexieにダウンロードする。
  キャッシュもfirestoreも空の場合はstaticQueryからdexieにダウンロードする。
  このコマンドでcentralとすべてのpartを一括して処理する。
  
  fsConnectorが扱うデータは
  (1)チャットボットのmain
  (2)チャットボットの各パート、
  (3)チャットログ
  の三種類である。

  以下はdexieに格納する際の形式である

  # チャットボットのmain
  {
    id,
    part: null,
    avatarDir,
    backgroundColor,
    alarms: {
      [alarm名]: {
        year,month,date, day,hour,min
      }
    },
    updatedAt: "yyyy/mm/dd hh:mm/ss",
    RESPONSE_INTERVALS: [],
    AWAKENING_HOUR: [],
    BEDTIME_HOUR: [],
    I: [],
    YOU: [],
    "USER.Name": [],
    "USER.Nickname": [],
    "USER.Favorite_food.Name": [],
    "USER.Favorite_food.Taste": [],
    "USER.Favorite_food.Favor_reason": [],
    "USER.Disliked_food.Name": [],
    "USER.Disliked_food.Taste": [],
    "USER.Disliked_food.Disliked_reason": [],
    "BOT.body_condition": [],
    "BOT.mental_condition": [],
    "BOT.Name": [],
    "BOT.Nickname": [],
    "BOT.Favorite_food.Name": [],
    "BOT.Favorite_food.Taste": [],
    "BOT.Favorite_food.Favor_reason": [],
    "BOT.Disliked_food.Name": [],
    "BOT.Disliked_food.Taste": [],
    "BOT.Disliked_food.Disliked_reason": [],
    "BOT.body_condition": [],
    "BOT.mental_condition": [],
  }

  # チャットボットのpart
  {
    id,
    part: "partName",
    script: [],
  }

  # ログ
  [{
    id,
    kind,
    backgroundColor,
    AvatarPath,
    timestamp,
    text,
  }]

*/

export const fsConnector = {
    botId: null,
    partName: null,
    channel: new BroadcastChannel('biomebot'),

    loadBot: (botId) => {
      /*
        staticQuery,dexie,firestoreのデータを
        dexieに同期させ、最新版がdexie上にある
        状態にする
      */
      part.botId = botId;
      part.firestore = firestore;


    },



} 