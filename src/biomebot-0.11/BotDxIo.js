import Dexie from 'dexie';
import { randomInt } from 'mathjs';
import replaceAsync from 'string-replace-async';
import { Dbio } from '../dbio';

const RE_TAG_LINE = /^(\{[a-zA-Z0-9_]+\}) (.+)$/;
const RE_EXPAND_TAG = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/;
const RE_WORD_TAG = /\{([0-9]+)\}/;
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
    this.touchDxScheme = this.touchDxScheme.bind(this);
    this.downloadDxModule = this.downloadDxModule.bind(this);
    this.downloadDxScript = this.downloadDxScript.bind(this);
    this.downloadDxMemory = this.downloadDxMemory.bind(this);
    this.updateTagValue = this.updateTagValue.bind(this);
    this.decodeTag = this.decodeTag.bind(this);
    this.readTag = this.readTag.bind(this);
    this.pickTag = this.pickTag.bind(this);
    this._findTag = this._findTag.bind(this);
    this.writeTag = this.writeTag.bind(this);
    this.deleteTag = this.deleteTag.bind(this);
    this.expand = this.expand.bind(this);
    this.expandWordTag = this.expandWordTag.bind(this);
    this.memorizeLine = this.memorizeLine.bind(this);
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
      this.db.scripts
        .where('[botModuleId+doc]')
        .equals([module.fsId, 'origin'])
        .delete();
      this.db.memory.where('botId').equals(module.fsId).delete();
      for (const line of module.data.script) {
        const m = line.text.match(RE_TAG_LINE);
        if (m) {
          await this.db.memory.put({
            botId: module.data.botId,
            moduleName: module.data.moduleName,
            key: m[1],
            value: m[2].split(','),
            doc: line.doc || 'origin',
          });
        } else {
          await this.db.scripts.add({
            botModuleId: module.fsId,
            doc: line.doc || 'origin', // もとのdocが定義されていない場合'origin'
            text: line.text,
          });
        }
      }
    }
  }

  /**
   * 指定されたmoduleの日付を現時刻に設定た
   * @param {*} botId
   * @param {*} moduleName
   */
  async touchDxScheme(botId, moduleName) {
    await this.db.botModules
      .where('[data.botId+data.moduleName]')
      .equals([botId, moduleName])
      .modify((item) => {
        item.data.updatedAt = new Date();
      });
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
      if (snap.fsId) {
        // scriptの取得
        const moduleId = snap.fsId;
        snap.data.script = await this.downloadDxScript(moduleId);
        // memoryの取得
        snap.data.memory = await this.downloadDxMemory(botId, snap.moduleName);
      }
      scheme.botModules.push(snap);
      if (toString.call(snap.data.updatedAt) !== '[object Date]') {
        snap.data.updatedAt = new Date(snap.data.updatedAt.seconds * 1000);
      }
      if (scheme.updatedAt < snap.data.updatedAt) {
        scheme.updatedAt = snap.data.updatedAt;
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
   * ユーザが所有する、schemeNameのmoduleデータがあればそのbotIdを返す
   * @param {string} userId ユーザのid
   * @param {string} schemeName scheme名。省略すると最初に見つかったものを返す
   * @return {object} botId, schemeName
   */
  async findUserDxModule(userId, schemeName) {
    const snaps = await this.db.botModules
      .where(['data.botId', 'data.moduleName'])
      .equals([`bot${userId}`, 'main'])
      .toArray();

    if (schemeName) {
      for (const snap of snaps) {
        if (snap.data.schemeName === schemeName) {
          return { botId: snap.data.botId, schemeName: schemeName };
        }
      }
      return null;
    } else {
      for (const snap of snaps) {
        return { botId: snap.data.botId, schemeName: snap.data.schemeName };
      }
      return { botId: null, schemeName: null };
    }
  }

  /**
   * moduleIdで指定したスクリプトを全て読み込む
   * @param {String} moduleId
   * @return {array} スクリプト[{text,timestamp}]形式
   */
  async downloadDxScript(moduleId) {
    return await this.db.scripts
      .where('[botModuleId+doc]')
      .between([moduleId, Dexie.minKey], [moduleId, Dexie.maxKey])
      .sortBy('id');
  }

  /**
   * botIdで指定したmemoryを全て読み込む
   * @param {String} botId
   * @param {String} moduleName
   * @return {array} スクリプト[{text,timestamp}]形式
   */
  async downloadDxMemory(botId, moduleName) {
    const m = await this.db.memory
      .filter((mem) => {
        mem.botId === botId && mem.moduleName === moduleName;
      })
      .toArray();

    const memory = {};
    for (const item of m) {
      memory[item.key] = item.value;
    }

    return memory;
  }

  /**
   * memoryに新しいkey,valのペアを書き込む。keyが既存の場合追加valを追加する
   * @param {String} key キー文字列
   * @param {String} value 格納する値
   * @param {String} botId botのid
   * @param {object} kwargs {moduleName, overwrite}
   */
  async updateTagValue(key, value, botId, kwargs = {}) {
    // db.memoryを更新
    // db.scriptsにはmemoryの内容はコピーされていない
    const moduleName = kwargs.moduleName || 'main';
    const overwrite = kwargs.overwrite || false;
    const v = Array.isArray(value) ? value : [value];

    return await this.db.memory
      .where(['botId', 'moduleName', 'key'])
      .equals([botId, moduleName, key])
      .modify((item) => {
        item.value = overwrite ? v : item.value.push(value);
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
    async function _expand(tag) {
      let snap = await db.memory
        .where(['botId', 'moduleName', 'key'])
        .equals([botId, moduleName, tag])
        .first();

      if (!snap && moduleName !== 'main') {
        snap = await db.memory
          .where(['botId', 'moduleName', 'key'])
          .equals([botId, 'main', tag])
          .first();
      }

      if (!snap) {
        return tag;
      }

      // 候補の中から一つを選ぶ
      const value = snap.value[randomInt(snap.value.length)];

      // タグが見つかったら再帰的に展開する
      return replaceAsync(value, RE_EXPAND_TAG, _expand);
    }

    const values = await this.readTag(key, botId, null, moduleName);
    // 候補の中から一つを選ぶ
    if (values) {
      const value = values[randomInt(values.length)];

      // タグが見つかったら展開する
      return await replaceAsync(value, RE_EXPAND_TAG, _expand);

    }
    return null;
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
   * memory中のkey,valueのペアを削除する
   * @param {String} key キー文字列
   * @param {String} botId botのId
   * @param {String} moduleName botのmoduleName(optional)
   * @return {Promise}
   */
  async deleteTag(key, botId, moduleName = 'main') {
    return await this.db.memory
      .where(['botId', 'moduleName', 'key'])
      .equals([botId, moduleName, key])
      .delete();
  }
  /**
   * db.memoryのtagに対応するvalueのリストを返す。展開はしない
   * @param {string} key key文字列
   * @param {string} botId botId

   * @param {string} defaultValue keyが見つからなかった場合のデフォルト値
    * @param {string} moduleName 展開を要求したモジュールの名前  * @return {String} 展開した文字列
   */
  async readTag(key, botId, defaultValue = '', moduleName = 'main') {
    return await this._findTag(key, botId, defaultValue, moduleName);
  }

  /**
   * タグに紐付けられた値の中から一つを選んで返す
   * @param {*} key tag名
   * @param {*} botId botのid
   * @param {*} defaultValue 見つからなかった場合の代用値
   * @param {*} moduleName モジュール名
   * @return {String}
   */
  async pickTag(key, botId, defaultValue = null, moduleName = 'main') {
    // botIdのmemoryはmainとpartのスクリプトに記載されたタグで
    // 構成される。
    // partとmainで同じ名前の記憶があった場合partを優先する
    // タグに対応する値の中から一つをランダムに選ぶ。

    const values = await this._findTag(key, botId, null, moduleName);

    if (!values) {
      return defaultValue;
    }

    return values[randomInt(values.length)];
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
        return { key: key, value: snap ? 1 : 0 };
      })
    );
  }

  /**
   * botIdに属するsessionタグを削除
   * @param {*} botId botのId
   */
  async clearSessionTags(botId) {
    await this.db.memory
      .where(['botId', 'moduleName', 'key'])
      .between([botId, Dexie.minKey, Dexie.minKey], [botId, Dexie.maxKey, Dexie.maxKey])
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
        console.warn('wordTag duplicated, overwrited', node);
        await this.db.wordTag.update(node.id, { word: w, tag: item.tag });
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

  /**
   * db.memoryのtagを展開し、文字列にして返す
   * @param {string} key key文字列
   * @param {string} botId botId
   * @param {object} defaultValue 見つからなかった場合の代用値
   * @param {string} moduleName 展開を要求したモジュールの名前
   * @return {String} 展開した文字列
   */
  async _findTag(key, botId, defaultValue = null, moduleName = null) {
    let snap;

    if (moduleName) {
      snap = await this.db.memory
        .where(['botId', 'moduleName', 'key'])
        .equals([botId, moduleName, key])
        .first();
    }
    if (!snap) {
      snap = await this.db.memory
        .where(['botId', 'moduleName', 'key'])
        .equals([botId, 'main', key])
        .first();
    }

    return snap?.value || defaultValue;

  }

  /**
   * db.memoryのtagを展開し、文字列にして返す
   * @param {string} text 文字列
   * @param {string} botId botId
   * @param {string} moduleName モジュール名
   * @return {String} 展開した文字列
   */
  expand(text, botId, moduleName) {
    // text中のタグを再帰的に展開し、文字列に戻す

    const db = this.db;

    /**
     * 再帰的なタグの展開
     * @param {String} tag タグ文字列
     * @return {String} 展開後の文字列
     */
    async function _expand(tag) {
      let snap = await db.memory
        .where(['botId', 'moduleName', 'key'])
        .equals([botId, moduleName, tag])
        .first();

      if (!snap) {
        snap = await db.memory
          .where(['botId', 'moduleName', 'key'])
          .equals([botId, 'main', tag])
          .first();
      }

      if (!snap) {
        return tag;
      }

      // 候補の中から一つを選ぶ
      const value = snap.value[randomInt(snap.value.length)];

      // タグが見つかったら再帰的に展開する
      return replaceAsync(value, RE_EXPAND_TAG, _expand);
    }

    // タグが見つかったら展開する
    return replaceAsync(text, RE_EXPAND_TAG, _expand);
  }

  /**
   * 文字列中のwordTag ({0000})を文字列に戻す
   * @param {string} text outScriptの文字列
   * @return {string} 返答文字列
   */
  expandWordTag(text) {
    const db = this.db.wordTag;

    /**
     * 再帰的なタグの展開
     * @param {String} tag タグ文字列
     * @return {String} 展開後の文字列
     */
    async function _expand(tag) {
      const snap = await db.wordTag.where('tag').equals(tag).first();

      if (!snap) {
        return tag;
      }

      // 候補の中から一つを選ぶ
      const value = snap.value[randomInt(snap.value.length)];

      // タグが見つかったら再帰的に展開する
      return replaceAsync(value, RE_WORD_TAG, _expand);
    }

    // タグが見つかったら展開する
    return replaceAsync(text, RE_WORD_TAG, _expand);
  }

  /**
   * 入出力をパート辞書に追記
   * @param {Object} latestOutput {avatar,text,displayName}
   * @param {Object} latestInput {avatar,text,displayName}
   * @param {String} moduleId モジュールId
   */
  async memorizeLine(latestOutput, latestInput, moduleId) {
    /* latestOutputは一つ前のチャットボットの発言で、
    latestInputはそれに対するユーザの返答とみなす。
    そのペアを発言者を入れ替えて記憶する。
    */

    if (latestOutput.text !== '' && latestInput.text !== '') {
      const ts = new Date().valueOf();
      console.log(latestOutput, latestInput);

      // {user}と{bot}の入れ替えは
      // 未実装
      await this.db.scripts.add({
        botModuleId: moduleId,
        head: 'user',
        text: `${latestOutput.text}\t${ts}`,
        doc: 'page0',
      });
      await this.db.scripts.add({
        botModuleId: moduleId,
        head: 'bot',
        doc: 'page0',
        text: latestInput.text,
      });
    }
  }
}

export const botDxIo = new BotDxIo();
