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
  useCallback,
} from 'react';
import {useStaticQuery, graphql} from 'gatsby';
import {collection, addDoc /*serverTimestamp*/} from 'firebase/firestore';

import {AuthContext} from '../components/Auth/AuthProvider';
import {syncCache, findDefaultBotId} from './botio';

import MainWorker from './worker/main.worker';
import PartWorker from './worker/part.worker';

export const BiomebotContext = createContext();

const biomebotQuery = graphql`
  query {
    allFile(
      filter: {
        sourceInstanceName: {in: ["userAvatar", "botAvatar"]}
        ext: {eq: ".svg"}
      }
    ) {
      nodes {
        relativeDirectory
        name
        sourceInstanceName
      }
    }
    allJson {
      nodes {
        token {
          values
          type
        }
        parent {
          ... on File {
            relativeDirectory
            name
            internal {
              content
              description
            }
            sourceInstanceName
          }
        }
      }
    }
  }
`;

const getChatbotSnap = (biomebotSnap) => {
  const snap = [];
  biomebotSnap.allJson.nodes.forEach((node) => {
    const p = node.parent;
    if (
      p.sourceInstanceName === 'botModules' &&
      p.relativeDirectory !== '_loading'
    ) {
      snap.push(node.parent);
    }
  });
  return snap;
};

const getTokenSnap = (biomebotSnap) => {
  const snap = [];
  biomebotSnap.allJson.nodes.forEach((node) => {
    if (node.parent.sourceInstanceName === 'token') snap.push(node.token);
  });
  return snap;
};

const getValidBotAvatars = (biomebotSnap, avatarDir) => {
  const avatars = [];
  for (const node of biomebotSnap.allFile.nodes) {
    if (
      node.relativeDirectory === avatarDir &&
      node.sourceInstanceName === 'botAvatar'
    ) {
      avatars.push(node.name);
    }
  }
  return avatars;
};

const getShapeShifterAvatarDirs = (biomebotSnap) => {
  const snap = [];
  biomebotSnap.allFile.nodes.forEach((node) => {
    const d = node.relativeDirectory;
    if (
      d.startsWith('_') &&
      node.sourceInstanceName === 'userAvatar' &&
      node.name === 'peace'
    ) {
      snap.push(d);
    }
  });
  return snap;
};

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
    replyingCount: 0,
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
  // console.log(action.type, action);
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
          replyingCount: 0,
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
          botState: 'deployed',
          numOfDeployed: deployed,
          botRepr: {
            ...botRepr,
          },
        };
      } else {
        return {
          ...state,
          botState: 'deploying',
          numOfDeployed: deployed,
          botRepr: {
            ...botRepr,
            avatar: `emerging${deployed % 4}`,
          },
        };
      }
    }

    case 'deployError': {
      return {
        ...state,
        botState: `error in ${action.moduleName}`,
      };
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

    case 'replying': {
      const br = state.botRepr;
      return {
        ...state,
        botState: 'replying',
        botRepr: {
          ...br,
          replyingCount: ((br.replyingCount + 1) % 3) + 1,
        },
      };
    }

    case 'reply': {
      const m = action.message;
      return {
        ...state,
        botState: 'run',
        botRepr: {
          ...state.botRepr,
          displayName: m.displayName,
          avatarDir: m.avatarDir,
          avatar: m.avatar,
          replyingCount: 0,
        },
      };
    }

    case 'shapeShift': {
      return state;
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
  const mainWorkersMapRef = useRef({});
  const partWorkersRef = useRef([]);
  const logRef = collection(firestore, 'users', auth.uid, 'log');
  const biomebotSnap = useStaticQuery(biomebotQuery);

  const writeLog = useCallback(
    (message) => {
      addDoc(logRef, message).then(() => {
        if (message.kind === 'user') {
          mainWorkersMapRef.current[state.botId].postMessage({
            type: 'input',
            message: message,
          });
        }
      });
    },
    [firestore, auth.uid, logRef]
  );

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
      (async () => {
        const chatbotSnap = getChatbotSnap(biomebotSnap);
        const [botId, targetSchemeName] = await findDefaultBotId(
          auth.uid,
          schemeName,
          chatbotSnap
        );

        // データの同期
        const mods = await syncCache(
          firestore,
          {
            chatbot: chatbotSnap,
            token: getTokenSnap(biomebotSnap),
          },
          targetSchemeName,
          botId,
          auth.uid
        );
        dispatch({type: 'setBotId', botId: botId, numOfModules: mods.length});

        // はじめにmainModuleをdeployする。
        const mi = mods.indexOf('main');
        const newMain = new MainWorker();
        newMain.onmessage = function (event) {
          const action = event.data;
          dispatch(action);
          switch (action.type) {
            case 'reply': {
              writeLog(action.message);
              return;
            }

            case 'deployed': {
              // mainModuleのdeployが完了したらPartをdeployする
              // これによりmainのmemoryをpartが参照できる
              const validAvatars = getValidBotAvatars(
                biomebotSnap,
                action.botRepr.avatarDir
              );
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
                    validAvatars: validAvatars,
                  });
                  partWorkersRef.current.push(newPart);
                }
              }
              break;
            }

            case 'shapeShift': {
              const dirs = getShapeShifterAvatarDirs(biomebotSnap);
              const index = Math.floor(Math.random() * dirs.length);

              auth.shapeShift(dirs[index]);
            }
          }
        };
        newMain.postMessage({type: 'deploy', botId: botId, summon: summon});
        mainWorkersMapRef.current = {[botId]: newMain};
      })();
    }

    return () => {
      for (const botId in mainWorkersMapRef.current) {
        if (Object.hasOwn(mainWorkersMapRef.current, botId)) {
          mainWorkersMapRef.current[botId].postMessage({type: 'kill'});
        }
      }
    };
  }, [state.channel, auth.uid]);

  // -----------------------------------------------------------
  // deployしたチャットボットの起動

  useEffect(() => {
    if (state.botState === 'deployed') {
      mainWorkersMapRef.current[state.botId].postMessage({
        type: 'run',
        user: auth.user,
      });
      dispatch({
        type: 'run',
      });
    }
  }, [state.botId, state.botState]);

  /**
   * ユーザがキー入力中なことをbotのmainに通知
   */
  const handleUserKeyTouch = useCallback(() => {
    mainWorkersMapRef.current[state.botId].userKeyTouch();
  }, [state.botId]);

  return (
    <BiomebotContext.Provider
      value={{
        state: state,
        botRepr: state?.botRepr,
        userKeyTouch: handleUserKeyTouch,
        writeLog: writeLog,
      }}
    >
      {children}
    </BiomebotContext.Provider>
  );
}
