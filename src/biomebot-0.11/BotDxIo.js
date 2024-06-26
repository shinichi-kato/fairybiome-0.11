import Dexie from 'dexie';
import {randomInt} from 'mathjs';
import replaceAsync from 'string-replace-async';
import {Dbio} from '../dbio';

const RE_TAG_LINE = /^(\{[a-zA-Z0-9_]+\}) (.+)$/;
const RE_EXPAND_TAG = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}/;

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
    this.updateTagValue = this.updateTagValue.bind(this);
    this.decodeTag = this.decodeTag.bind(this);
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
        fsId: module.fsId,
        data: {
          ...module.data,
          script: 'on script db/memory db', // moduleの中からscriptを除外
        },
      });

      // scriptの内容はdb.scriptに記憶。変更点の追跡が大変なので
      // 一旦削除し上書きする。
      // scriptの内容のうち、タグはmemoryに記憶する
      await this.db.scripts.where('botModuleId').equals(module.fsId).delete();
      await this.db.memory.where('botId').equals(module.fsId).delete();
      for (const line of module.data.script) {
        const m = line.match(RE_TAG_LINE);
        if (m) {
          await this.db.memory.add({
            botId: module.data.botId,
            moduleName: module.data.moduleName,
            key: m[1],
            value: m[2].split(','),
          });
        } else {
          const n = line.split('\t');
          await this.db.scripts.add({
            botModuleId: module.fsId,
            text: n[0],
            timestamp: n[1] ? new Date(n[1]) : null,
          });
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

    const snaps = await this.db.botModules
      .where(['data.botId', 'data.moduleName'])
      .between([botId, Dexie.minKey], [botId, Dexie.maxKey])
      .toArray();
    for (const snap of snaps) {
      scheme.botModules.push(snap);
      const ts = snap.data.updatedAt;
      if (scheme.updatedAt < ts) {
        scheme.updatedAt = ts;
      }
    }

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
    const data = await this.db.scripts
      .where('botModuleId')
      .equals(moduleId)
      .toArray();

    return data;
  }

  /**
   * memoryに新しいkey,valのペアを書き込む。keyが既存の場合追加valを追加する
   * @param {String} key キー文字列
   * @param {String} value 格納する値
   * @param {String} botId botのid
   * @param {String} moduleName モジュール名
   */
  async updateTagValue(key, value, botId, moduleName = 'main') {
    // db.memoryを更新
    // db.scriptsにはmemoryの内容はコピーされていない
    return await this.db.memory
      .where(['botId', 'moduleName', 'key'])
      .equal([botId, moduleName, key])
      .modify((item) => {
        return {
          ...item,
          value: item.value.push(value),
        };
      });
  }

  /**
   * db.memoryのtagを展開し、文字列にして返す
   * @param {string} key key文字列
   * @param {string} botId botId
   * @param {string} moduleName 展開を要求したモジュールの名前
   * @return {String} 展開した文字列
   */
  async decodeTag(key, botId, moduleName = 'main') {
    // botIdのmemoryはmainとpartのスクリプトに記載されたタグで
    // 構成される。
    // partとmainで同じ名前の記憶があった場合partを優先する

    const db = this.db;
    /**
     * 再帰的なタグの展開
     * @param {String} tag タグ文字列
     * @return {String} 展開後の文字列
     */
    async function expand(tag) {
      const snaps = await db.memory
        .where(['botId', 'key'])
        .equals([botId, tag])
        .filter(
          (item) => item.moduleName === 'main' || item.moduleName === moduleName
        )
        .toArray();

      if (snaps.length === 0) {
        return tag;
      }

      const snap =
        snaps[snaps.length > 1 && snaps[0].moduleName === 'main' ? 1 : 0];

      // 候補の中から一つを選ぶ
      const value = snap.value[randomInt(snap.value.length)];

      // タグが見つかったら再帰的に展開する
      return replaceAsync(value, RE_EXPAND_TAG, expand);
    }

    const snaps = await db.memory
      .where(['botId', 'key'])
      .equals([botId, key])
      .filter(
        (item) => item.moduleName === 'main' || item.moduleName === moduleName
      )
      .toArray();

    let decoded = '';
    if (snaps.length != 0) {
      // snapsにmainとpartが両方ある場合、partだけ残す
      const snap =
        snaps[snaps.length > 1 && snaps[0].moduleName === 'main' ? 1 : 0];

      // 候補の中から一つを選ぶ
      const value = snap.value[randomInt(snap.value.length)];

      // タグが見つかったら展開する
      decoded = replaceAsync(value, RE_EXPAND_TAG, expand);
    }

    return decoded;
  }
}

export const botDxIo = new BotDxIo();
