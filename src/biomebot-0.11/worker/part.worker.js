/*
biomebot part worker
==================================

part workerはチャットボットの各会話出力を行う

# 起動の手順

## 1. インスタンス生成

providerは起動するbotIdを決め、syncCache()を行って
indexedDB上に最新のbotModulesが存在する状態にする。
完了したらbotIdで指定されたmain worker, part workersをインスタンス化する。

## 2 provider -> 全worker {type: 'deploy'}

tfidf計算を開始する。完了したら{type:'deployed'}を発行する。

## 3. 全worker -> provider {type: 'deployed'}

providerは全てのpartがdeployedになるまで待つ。
deployedが発行されるたびavatarを適宜変更して動作中であることを表現する。
全てのpartがdeployedになったら4へ

## 4. provider -> main {type: 'run', summon:summon}
main はsummonが指定されていた場合{ON_SUMMON}、そうでない場合{ON_START}
から選んだpartを起動するコマンド{type:'activate', part:'partName'}を
発行する。これにより、初期に眠っている、不在、挨拶するなどの動作ができる。

## 5. provider -> main worker {type: 'input', message:message}


*/
import {part} from './part.core';

onmessage = (event) => {
  const action = event.data;
  console.log('partWorker recieved', action);
  switch (action.type) {
    case 'deploy': {
      part.deploy(action).then((result) => {
        if (result) {
          postMessage({type: 'deployed'});
        } else {
          postMessage({type: 'deployError', moduleName: part.moduleName});
        }
      });

      break;
    }

    case 'kill': {
      part.kill();
      break;
    }

    default:
      throw new Error(`partWorker: invalid action ${action.type}`);
  }
};
