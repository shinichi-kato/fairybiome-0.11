/*
BiomebotProvider

<BiomebotProvider \
  summon=true || false
  schemeName="schemeName"
>


schemeName   動作
------------------------------------------------------------------
なし         既存のチャットボットのうちschemeNameがNPCで始まらない
             ものの中からランダムに一つを選ぶ
             なければschemeNameがNPCで始まらないものの中から
             ランダムに一つを選びidを生成して付与
あり         既存のscemeNameチャットボットがあれば起動。
             なければschemeNameのボットを作りidを生成して付与
------------------------------------------------------------------

summon       動作
------------------------------------------------------------------
あり          チャットボットの初期状態は{ON_SUMMON}で決まる
なし          チャットボットの初期状態は{ON_START}で決まる
------------------------------------------------------------------

botState     状態
-----------------------------------------
init         初期状態
deploying    deploy中
deployed     deploy完了
run          動作中
-----------------------------------------

avatar        状態
----------------------------------------
init         初期状態
emerging     出現初期
emerging0    出現中
emerging1    出現中
emerging2    出現中
emerging3    出現中
emerged      出現完了

biomebot実体はweb workerである。これらの起動・終了を管理しユーザ入力のI/Oを
行う。チャットボットにはユーザが所有できるPCチャットボットと、特定のユーザが
所有できず、全員で共有するNPCチャットボットがある。


mainWorkerMapRef: {
  botId: new mainWorker()
}

partWorkersMapRef: {
  botId: [new partWorker(), ...]
}


*/

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
} from 'react';
import {useStaticQuery, graphql} from 'gatsby';
import {AuthContext} from '../components/Auth/AuthProvider';
import {syncCache} from './botio';

import MainWorker from './worker/main.worker';
import PartWorker from './worker/part.worker';

export const BiomebotContext = createContext();

/**
 * @param {string} userId firestoreで生成されたauth.uid
 * @param {string} schemeName チャットボットの型式(relativeDir)
 * @return {string} botId
 */
function generateBotId(userId, schemeName) {
  // userIdをベースにbotIdを生成する。
  // NPCボットはユーザに帰属しないのでschemeNameそのまま

  if (schemeName.startsWith('NPC')) {
    return schemeName;
  } else {
    return `${schemeName || 'bot'}${userId || ''}`;
  }
}

/**
 *
 * @param {object} gqSnap graphqlで取得したチャットボット情報
 * @return {string} ランダムに選んだschemeName
 */
function randomlyChoosePCScheme(gqSnap) {
  // gqSnapからrelativeDirectory(=schemeName)を集め、
  // それらの中からNPCで始まるものを除き、
  // 残りからランダムに一つを選んで返す。

  const s = [];
  gqSnap.allJson.nodes.forEach((n) => {
    const dir = n.parent.relativeDirectory;
    if (!dir.startsWith('_') && !dir.startsWith('NPC')) {
      s.push(dir);
    }
  });

  const i = Math.floor(Math.random() * s.length);
  return s[i];
}

const chatbotsQuery = graphql`
  query {
    allFile(
      filter: {sourceInstanceName: {eq: "botAvatar"}, ext: {eq: ".svg"}}
    ) {
      nodes {
        relativeDirectory
        name
        sourceInstanceName
      }
    }
    allJson {
      nodes {
        parent {
          ... on File {
            relativeDirectory
            name
            internal {
              content
            }
          }
        }
        description
      }
    }
  }
`;

const initialState = {
  botId: null,
  botState: 'init',
  numOfDeployed: 0,
  numOfModules: 0,
  botRepr: {
    displayName: '',
    avatarDir: 'default',
    avatar: 'null',
    backrgoundColor: '#cccccc',
    botId: null,
  },

  channel: null,
};

/**
 * useReducer
 * @param {object} state 直前のstate
 * @param {object} action stateに対する操作
 * @return {object} 新しいstate
 */
function reducer(state, action) {
  switch (action.type) {
    case 'setChannel': {
      return {
        ...state,
        channel: action.channel,
      };
    }

    case 'setBotId': {
      return {
        botId: action.botId,
        botState: 'init',
        numOfDeployed: 0,
        numOfModules: action.numOfModules,
        botRepr: {
          displayName: '',
          avatarDir: 'default',
          avatar: 'emerging',
          backrgoundColor: '#cccccc',
          botId: action.botId,
        },
        channel: state.channel,
      };
    }

    case 'deployed': {
      // 各moduleの計算が終了した
      // mainはavtarDir,backgroundColorも報告
      const deployed = state.numOfDeployed + 1;
      const completed = deployed === state.numOfModules;
      const botRepr = action.botRepr || state.botRepr;

      if (completed) {
        return {
          ...state,
          botState: 'deploying',
          numOfDeployed: deployed,
          botRepr: {
            ...botRepr,
            avatar: `emerging${deployed % 4}`,
          },
        };
      } else {
        return {
          ...state,
          botState: 'deployed',
          numOfDeployed: deployed,
          botRepr: {
            ...botRepr,
          },
        };
      }
    }

    case 'run': {
      return {
        ...state,
        botState: 'run',
      };
    }

    case 'changeAvatar': {
      return {
        ...state,
        botRepr: {
          ...state.botRepr,
          avatar: action.avatar,
        },
      };
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

/**
 * Biomebot Provider
 * @param {Object} props.firestore firestore object
 * @param {Boolean} props.summon チャットボットを強制的に起動する場合に指定
 * @param {string} props.schemeName 型式(relativeDir)を指定する場合(optional)
 * @param {React.ReactNode} props.children providerのchildren
 * @return {JSX.Element} ProviderへのI/Oを提供
 */
export default function BiomebotProvider({
  firestore,
  summon,
  schemeName,
  children,
}) {
  const auth = useContext(AuthContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const chatbotsSnap = useStaticQuery(chatbotsQuery);
  const mainWorkersMapRef = useRef({});
  const partWorkersRef = useRef([]);

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

  // --------------------------------------------------------------
  // チャットボットのdeploy
  //

  useEffect(() => {
    if (state.channel && auth.uid && firestore) {
      // schemeNameが指定されたらそれを使う。なければランダムにPCを選ぶ
      const currentSchemeName =
        schemeName || randomlyChoosePCScheme(chatbotsSnap);
      const botId = generateBotId(auth.uid, currentSchemeName);

      syncCache(
        firestore,
        chatbotsSnap,
        currentSchemeName,
        botId,
        auth.uid
      ).then((mods) => {
        dispatch({type: 'setBotId', botId: botId, numOfModules: mods.length});

        // はじめにmainModuleをdeployする。
        const mi = mods.indexOf('main');
        const newMain = new MainWorker();
        newMain.onmessage = function (event) {
          const action = event.data;
          dispatch(action);
          if (action.type === 'deployed') {
            // mainModuleのdeployが完了したらPartをdeployする
            // これによりmainのmemoryをpartが参照できる

            for (let i = 0; i < mods.length; i++) {
              if (i !== mi) {
                const newPart = new PartWorker();
                newPart.onmessage = function (event) {
                  const action = event.data;
                  dispatch(action);
                };
                newPart.postMessage({
                  type: 'deploy',
                  botId: botId,
                  moduleName: mods[i],
                });
                partWorkersRef.current.push(newPart);
              }
            }
          }
        };
        newMain.postMessage({type: 'deploy', botId: botId});
        mainWorkersMapRef.current = {[botId]: newMain};
      });
    }
  }, [state.channel, auth.uid]);

  // -----------------------------------------------------------
  // deployしたチャットボットの起動

  useEffect(() => {
    if (state.botState === 'deployed') {
      mainWorkersMapRef.current[state.botId].postMessage({
        type: 'run',
        summon: summon,
      });
      dispatch({type: 'run'});
    }
  }, [state.botId, state.botState]);

  return (
    <BiomebotContext.Provider
      value={{
        state: state,
        botRepr: state?.botRepr,
      }}
    >
      {children}
    </BiomebotContext.Provider>
  );
}
