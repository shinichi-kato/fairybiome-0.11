/*
 */

import {randomInt} from 'mathjs';
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
    console.log(m);
    const d = m.data;
    main.botId = botId;
    main.schemeName = d.schemeName;
    main.author = d.author;
    main.updatedAt = d.updatedAt;
    main.description = d.descrption;
    main.alarms = d.alarms;
    main.avatarDir = d.avatarDir;
    main.backgroundColor = d.backgroundColor;
    main.responseIntervals = await botDxIo.readTag(
      '{RESPONSE_INTERVALS}',
      botId
    );

    // メッセージスプールの設定
    main.proposalSpool = [];
    main.channel.onmessage = (event) => {
      const action = event.action;
      switch (action.type) {
        case 'propose': {
          main.proposalSpool.push(action.message);
        }
      }
    };

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

    // sessionタグの削除
    await botDxIo.clearSessionTags(botId);

    // メッセージの収集

    return {
      displayName: botName,
      avatarDir: main.avatarDir,
      backgroundColor: main.backgroundColor,
      avatar: 'emerged',
    };
  },

  run: (action) => {
    // タイマーを起動しpart発言を集めて反応を生成
    // ユーザの無反応も検出
    if (action.type === 'run') {
      main._loop();
    }
  },

  _loop: () => {
    main.integrate();
    const ri = main.responseIntervals;
    const nextInterval = ri[randomInt(ri.length)];
    setTimeout(main._loop, nextInterval);
  },

  userKeyTouch: async (action) => {
    // ユーザがキー入力したことをキャッチ
    // 「ユーザが無言」という状態を検知する
  },

  recieve: async (action) => {
    // ユーザや環境からのメッセージを受取りパートに送る
    main.channel.postMessage({type: 'input', message: action.message});
  },

  integrate: (action) => {
    // ・パートからの入力を集めてその中からスコアの高い一つを選び
    // パートに通知するとともに外部に返す
    // ・userKeyTouchを集めて「ユーザの無言」を計数し
    // {USER_NOT_RESPONDING}というメッセージを
    // チャットボットに返す

    let hit;
    let s = 0;
    for (let i = 0; i < main.proposalSpool.length; i++) {
      const p = main.proposalSpool[i];
      if (s <= p.score) {
        s = p.score;
        hit = p;
      }
    }

    main.channel.postMessage({type: 'engage', toRender: hit});

    // スプール消去
    main.proposalSpool = [];
  },

  reply: (action) => {
    main.postMessage({type: 'reply', message: action.message});
  },

  pause: async (action) => {
    // タイマーを一時停止
  },
};
