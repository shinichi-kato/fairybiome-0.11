/*
 */

import {botDxIo} from '../BotDxIo';

export const main = {
  botId: null,
  schemeName: null,
  avatarDir: null,
  backgroundColor: '#cccccc',
  channel: new BroadcastChannel('biomebot'),

  /**
   * botIdの'main'データをindexedDBから読み込む。
   * memoryにBOT_NAMEがなければBOT_NAME_GENERATORで生成して代入する。
   * summonに従い初期状態を決める
   * @param {String} param.botId botId
   * @param {Boolean} summon 初期に召喚された状態で始まるか
   * @return {Object} botRepr
   */
  deploy: async ({botId, summon}) => {
    const m = await botDxIo.downloadDxModule(botId, 'main');
    main.botId = botId;
    main.schemeName = m.schemeName;
    main.author = m.author;
    main.updatedAt = m.updatedAt;
    main.description = m.descrption;
    main.alarms = m.alarms;
    main.avatarDir = m.avatarDir;
    main.backgroundColor = m.backgroundColor;

    // {BOT_NAME}チェック

    let botNameSnap = await botDxIo.getMemory(botId, '{BOT_NAME}');
    let botName = botNameSnap.val;
    if (!botName) {
      botNameSnap = await botDxIo.getMemory(botId, '{BOT_NAME_GENERATOR}');
      botName = botNameSnap.val;

      await botDxIo.updateMemory(botNameSnap.id, [botName]);
    }

    // 開始状態の決定

    if (summon) {
      main.state = 'peace';
    } else {
      const onStart = await botDxIo.getMemory(botId, '{ON_START}');
      main.state = onStart.val;
    }

    return {
      displayName: botName,
      avatarDir: main.avatarDir,
      backgroundColor: main.backgroundColor,
      avatar: 'emerged'
    };
  },

  run: async (action) => {
    // タイマーを起動しpart発言を集めて反応を生成
  },

  pause: async (action) => {
    // タイマーを一時停止
  },
};
