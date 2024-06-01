/*
BiomebotProvider

<BiomebotProvider 
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
あり          チャットボットが現れた状態から始まる
なし          チャットボットが現るかはチャットボットが決める
              現れない場合は声をかければ現れる
------------------------------------------------------------------



biomebot実体はweb workerである。これらの起動・終了を管理しユーザ入力のI/Oを
行う。

mainWorkerMapRef: {
  botId: new mainWorker()
}

partWorkersMapRef: {
  botId: [new partWorker(), ...]
}


*/

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useStaticQuery, graphql } from "gatsby";

import MainWorker from './worker/main.worker';

export const BiomebotContext = createContext();

function generateBotId(userId,schemeName) {
  // userIdをベースにbotIdを生成する。
  // NPCボットはユーザに帰属しないのでschemeNameそのまま

  if(schemeName.startsWith('NPC')){
    return schemeName;
  }else {
    return `${schemeName||"bot"}${userId||""}`;
  }
}

function randomlyChoosePCScheme(gqSnap){
  // gqSnapからrelativeDirectory(=schemeName)を集め、
  // それらの中からNPCで始まるものを除き、
  // 残りからランダムに一つを選んで返す。

  let s = [];
  data.allJson.nodes.forEach(node=>{
    let dir = n.parent.relativeDirectory;
    if(dir !== 'summoning' && !dir.startsWith('NPC')){
      s.push(dir)
    }
  });

  let i = Math.floor(Math.random()*s.length)
  return s[i]
}

const chatbotsQuery = graphql`
query {
  allFile(filter: {sourceInstanceName: {eq: "botAvatar"}, ext: {eq: ".svg"}}) {
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
}`;

const initialState = {
  botId: null,
  summoned: false,
  botPanel: {
    schemeName: null,
    avatar: "",
    backrgoundColor: "#cccccc",
  },

  channel: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'setChannel': {
      return {
        ...state,
        channel: action.channel
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

export default function BiomebotProvider(
  { firestore, summon, schemeName, children }
) {
  const auth = useContext(AuthContext);
  const [state, dispatch] = useReducer(reducer, initialState);
  const chatbotsSnap = useStaticQuery(chatbotsQuery);
  const mainWorkersMapRef = useRef({});
  const partWorkersRef = useRef([]);

  //---------------------------------------------------
  // broadcast channelの初期化
  //

  useEffect(() => {
    let ch;
    if (!state.channel) {
      ch = new BroadcastChannel('biomebot');
      dispatch({ type: 'setChannel', channel: ch });
    }
    return () => {
      if (ch) {
        ch.close();
      }
    }

  }, [state.channel]);

  //--------------------------------------------------------------
  // チャットボットの起動
  // 

  useEffect(() => {
    if(state.channel && auth.uid){
      // schemeNameが指定されたらそれを使う。なければランダムにPCを選ぶ
      let currentSchemeName = schemeName || randomlyChoosePCScheme(chatbotsSnap);
      let botId = generateBotId(auth.uid, currentSchemeName);

      let modules = []

      syncCache(firestore, chatbotsSnap, currentSchemeName, botId, auth.uid)
      .then((mods)=>{
        for(let mod of mods){
          if('mod' === 'main.json'){
            const newMain = new MainWorker(botId);
            newMain.onmessage = function (event) {
              const action = event.data;
              dispatch(action);
              // changeBotPanel(action)
            }
            mainWorkersMapRef.current = { [botId]: newMain };
          } else{
            const newPart = new PartWorker(botId,mod);
            newPart.onmessage=function(event){
              const action=event.data;
              dispatch(action);
            }
            partWorkersRef.current.push(newPart);
          }

        }

        mainWorkersMapRef.current[botId].postMessage({
          type:'standby'
        })
      })
    }
  }, [state.channel, auth.uid]);


  return (
    <BiomebotContext.Provider>
      {children}
    </BiomebotContext.Provider>
  )
}
