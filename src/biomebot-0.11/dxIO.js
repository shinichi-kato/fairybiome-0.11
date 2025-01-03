import Dexie from 'dexie';
import { Dbio } from '../dbio';

const RE_TAG_LINE = /^(\{[a-zA-Z0-9_]+\}) (.+)$/;

class DxIO extends Dbio {
  constructor() {
    super();

    this.getIndex = this.getIndex.bind(this);
    this.setIndex = this.setIndex.bind(this);
    this.uploadModuleToDb = this.uploadModuleToDb.bind(this);
  }

  /**
   * index情報の取得
   * @param {} botId
   */
  async getIndex(botId) {
    const index = await this.db.index
      .where('botId')
      .equals(botId)
      .first();

    return index || { index: {} };
  }

  /**
   * index情報の更新
   */
  async setIndex(botId, index) {
    return await this.db.index.put({ botId: botId, ...index });
  }

  /**
   * FSのmoduleに含まれる全情報をdxにコピーしindexを返す
   * @param {} botId botId
   * @param {} moduleData モジュールデータ 
  */
  async uploadModuleToDb(botId, moduleName, moduleData, page) {
    // page = ''はsettings
    const self = this;
    async function uploadScript(pageName) {
      const payload = {
        botId: botId,
        moduleName: moduleName,
        script: moduleData[pageName],
        page: pageName
      };
      await self.db.script.put(payload);

      // pageがmemoryの場合db.memoryにも反映
      if (pageName === 'memory') {
        // console.log(moduleData)
        const memory = moduleData.memory;
        for (const i in memory) {
          const m = memory[i].match(RE_TAG_LINE);
          if (m) {
            await self.db.memory.put(
              {
                botId: botId,
                moduleName: moduleName,
                key: m[1],
                value: m[2].split(',')
              }
            )
          }
        }
      }

    }

    if (page) {
      await uploadScript(page);
    } else {
      await Promise.all(Object.keys(moduleData).map(async (pageName) => {
        await uploadScript(pageName)
      }));
    }
  }

  /**
   * Dx上の使用されていないスクリプトを削除
   * @param {} botId 
   * @param {*} dxIndex 
   * @param {*} newDxIndex 
   */
  async deleteUnusedDxModule(botId, dxIndex, newDxIndex) {
    // dxIdex, newDxIndexはともに
    // dxIndex[modName][page]=timestampという形式。
    // newDxIndexに存在せずdxIndexに存在するmoduleを削除
    // newDxIndexに存在せずdxIndexに存在するscriptを削除

    for (const module of Object.keys(dxIndex)) {
      if (!(module in newDxIndex)) {
        await this.db.script
          .where(["botId", 'moduleName', 'page'])
          .between([botId, module, Dexie.minKey], [botId, module, Dexie.maxKey])
          .delete();
      }
      else {
        for (const page in dxIndex[module]) {
          if (!(page in newDxIndex[module])) {
            await this.db.script
              .where(["botId", 'moduleName', 'page'])
              .equals([botId, module, page])
              .delete();
          }
        }
      }
    }
  }

  /**
   * moduleNameを指定してbotIdのモジュールを取得.
   * memory,scriptは含まない
   * @param {*} botId 
   * @param {*} moduleName 
   */
  async downloadDxModule(botId, moduleName) {
    // db.script[botId,moduleName, ''] = settings
    // db.script[botId,moduleName, origin] = origin
    // schemeName取得
    const data = {};
    const index = await this.db.index
      .where('botId')
      .equals(botId)
      .first();
    data.schemeName = index.schemeName;

    // settings取得
    let s = await this.db.script
      .where(["botId", 'moduleName', 'page'])
      .equals([botId, moduleName, ''])
      .first();

    if (s) {
      s = s.script;
      data.author = s.author;
      data.description = s.description;
      data.avatarDir = s.avatarDir;
      data.backgroundColor = s.backgroundColor;
      data.alarms = s.alarms;
    }
    return data;
  }

  /**
   * moduleNameで指定したorigin,page0スクリプトを全て読み込む
   * @param {String} botId
   * @param {String} moduleName
   * @return {array} スクリプト[{i,line}]形式
   */
  async downloadDxScriptByName(botId, moduleName) {
    const pages = await this.db.script
      .where('[botId+moduleName+page]')
      .between([botId, moduleName, Dexie.minKey], [botId, moduleName, Dexie.maxKey])
      .filter(item => item.page !== '')
      .toArray();

    // sは[{botId,moduleName,page,script:{} }]という形式。
    // scriptは行番号をキーとする辞書で、行番号順に並べ,page情報を付加して
    // 返す
    const script = [];
    for (const page of pages) {
      const ps = page.script;
      for (const lineNum in ps) {
        script.push({ line: ps[lineNum], page: page.page });
      }
    }

    return script;

  }

}


export const dxIO = new DxIO();