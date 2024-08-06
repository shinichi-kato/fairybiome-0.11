/*
  dayCycle.js
  ============================================
  日の出・日没の時刻を概算し、そこから現在の
  昼夜の状況を生成する。

    日の出と日没の基準は以下の日時(JST)とする。
    日没が最も早い日：  12/7 17:00
    日没が最も遅い日：   7/7 19:00
    日の出が最も早い日： 6/7 05:00
    日の出が最も遅い日： 1/7 07:00          */
const epicDate = {
  sunset: {
    earliest: {
      date: [12, 7],
      time: [17, 0],
    },
    latest: {
      date: [7, 7],
      time: [19, 0],
    },
  },
  sunrise: {
    earliest: {
      date: [6, 7],
      time: [5, 0],
    },
    latest: {
      date: [1, 7],
      time: [7, 0],
    },
  },
};

/**
 * 直近のdayCycleイベントを返す
 * @param {datetime} lastAccess 最後にチェックした日時
 * @param {Object} dayCycle todayCycleの返り値
 * @param {datetime} now 基準時刻
 * @return {String} dayCycle名
 */
export function getLatestEvent(lastAccess, dayCycle, now) {
  dayCycle ||= getTodayCycle();
  now ||= new Date();
  let lastEvent = {
    ts: lastAccess,
    name: 'invalid',
  };

  for (const event of dayCycle) {
    if (lastEvent.ts < now && now < event.ts) {
      // イベントをまたいだら発火
      return lastEvent.name;
    }
    lastEvent = event;
  }
  return null;
}
/**
 * tが今日かどうかをlocale基準で判定
 * @param {datetime} t 検査したい日時
 * @return {boolean} 今日ならtrue
 */
export function isToday(t) {
  const n = new Date();
  return t.toLocaleDateString() === n.toLocaleDateString();
}

/**
 * timestampで示された日の昼夜イベントを配列で返す
 * @param {datetime} timestamp タイムスタンプ
 * @return {Array} 昼夜イベント
 */
export function getTodayCycle(timestamp = null) {
  timestamp ||= new Date();

  const f = new Intl.DateTimeFormat('jp', {dateStyle: 'medium'});

  const date = f.format(timestamp).replaceAll('/', '-');
  const noon = new Date(`${date}T12:00:00+09:00`).valueOf();
  const sunrise = getSunrise(timestamp).valueOf();
  const sunset = getSunset(timestamp).valueOf();

  const events = [
    {ts: new Date(noon - 12 * 60 * 60 * 1000), name: 'MIDNIGHT'},
    {ts: new Date(sunrise - 60 * 60 * 1000), name: 'DAWN'},
    {ts: new Date(sunrise - 10 * 60 * 1000), name: 'SUNRISE'},
    {ts: new Date(sunrise + 10 * 60 * 1000), name: 'MORNING'},
    {ts: new Date(sunrise + 120 * 60 * 1000), name: 'LATE_MORNING'},
    {ts: new Date(noon - 60 * 60 * 1000), name: 'NOON'},
    {ts: new Date(noon + 60 * 60 * 1000), name: 'AFTERNOON'},
    {ts: new Date(sunset - 60 * 60 * 1000), name: 'EVENING'},
    {ts: new Date(sunset - 10 * 60 * 1000), name: 'SUNSET'},
    {ts: new Date(sunset + 10 * 60 * 1000), name: 'DUSK'},
    {ts: new Date(sunset + 60 * 60 * 1000), name: 'NIGHT'},
    {ts: new Date(noon + 12 * 60 * 60 * 1000), name: 'MIDNIGHT'},
  ];

  return events;
}

/**
 * tで示された日の日の出のdatetimeを返す
 * @param {datetime} t datetime
 * @return {datetime} sunrise datetime
 */
export function getSunrise(t) {
  const ty = t.toLocaleDateString().slice(0, 4);
  const erl = epicDate.sunrise.latest;
  const ere = epicDate.sunrise.earliest;
  const tm = String(erl.date[0]).padStart(2, '0');
  const td = String(erl.date[1]).padStart(2, '0');
  const tH = String(erl.time[0]).padStart(2, '0');
  const tM = String(erl.time[1]).padStart(2, '0');
  const s = `${ty}-${tm}-${td}T${tH}:${tM}:00+09:00`;
  const offset = new Date(Date.parse(s));

  const x = -Math.cos(time2yearRad(t) - time2yearRad(offset));
  const sl = erl.time[0] * 60 + erl.time[1];
  const se = ere.time[0] * 60 + ere.time[1];
  const a = (se - sl) / 2.0;
  const b = (se + sl) / 2.0;
  const y = a * x + b;
  const t2 = new Date(t);
  t2.setHours(0, y, 0);
  return t2;
}

/**
 * tで示された日の日没のdatetimeを返す
 * @param {datetime} t datetime
 * @return {datetime} sunset datetime
 */
export function getSunset(t) {
  const ty = t.toLocaleDateString().slice(0, 4);
  const esl = epicDate.sunset.latest;
  const ese = epicDate.sunset.earliest;
  const tm = String(esl.date[0]).padStart(2, '0');
  const td = String(esl.date[1]).padStart(2, '0');
  const tH = String(esl.time[0]).padStart(2, '0');
  const tM = String(esl.time[1]).padStart(2, '0');
  const s = `${ty}-${tm}-${td}T${tH}:${tM}:00+09:00`;
  const offset = new Date(Date.parse(s));

  const x = -Math.cos(time2yearRad(t) - time2yearRad(offset));
  const sl = esl.time[0] * 60 + esl.time[1];
  const se = ese.time[0] * 60 + ese.time[1];
  const a = (se - sl) / 2.0;
  const b = (se + sl) / 2.0;
  const y = a * x + b;
  const t2 = new Date(t);
  t2.setHours(0, y, 0);
  return t2;
}

/**
 * datetimeをradに変換
 * @param {datetime} t datetime
 * @return {Float} rad値
 */
export function time2yearRad(t) {
  // 一年は356.25日*24h*60min*60sec*1000msec。それが2πになるよう変換
  // 一年の始点終点はlocaleに合わせる
  if (!t) {
    return NaN;
  }
  if (typeof t === 'object' && 'seconds' in t) {
    t = new Date(t.seconds*1000);
  }

  const ty = t.toLocaleDateString().slice(0, 4);

  const tStart = new Date(`${ty}-01-01T00:00:00+09:00`);
  const tEnd = new Date(`${ty}-12-31T23:59:59.999+09:00`);
  const rad = ((t - tStart) / (tEnd - tStart)) * 2.0 * Math.PI;
  return rad;
}

/**
 * timeをradに変換
 * @param {datetime} t datetime
 * @return {Float} rad値
 */
export function time2dateRad(t) {
  // 一日は24h*60min*60sec*1000msec。それが2πになるように変換
  // 一日の始点終点はlocaleに合わせる

  if (!t) {
    return NaN;
  }
  if (typeof t === 'object' && 'seconds' in t) {
    t = new Date(t.seconds*1000);
  }

  const ts = t.toLocaleTimeString('jp');
  const [h, m, s] = ts.split(':');
  const ms = Number(h) * 60 * 60 + Number(m) * 60 + Number(s);
  const msStart = 0;
  const msEnd = 23 * 60 * 60 + 59 * 60 + 59;
  const rad = ((ms - msStart) / (msEnd - msStart)) * 2.0 * Math.PI;
  return rad;
}
