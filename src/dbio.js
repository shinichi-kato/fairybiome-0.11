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
      author: "",
      description: "",
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
  part {
    ++id
    fsId,
    data: {
      botId,
      schemeName,
      moduleName,
      updatedAt: ISOString,
    }
  }
  ```

 # スクリプト
  ```
  scripts {
    id++,
    moduleId, // fsId
    text,     // avatar text<ecoState>
    timestamp
  }
  ```
  すべてのチャットボットのスクリプトを行単位で記憶
  idをfsの方に戻すのは大変。スクリプトが外で編集された後、dxの
  スクリプトが同じ内容になっているか追跡してupdateするのもかなり大変なので
  upload時に一旦moduleIdに属するデータは消して上書きする


  # システムタグ
  memory {
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
      BOT_NAME: [],
      BOT_NAME_GENERATOR: [],
      ON_START:[],
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


*/

import Dexie from 'dexie';

/**
 * dbio class
 */
export class Dbio {
  /**
   *
   */
  constructor() {
    this.db = new Dexie('Biomebot-0.11');
    this.db.version(1).stores({
      botModules: '++id, fsId, [data.botId+data.moduleName]',
      scripts: '++id,botModuleId',
      memory: '++id, [botId+key]',
    });
  }

  /**
   * チャットボットデータ有無の判定
   * @param {String} botId チャットボットのid
   * @return {Boolean} botIdのデータが存在するかどうか
   */
  async getDIr(botId) {
    // -------------------------------------------------------
    // botIdで指定されたmainと少なくとも１つのpartが存在する
    // dirを返す。既存のbotが存在するかを確認できる。

    const s = await this.db.mains.where({botId: botId}).first();
    const p = await this.db.parts.where({botId: botId}).first();

    if (!!s && !!p) {
      return true;
    }
    return false;
  }

}

export const db = new Dbio();
