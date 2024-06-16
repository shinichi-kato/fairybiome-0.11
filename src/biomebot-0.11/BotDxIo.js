import Dexie from 'dexie';
import {Dbio} from '../dbio';

/**
 * IndexedDB上に記憶したbot情報のI/O
 */
class BotDxIo extends Dbio {
  /**
   *
   */
  constructor() {
    super();
    this.getModuleNames = this.getModuleNames.bind(this);
    this.uploadDxScheme = this.uploadDxScheme.bind(this);
    this.downloadDxScheme = this.downloadDxScheme.bind(this);
    this.downloadDxModule = this.downloadDxModule.bind(this);
    this.downloadDxScript = this.downloadDxScript.bind(this);
    this.getMemory = this.getMemory.bind(this);
  }

  /**
   * botを構成するmodulesの取得
   * @param {String} botId chatbotのId
   * @return {Array} botIdで指定されたBotを構成するBotModule名のリスト
   */
  async getModuleNames(botId) {
    const snaps = await this.db.botModules
      .where('data.botId')
      .equals(botId)
      .toArray();

    const mods = [];
    for (const snap of snaps) {
      mods.push(snap.data.moduleName);
    }

    return mods;
  }

  /**
   * indexedDBにscheme形式で受け取ったデータを保存。memory,scriptを含む
   * @param {Object} scheme
   */
  async uploadDxScheme(scheme) {
    // indexedDBへのアップロード。
    for (const module of scheme.botModules) {
      await this.db.botModules.put({
        ...module.data,
        script: 'on script db', // moduleの中からscriptを除外
        moduleId: module.fsId,
      });

      // scriptの内容はdb.scriptに記憶。変更点の追跡が大変なので
      // 一旦削除し上書きする
      await this.db.scirpt.where('moduleId').equals(module.fsId).delete();
      for (const line of module.script) {
        await this.db.script.add({
          moduleId: module.fsId,
          text: line.text,
          timestamp: line.timestamp,
        });
      }

      // mainに記載されたmemoryのデータはdb.memoryにコピー
      const data = module.data;
      if (data.moduleName === 'main') {
        for (const key in data.memory) {
          if (Object.prototype.hasOwnProperty.call(data.memory, key)) {
            await this.db.memory.put({
              botId: data.botId,
              key: key,
              value: data.memory[key],
            });
          }
        }
      }
    }
  }

  /**
   * indexedDBからscheme形式でデータを取得。
   * script, memoryは含まない
   * @param {String} botId チャットボットのId
   * @return {Object} scheme形式のチャットボットデータ
   */
  async downloadDxScheme(botId) {
    const scheme = {
      updatedAt: new Date(0), // main,partsのうち最新のもの
      botModules: [], // 内容は{id,data}
    };

    // db.memoryの読み込み
    // const memory = {};
    // const mems = await this.db.memory
    //   .where(['botId', 'key'])
    //   .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
    //   .toArray();

    // for (const mem of mems) {
    //   memory[mem.key] = mem.value;
    // }

    await this.db.botModules
      .where(['data.botId', 'data.moduleName'])
      .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
      .each((snap) => {
        // if (snap.moduleName === 'main') {
        //   snap.memory = memory;
        // }
        scheme.botModules.push(snap);
        const ts = snap.data.updatedAt;
        if (scheme.updatedAt < ts) {
          scheme.updatedAt = ts;
        }
      });

    return scheme;
  }

  /**
   * moduleNameを指定してbotIdのモジュールを取得.
   * memory,scriptは含まない
   * @param {String} botId チャットボットのId
   * @param {String} moduleName モジュール名(file名)
   * @return {Object} 取得したモジュール
   */
  async downloadDxModule(botId, moduleName) {
    console.log(botId, moduleName);
    const module = await this.db.botModules
      .where(['data.botId', 'data.moduleName'])
      .equals([botId, moduleName])
      .first();
    return module;
  }

  /**
   * moduleIdで指定したスクリプトを全て読み込む
   * @param {String} moduleId
   * @return {array} スクリプト[{text,timestamp}]形式
   */
  async downloadDxScript(moduleId) {
    return await this.db.script.where('moduleId').equals(moduleId).toArray();
  }

  /**
   * botIdで指定したチャットボットのmemoryからkeyで指定されたデータを取得。
   * それが配列の場合中からランダムに選んだ一つをidとともに返す
   * @param {String} botId チャットボットのId
   * @param {String} key memoryのキー文字列
   * @return {Object} indexedDB上でのidとランダムに選んだ値(val)
   */
  async getMemory(botId, key) {
    // db.memoryの内容を読み、配列の中から一つをランダムに選んで返す
    const snap = await this.db.memory
      .where(['botId', 'key'])
      .equals([botId, key])
      .first();

    const values = snap.value;
    if (Array.isArray(values)) {
      const l = values.length;
      if (l === 0) {
        return '';
      } else {
        const i = Math.floor(Math.random() * l);
        return {id: snap.id, val: values[i]};
      }
    }
    return {id: snap.id, val: null};
  }

  /**
   * memoryに新しい値を書き込む
   * @param {String} memoryId getMemoryで取得できるmemoryId
   * @param {String} val 格納する値
   */
  async updateMemory(memoryId, val) {
    return await this.db.memory.update(memoryId, {val: val});
  }
}

export const botDxIo = new BotDxIo();
