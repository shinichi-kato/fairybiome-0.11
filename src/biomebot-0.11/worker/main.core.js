/*
mainパート
============================

## alarms
毎年、毎月、毎日など様々なインターバルでアラームを発火する。
辞書内でこれに対応した{?ALARM_MONDAY}などを記述することで
定期的イベントに対応する。

### 平日 6:30に発火するイベント
```
days: [Monday,Tuesday,Wednesday,Thursday,Friday],
hour: 6,
min: 30,
```
daysが指定された場合、year,month,dateは無視する。

### 毎日発火するイベント
```
hour: 6,
min: 30,
```
daysが[]かつ日付がnullの場合毎日発火する

### 毎年発火するイベント
```
year: null,
month: 5,
date: 7,
```
誕生日など毎年のイベントはmonthとdateを指定することで
発火する。この場合指定した日の最初に起動したとき発火する。
hour,minを指定すればその時刻を最初にまたいだときに発火する。

### 一度だけ発火するイベント
```
year: 2025,
month: 7,
date: 8
```
年を指定すると発火する




*/

import { randomInt } from 'mathjs';
import { botDxIo } from '../BotDxIo';
import { MessageFactory } from '../../message';

const DAY_TO_INT = {
  'sun': 0, 'sunday': 0,
  'mon': 1, 'monday': 1,
  'tue': 2, 'tuesday': 2,
  'wed': 3, 'wednesday': 3,
  'thu': 4, 'thursday': 4,
  'fri': 5, 'friday': 5,
  'sat': 6, 'saturday': 6
}


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
    main.avatarDir = d.avatarDir;
    main.backgroundColor = d.backgroundColor;
    main.responseIntervals = await botDxIo.readTag(
      '{RESPONSE_INTERVALS}',
      botId
    );
    main.responsePrecision = Number(
      await botDxIo.pickTag('{RESPONSE_PRECISION}', botId, 0.3)
    );

    main.alarms = calcNextEvent(d.alarms);

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

    // アラームのチェック
    // アラームが発火した場合、アラーム名をチャットボットに送信する
    const now = Date.now();
    for (const alarmName in main.alarms) {
      const alarm = main.alarms[alarmName];
      if (alarm.nextEventTS < now) {
        main.channel.postMessage({
          type: 'input',
          action: {
            message: {
              text: alarmName
            }
          }
        });
        alarm.nextEventTS = getNextEventTS(alarm);
      }
    }

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


/**
 * すべてのalarmに対して次のイベントが発生するtimestampを計算し、alarmに格納する
 * @param {*} alarms 
 */
function calcNextEvent(alarms) {
  for (const alarm of alarms) {
    alarm.nextEventTS = getNextEventTS(alarm);
  }
  return alarms;
}

/**
 * alarmで指定したイベントが次に発火するDate()を返す
 * @param {*} alarm 
 */
function getNextEventTS(alarm) {
  /*
    alarm = {
      "year": null,
      "month": null,
      "date": null,
      "days": ["Monday"],
      "hour": null,
      "minute": null
    }

    1.daysが空でなければ指定曜日に毎週起きるイベントを生成
    2. yearがnullの場合定期イベントを生成
    3. 一度のみのイベントを生成
  */

  const today = new Date();

  // 1.曜日画からでなければ毎週起きるイベントを生成

  if (alarm.days) {
    const days = Array.isArray(alarm.days) ? alarm.days : [alarm.days]
    const dayToday = today.getDay();
    let nearest = new Date();
    nearest.setDate(nearest.getDate() + 7);

    for (const d of days) {
      const targetDay = DAY_TO_INT(d.toLowerCase())

      const year = today.getFullYear();
      const month = today.getMonth();
      const date = today.getDate() + (targetDay - dayToday + 7) % 7
      const hour = alarm.hour || today.getHours();
      const min = alarm.minute || today.getMinutes();
      const cand = Date(year, month, date, hour, min);
      if (cand < nearest) {
        nearest = cand;
      }
    }

    return nearest;
  }

  // 2. yearがnullの場合定期イベントを生成
  if (!alarm.year) {
    const year = today.getFullYear();
    const month = alarm.month || today.getMonth();
    const date = alarm.date || today.getDate();
    const hour = alarm.hour || today.getHours();
    const min = alarm.minute || today.getMinutes();
    return new Date(year, month, date, hour, min);
  }

  // 3. 一度のみのイベントを生成
  return new Date(alarm.year, alarm.month, alarm.date, alarm.hour, alarm.min);

}