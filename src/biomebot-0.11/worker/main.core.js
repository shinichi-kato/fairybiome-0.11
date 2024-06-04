/*
 */

import {botDxIo} from '../BotDxIo';

export const main = {
  botId: null,
  schemeName: null,
  avatarDir: null,
  backgroundColor: '#cccccc',
  channel: new BroadcastChannel('biomebot'),

  deploy: async (action) => {
    /*
      botIdかつkind:'main'のデータを読み、
      memoryにBOT_NAMEがなければボットの名前を生成して付与する。
      確率に従い自発的summonを行う。
      summonしない場合、ユーザの召喚を聞き取る
    */
    const {botId, summon} = action;
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
  },

  run: async (action) => {
    // タイマーを起動しpart発言を集めて反応を生成
  },

  pause: async (action) => {
    // タイマーを一時停止
  },
};
