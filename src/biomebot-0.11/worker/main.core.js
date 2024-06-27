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

    let botName = await botDxIo.decodeTag('{BOT_NAME}', botId);
    if (botName === 'undefined') {
      botName = await botDxIo.decodeTag('{BOT_NAME_GENERATOR}', botId);

      await botDxIo.updateTagValue('{BOT_NAME}', botName, botId);
    }

    // 開始状態の決定

    if (summon) {
      main.state = 'peace';
    } else {
      const onStart = await botDxIo.decodeTag('{ON_START}', botId);
      main.state = onStart.val;
    }

    return {
      displayName: botName,
      avatarDir: main.avatarDir,
      backgroundColor: main.backgroundColor,
      avatar: 'emerged',
    };
  },

  run: async (action) => {
    // タイマーを起動しpart発言を集めて反応を生成
    // 無言も検出
  },

  pause: async (action) => {
    // タイマーを一時停止
  },
};
