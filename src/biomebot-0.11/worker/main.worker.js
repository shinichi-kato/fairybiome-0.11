/*
biomebot main worker
==================================

main workerは起動するチャットボットの選択、データ要求、起動から
チャットボットの動作までを管理する。


# 起動の手順

## 1. syncCache()

providerは起動するbotIdを決め、syncCache()を行って
indexedDB上に最新のbotModulesが存在する状態にする。
完了したらbotIdで指定されたmain worker, part workersをインスタンス化する。

## 2. provider -> main worker {type: 'standby', botId:botId}

main workerはboradcastチャンネルを作ってユーザ入力を受付開始。
providerに{type: 'changeAvatar', avatar: avatar}を送る
main partは初期状態で現れるかそうでないかをランダムに選ぶ。
現れていない場合、ユーザが名前を呼ぶ、または声をかけるなど「召喚」に
当たる発言をしたら3に進む。

## 2a. provider -> main worker {type: 'summon',botId:botId}

providerは summon コマンドを使うことで強制的に召喚された状態で
始めることができる。
main workerはsummonを受け取ったら3に進む

## 3. main worker -> 全worker {type: 'deploy', botId:botId}

各partはtfidf計算を実行し、計算が完了したら{type: 'deployed', moduleName, botId}
を送る。

## 4. ALL WORKERS -> provider {type: 'deployed'}
全workerがdeployedしたことを確認したら5に進む

## 5. provider -> main worker {type: 'run'}
main workerは返答統合管理を開始。

## 6. provider -> main worker {type: 'input', message:message}


*/
import {main} from './main.core';

onmessage = (event) => {
  const action =event.data;
  console.log("mainWorker recieved",action)
  switch(action.type){
    case 'standby': {
      const r = main.standby(action);
      postMessage({type:'standby', ...r})
    }
    case 'deploy': {
      const r = main.deploy(action);
      postMessage({type:'deployed', kind: 'main', ...r});
      break;
    }

    case 'run': {
      main.run();
      break;
    }

    case 'input': {
      main.recieve(action);
      break;
    }

    case 'kill': {
      main.kill();
      break;
    }

    default:
      throw new Error(`mainWorker: invalid action ${action.type}`);
  } 
}