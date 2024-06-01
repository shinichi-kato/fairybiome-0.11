/*
 IndexDB I/O

  ```
  # botModules
  ## main
  {
    fsId,
    data{
      botId,
      schemeName,
      moduleName: 'main',
      updatedAt: "yyyy/mm/dd hh:mm/ss",
      avatarDir,
      backgroundColor,
      alarms: {
        [alarm名]: {
          year,month,date, day,hour,min
        }
      },
    }
  }

 ## part
  {
    fsId, 
    data: {
      botId,
      schemeName,
      moduleName,
      updatedAt: "yyyy/mm/dd hh:mm/ss",
    }
  }
  ```

 # スクリプト
  ```
  scripts {
    id++,
    partId,
    text
  }
  ```
  すべてのチャットボットのスクリプトを行単位で記憶
  # システムタグ
  systemTags {
    botId,
    key,value
  }
  
  システムタグの内容は以下の通り
  memory: {
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

  # 永続タグ
  ```
  persistentTags {
    botId,
    key,value
  }
  ```
*/

import Dexie from "dexie";

class dbio {
  constructor() {
    this.db = new Dexie('Biomebot-0.11');
    this.db.version(1).stores({
      botModules: "fsId, data.botId,data.schemeName",
      scripts: "++id,partId",
      systemTags: "[botId+key]",
      persistentTags: "[botId+key]"
    })
  }

  async getDIr(botId){
    // -------------------------------------------------------
    // botIdで指定されたmainと少なくとも１つのpartが存在する
    // dirを返す。既存のbotが存在するかを確認できる。

    const s = await this.db.mains.where({botId:botId}).first();
    const p = await this.db.parts.where({botID:botId}).first();

    if(!!s && !!p){
      return true;
    }
    return false;
  }
}

export const db = new dbio();