import Dexie from 'dexie';
import {randomInt} from 'mathjs';
import replaceAsync from 'string-replace-async';
import {Dbio} from '../dbio';

const RE_TAG_LINE = /^(\{[a-zA-Z0-9_]+\}) (.+)$/;
const RE_EXPAND_TAG = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const LI_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'.split('');

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
    this.readTag = this.readTag.bind(this);
    this.writeTag = this.writeTag.bind(this);
    this.uploadDxWordToTagList = this.uploadDxWordToTagList.bind(this);
    this.downloadDxWordToTagList = this.downloadDxWordToTagList.bind(this);
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
      this.db.scripts.where('botModuleId').equals(module.fsId).delete();
      this.db.memory.where('botId').equals(module.fsId).delete();

      for (const line of module.data.script) {
        const m = line.match(RE_TAG_LINE);
        if (m) {
          await this.db.memory.put({
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
    return await this.db.botModules
      .where(['data.botId', 'data.moduleName'])
      .equals([botId, moduleName])
      .first();
  }

  /**
   * moduleIdで指定したスクリプトを全て読み込む
   * @param {String} moduleId
   * @return {array} スクリプト[{text,timestamp}]形式
   */
  async downloadDxScript(moduleId) {
    return await this.db.scripts
      .where('botModuleId')
      .equals(moduleId)
      .toArray();
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
      .equals([botId, moduleName, key])
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
    // タグに対応する値の中から一つをランダムに選ぶ。
    // 選んだ文字列の中にタグが含まれていたら再帰的に展開する。

    const db = this.db;

    /**
     * 再帰的なタグの展開
     * @param {String} tag タグ文字列
     * @return {String} 展開後の文字列
     */
    async function expand(tag) {
      const mainSnap = await db.memory
        .where(['botId', 'moduleName', 'key'])
        .equals([botId, 'main', tag])
        .first();

      const partSnap = await db.memory
        .where(['botId', 'moduleName', 'key'])
        .equals([botId, moduleName, tag])
        .first();

      const snap = partSnap || mainSnap;

      if (!snap) {
        return tag;
      }

      // 候補の中から一つを選ぶ
      const value = snap.value[randomInt(snap.value.length)];

      // タグが見つかったら再帰的に展開する
      return replaceAsync(value, RE_EXPAND_TAG, expand);
    }

    const values = await this.readTag(key, botId, moduleName);
    // 候補の中から一つを選ぶ
    const value = values[randomInt(values.length)];

    // タグが見つかったら展開する
    const decoded = replaceAsync(value, RE_EXPAND_TAG, expand);
    return decoded;
  }

  /**
   * memryにkey,valueのペアを上書きする
   * @param {String} key キー文字列
   * @param {String} value 格納する値
   * @param {String} botId botのId
   * @param {String} moduleName botのmoduleName(optional)
   * @return {Promise}
   */
  async writeTag(key, value, botId, moduleName = 'main') {
    return await this.db.memory.put({
      key: key,
      botId: botId,
      moduleName: moduleName,
      value: value,
    });
  }

  /**
   * db.memoryのtagに対応するvalueのリストを返す。展開はしない
   * @param {string} key key文字列
   * @param {string} botId botId

   * @param {string} defaultValue keyが見つからなかった場合のデフォルト値
    * @param {string} moduleName 展開を要求したモジュールの名前  * @return {String} 展開した文字列
   */
  async readTag(key, botId, defaultValue = '', moduleName = 'main') {
    // botIdのmemoryはmainとpartのスクリプトに記載されたタグで
    // 構成される。
    // partとmainで同じ名前の記憶があった場合partを優先する
    // タグに対応する値の中から一つをランダムに選ぶ。
    const mainSnap = await this.db.memory
      .where(['botId', 'moduleName', 'key'])
      .equals([botId, 'main', key])
      .first();

    const partSnap = await this.db.memory
      .where(['botId', 'moduleName', 'key'])
      .equals([botId, moduleName, key])
      .first();

    const snap = partSnap || mainSnap;

    return (snap && snap.value) || defaultValue;
  }

  /**
   * condVocabに書かれた全keyの現在の値を返す
   * @param {Object} condVocab matrix.condVocab
   * @param {String} botId botのId
   * @return {Array} cond
   */
  async readCondTags(condVocab, botId) {
    const condKeys = Object.keys(condVocab);
    return await Promise.all(
      condKeys.map(async (key) => {
        const snap = await this.db.memory
          .where(['botId', 'moduleName', 'key'])
          .equals([botId, 'main', key])
          .first();
        return {key: key, value: snap ? 1 : 0};
      })
    );
  }

  /**
   * botIdに属するsessionタグを削除
   * @param {*} botId botのId
   */
  async clearSessionTags(botId) {
    await this.db.memory
      .filter((mem) => mem.key.startsWith(LI_LOWERCASE))
      .delete();
  }

  /**
   * wordToTagListをDxにアップロード
   * @param {Array} wordToTags 表層形とタグのリスト
   */
  async uploadDxWordToTagList(wordToTags) {
    // 内容が最新になっているか管理が難しいため
    // 全て削除して書き直す
    await this.db.wordTag.toCollection().delete();

    // wordが重複していたら警告
    for (const item of wordToTags) {
      const w = item.word;
      const node = await this.db.wordTag.where('word').equals(w).first();
      if (node) {
        console.warning('wordTag duplicated, overwrited', node);
        await this.db.wordTag.update(node.id, {word: w});
      } else {
        await this.db.wordTag.add({
          tag: item.tag,
          word: item.word,
        });
      }
    }
  }

  /**
   * wordToTagリストをdbから取得
   * @return {Array} wordToTagのリスト
   */
  async downloadDxWordToTagList() {
    return await this.db.wordTag
      .toCollection()
      .sortBy('word', (arr) =>
        arr.sort((a, b) => b.word.length - a.word.length)
      );
  }
}

export const botDxIo = new BotDxIo();
