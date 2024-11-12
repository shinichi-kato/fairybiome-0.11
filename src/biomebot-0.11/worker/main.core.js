/*
 */

import { randomInt } from 'mathjs';
import { botDxIo } from '../BotDxIo';
import { MessageFactory } from '../../message';


export const main = {
  botId: null,
  schemeName: null,
  avatarDir: 'default',
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
  deploy: async ({ worker, botId, summon }) => {
    const m = await botDxIo.downloadDxModule(botId, 'main');
    console.log(m)
    const d = m.data;
    main.worker = worker;
    main.botId = botId;
    main.summon = summon;
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
    main.responsePrecision = Number(
      await botDxIo.pickTag('{RESPONSE_PRECISION}', botId, 0.3)
    );

    // メッセージスプールの設定
    main.proposalSpool = [];
    main.replying = false;
    main.channel.onmessage = (event) => {
      const action = event.data;
      switch (action.type) {
        case 'propose': {
          console.log('main get', action);
          if (action.score > main.responsePrecision) {
            main.proposalSpool.push({
              moduleName: action.moduleName,
              score: action.score,
              index: action.index,
            });
          }
          // biomebotに「反応中」を通知
          main.replying = true;
          main.worker.postMessage({ type: 'replying', moduleName: action.moduleName, score: action.score });
          break;
        }

        case 'reply': {
          main.reply(action);
          break;
        }
      }
    };

    // {BOT_NAME}チェック

    main.botName = await botDxIo.decodeTag('{BOT_NAME}', botId);
    if (main.botName === 'undefined') {
      main.botName = await botDxIo.decodeTag('{BOT_NAME_GENERATOR}', botId);

      await botDxIo.updateTagValue('{BOT_NAME}', main.botName, botId, {
        overwrite: true,
      });
    }

    // sessionタグの削除
    await botDxIo.clearSessionTags(botId);
    main.botRepr = {
      ownerId: main.botId,
      displayName: main.botName,
      avatarDir: main.avatarDir,
      backgroundColor: main.backgroundColor,
      ecoState: null,
    };

    // メッセージの収集

    return {
      botRepr: {
        ...main.botRepr,
        avatar: 'emerged',
      },
    };
  },

  run: async (action) => {
    // タイマーを起動しpart発言を集めて反応を生成
    // ユーザの無反応も検出
    main._loop();

    // 開始状態の決定
    // {ON_START}でpartを一つ選び、それをactivateする
    // activateはpartがdeployされたあとで実行されるため
    // それをpartに伝える
    let startingModuleName;
    if (main.summon) {
      startingModuleName = 'greeting';
    } else {
      startingModuleName = await botDxIo.decodeTag('{ON_START}', main.botId);
    }
    main.channel.postMessage({
      type: 'start',
      moduleName: startingModuleName,
      user: action.user
    });
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
    main.currentInput = { ...action.message };
    main.channel.postMessage({ type: 'input', message: action.message });
  },

  integrate: (action) => {
    // ・パートからの入力を集めてその中からスコアの高い一つを選び
    // パートに通知するとともに外部に返す
    // ・userKeyTouchを集めて「ユーザの無言」を計数し
    // {USER_NOT_RESPONDING}というメッセージを
    // チャットボットに返す
    if (main.proposalSpool.length !== 0) {
      let hit;
      let s = 0;
      for (let i = 0; i < main.proposalSpool.length; i++) {
        const p = main.proposalSpool[i];
        if (s <= p.score) {
          s = p.score;
          hit = p;
        }
      }

      main.channel.postMessage({
        type: 'approve',
        ...hit,
      });

    }
    else if (main.replying) {

      // 回答できなかった場合、次回{NO_ANSWER}を追加して返答を再試行。
      // {NO_ANSWER}が含まれた辞書がヒットする。
      main.channel.postMessage({
        type: 'input',
        action: {
          message: {
            text: `{NO_ANSWER}${main.currentInput.text}`,
          }
        }
      });
    }
    // スプール消去
    main.proposalSpool = [];
    main.replying = false;

  },

  reply: (action) => {
    function handleShapeShift() {
      main.worker.postMessage({ type: 'shapeShift' });
      return "";
    }
    let text = action.text;
    text = text.replace("{SHAPE_SHIFT}", handleShapeShift);

    const message = new MessageFactory(text, {
      bot: {
        ...main.botRepr,
        avatar: action.avatar,
      },
    });
    main.worker.postMessage({ type: 'reply', message: message.toObject() });
  },

  pause: async (action) => {
    // タイマーを一時停止
  },

  kill: () => {
    main.channel.postMessage({ type: 'kill' });
    main.channel.close();
  },
};
