/*
EcosystemProvider
========================================

EcosystemProviderはチャットルームの人工環境と会話ログを提供する。

チャットルーム外界の情報には時候、天候と場所などがある。
これらにトリガされて話題が開始されたり、適切な会話内容が変化
することから、これらは会話ログのテキスト以外の部分を構成する
情報であると言える。
話題のきっかけとしては「雨が振り始めた」「暑くなった」のように
状態が変化したことを捉えていると考えられる。これらはecosystem
からチャットボットへのメッセージとして伝達を行い、チャットボットは
それに対する返答を生成する。

また夏には夏の話題、夜には夜の適切な返答を生成するには、これらの
エコシステムの状態を会話の特徴量として加えることが有効である。
特徴量として捉えたとき昼夜や季節は時刻の情報から一意に
定義されることから、特徴量はタイムスタンプで表すことができる。
一方天候や場所は時刻だけからは決められないため、タイムスタンプ
ではない方法でログに記載する必要がある。

チャットルームには場所の概念があり、ユーザごとに作られた個人所有の
チャットルームのほか共有のチャットルームがある。それは人工環境の
locationに連動した情報であるため、チャットログはecosystemが提供する。

## 昼夜
昼夜は日時と時間で一意に決まるため、特徴量を持たない。
変化した瞬間にはメッセージを発信する。

状況    特徴量      メッセージ
---------------------------------------------------
深夜     ---      {ECOSYSTEM_START_MIDNIGHT}
夜明け   ---      {ECOSYSTEM_START_DAWN}
日の出   ---      {ECOSYSTEM_START_SUNRISE}
朝       ---      {ECOSYSTEM_START_MORNING}
午前中   ---      {ECOSYSTEM_START_LATE_MORNING}
昼       ---      {ECOSYSTEM_START_NOON}
午後     ---      {ECOSYSTEM_START_AFTERNOON}
夕方     ---      {ECOSYSTEM_START_EVENING}
日没     ---      {ECOSYSTEM_START_SUNSET}
薄暮     ---      {ECOSYSTEM_START_DUSK}
夜       ---      {ECOSYSTEM_START_NIGHT}
--------------------------------------------------

日の出と日没の基準は以下の日時とする。
日没が最も早い日：  12/7 17:00
日没が最も遅い日：   7/7 19:00
日の出が最も早い日： 6/7 05:00
日の出が最も遅い日： 1/7 07:00

夜明けと朝は日の出の±1時間、夕方と薄暮は日没の±1時間
昼は11:30-13:30で固定とする

## 季節
季節の変化はタイムスタンプで一意に知ることができるため、特徴量を持たない。

状況   特徴量     メッセージ
------------------------------------------------
 1月    ---       {ECOSYSTEM_START_JANUALY}
 2月    ---       {ECOSYSTEM_START_FEBRUARY}
 3月    ---       {ECOSYSTEM_START_MARCH}
 4月    ---       {ECOSYSTEM_START_APRIL}
 5月    ---       {ECOSYSTEM_START_MAY}
 6月    ---       {ECOSYSTEM_START_JUNE}
 7月    ---       {ECOSYSTEM_START_JULY}
 8月    ---       {ECOSYSTEM_START_AUGUST}
 9月    ---       {ECOSYSTEM_START_SEPTEMBER}
10月    ---       {ECOSYSTEM_START_OCTOBER}
11月    ---       {ECOSYSTEM_START_NOVEMBER}
12月    ---       {ECOSYSTEM_START_DECEMBER}
----------------------------------------------

## 天候
天候はフラクタル的に変化する。ユーザに通知する情報は
「雨が振り始めた」というトリガ情報と「雨が降っている」という
レベル情報である。天候の変化チェックは2分ごとに行う。


天候   特徴量             メッセージ
-----------------------------------------------
快晴 {ECOSYS_CLEAR}     {ECOSYS_START_CLEAR}
晴れ {ECOSYS_SUNNY}     {ECOSYS_START_SUNNY}
曇り {ECOSYS_CLOUDY}    {ECOSYS_START_CLOUDY}
雨   {ECOSYS_RAIN}      {ECOSYS_START_RAIN}
雷   {ECOSYS_THURNDER}  {ECOSYS_START_THURNDER}
台風 {ECOSYS_STORM}     {ECOSYS_START_STROM}
雪   {ECOSYS_SNOW}      {ECOSYS_START_SNOW}
霧   {ECOSYS_FOG}       {ECOSYS_START_FOG}
吹雪 {ECOSYS_BLIZZARD}  {ECOSYS_START_BLIZZARD}
------------------------------------------------

場所
      特徴量            メッセージ
-----------------------------------------------
室内  {ECOSYS_ROOM}     {ECOSYS_ENTER_ROOM}
以下未定
-----------------------------------------------


## 変化の通知タイミング
例えば{ECOSYSTEM_JANUARY}を送出するのは1月に初めてユーザと会話した
場面が適切で、1月にユーザと会話するのが2回以降は送出しないほうがよい。
そのため、EcosystemProviderはユーザとチャットボットが最後に会話した
ログの日付を利用する。

*/

import React, {
  useReducer,
  useState,
  useEffect,
  createContext,
  useContext,
} from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import useInterval from '../../useInterval';
import NoiseGenerator from './noise';
import {AuthContext} from '../Auth/AuthProvider';
import {MessageFactory} from '../../message';
import {getTodayCycle, isToday, getLatestEvent} from './dayCycle';

export const EcosystemContext = createContext();

const ECOSYSTEM_UPDATE_INTERVAL = 2 * 60 * 1000;
const ECOSYSTEM_CLIMATE_SCALE = 0.0000001;
const MONTH_NAME = [
  'JANUALY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

/* noiseから得られる0~1の値を気圧に見立て、0のほうが悪天候,1のほうが
   好天とする。0~1を8段階に分割して天候を与える
*/
const weatherNameMap = {
  BLZ: 'BLIZZARDY',
  SNW: 'SNOWY',
  CLO: 'CLOUDY',
  SUN: 'SUNNY',
  CLE: 'CLEAR',
  FOG: 'FOGGY',
  RAI: 'RAINY',
  STM: 'STORMY',
};
const weatherMap = [
  'BLZ SNW SNW CLO CLO SUN CLE CLE', // 1月
  'BLZ SNW SNW SNW CLO CLO SUN CLE', // 2月
  'RAI RAI FOG CLO CLO SUN SUN CLE', // 3月
  'RAI CLO CLO CLO CLO SUN CLE CLE', // 4月
  'RAI RAI CLO CLO SUN SUN CLE CLE', // 5月
  'STM RAI RAI RAI CLO CLO CLO SUN', // 6月
  'STM RAI RAI CLO CLO SUN CLE CLE', // 7月
  'STM STM RAI RAI CLO SUN CLE CLE', // 8月
  'STM RAI CLO CLO CLO SUN CLE CLE', // 9月
  'RAI RAI RAI CLO CLO SUN CLE CLE', // 10月
  'SNW RAI RAI CLO CLO SUN CLE CLE', // 11月
  'BLZ SNW RAI RAI CLO CLO SUN CLE', // 12月
].map((m) => m.split(' ').map((w) => weatherNameMap[w]));

const initialState = {
  weather: '',
  location: 'ROOM',
  dayState: '',
  todayCycle: [], // 昼夜イベント
  lastAccessAt: new Date(1),
  logRef: null,
  noise: new NoiseGenerator(1, ECOSYSTEM_CLIMATE_SCALE),
  channel: null,
  run: false,
};

/**
 * 状態管理
 * @param {Object} state 直前のstate
 * @param {Object} action stateに対する操作
 * @return {Object} 新しいstate
 */
function reducer(state, action) {
  console.log('Ecosystem ', action);
  switch (action.type) {
    case 'setChannel': {
      return {
        ...state,
        channel: action.channel,
      };
    }

    case 'setLastAccessAt': {
      return {
        ...state,
        lastAccessAt: action.lastAccessAt,
      };
    }

    case 'setLogRef': {
      return {
        ...state,
        logRef: action.logRef,
      };
    }

    case 'setTodayCycle': {
      return {
        ...state,
        todayCycle: [...action.todayCycle],
      };
    }

    case 'setDayState': {
      return {
        ...state,
        dayState: action.dayState,
      };
    }

    case 'setWeather': {
      return {
        ...state,
        weather: action.weather,
      };
    }

    case 'run': {
      return {
        ...state,
        run: true,
      };
    }

    case 'stop': {
      return {
        ...state,
        run: false,
      };
    }

    default:
      throw new Error(`invalid action ${action}`);
  }
}

/**
 * EcosystemProvider
 *
 * @param {Object} firestore firestoreオブジェクト
 * @param {JSX.Element} param.children chiidren
 * @return {JSX.Element} context
 */
export default function EcosystemProvider({firestore, children}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [log, setLog] = useState([]);
  const auth = useContext(AuthContext);

  // ---------------------------------------------------
  // broadcast channelの初期化
  //

  useEffect(() => {
    let ch;
    if (!state.channel) {
      ch = new BroadcastChannel('biomebot');
      dispatch({type: 'setChannel', channel: ch});
    }
    return () => {
      if (ch) {
        ch.close();
      }
    };
  }, [state.channel]);

  // -----------------------------------------------------
  // locationに連動したチャットログの購読
  //

  useEffect(() => {
    if (auth.uid && firestore) {
      let logRef;
      if (state.lcation === 'ROOM') {
        logRef = collection(firestore, 'users', auth.uid, 'log');
      } else {
        logRef = collection(firestore, 'public', state.location, 'log');
      }

      dispatch({type: 'setLogRef', logRef: logRef});

      let unsubscribe = null;
      const q = query(logRef, orderBy('timestamp', 'desc'), limit(20));

      unsubscribe = onSnapshot(q, (snap) => {
        const l = [];
        snap.forEach((doc) => {
          const d = doc.data();
          l.push({
            ...d,
            id: doc.id,
            timestamp: d.timestamp ? d.timestamp.toDate() : '',
            // timestampはserverTimestamp()で書き込むとratency補正時にnullが帰ってくる
          });
        });
        setLog(l);
        // 最上行が最新行
        if (l.length !== 0) {
          dispatch({type: 'setlastAccessAt', lastAccessAt: l[0].timestamp});
        }
      });

      return () => {
        if (unsubscribe) {
          console.log('unsubscribed');
          unsubscribe();
        }
      };
    }
  }, [auth.uid, firestore, state.location]);

  // ----------------------------------------------------
  // 人工環境の更新
  //

  useInterval(
    () => {
      // 天候
      const month = new Date().toLocaleDateString().split('/')[1];
      const currentWeather =
        weatherMap[month][Math.round(state.noise.getValue() * 7)];
      if (currentWeather !== state.weather) {
        sendMessage(`{ECOSYSTEM_START_${currentWeather}}`);
        dispatch({type: 'setWeather', weather: currentWeather});
      }

      // 昼夜
      // lastAccessAtが昨日だったら更新

      let todayCycle;
      if (isToday(state.lastAccessAt)) {
        todayCycle = getTodayCycle();
        dispatch({type: 'setTodayCycle', todayCycle: todayCycle});
      } else {
        todayCycle = state.todayCycle;
      }

      // 直近のdayCycleイベントを発火
      const latestEvent = getLatestEvent(state.lastAccessAt, todayCycle);
      if (latestEvent) {
        sendMessage(`{ECOSYSTEM_START_${latestEvent}}`);
        dispatch({type: 'setDayState', event: latestEvent});
      }

      // 季節
      //
    },
    state.run ? ECOSYSTEM_UPDATE_INTERVAL : null
  );

  // -------------------------------------------------
  // メッセージの送出
  // チャットログとチャットボットの両方に送る

  /**
   * channelにメッセージをポストしログに書き込む
   * @param {*} message
   */
  function sendMessage(message) {
    const m = new MessageFactory(message, {ecoState: true}).toObject();
    state.channel.postMessage({
      type: 'input',
      message: m,
    });
    addDoc(state.logRef, m);
  }

  return (
    <EcosystemContext.Provider
      value={{
        weather: state.weather,
        location: state.location,
        dayState: state.dayState,
        ecoState: `{ECOSYS_${state.weather}}{ECOSYS_${state.location}`,
        log: log,
        run: () => dispatch({type: 'run'}),
        stop: () => dispatch({type: 'stop'}),
      }}
    >
      {children}
    </EcosystemContext.Provider>
  );
}
