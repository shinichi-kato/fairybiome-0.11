import React, {useEffect, useReducer} from 'react';
import JSZip from 'jszip';

import Grid from '@mui/material/Grid2';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';

import {downloadFsModule} from '../../biomebot-0.11/botIO2';
import FairyPanel from '../../components/Panel/FairyPanel';

const RE_BOT_NAME = /^\{BOT_NAME\}\s+(.+)$/;

function scriptify(module) {
  /*{memory,origin,page0}で与えられたデータを
  一つの文字列に復元する。
  */
  const s = {};
  for (const pn in module) {
    const page = module[pn];
    for (const ln in page) {
      s[ln] = page[ln];
    }
  }
  const keys = Object.keys(s).sort((a, b) => a - b);
  const script = [];
  for (const k of keys) {
    script.push(s[k]);
  }

  return script.join('\n');
}

function jsonTextify(module) {
  /* mainページの内容をjsonテキストに変換*/
  const obj = {};
  obj = {
    ...module[''],
  };
}

const initialState = {
  botId: null,
  modules: {},
  schemeName: '',
  botRepr: {
    displayName: '',
    avatarDir: 'default',
    avatar: 'loading',
    backgroundColor: '#cccccc',
    description: '',
    author: '',
    botId: null,
  },
};

function reducer(state, action) {
  console.log(action);
  switch (action.type) {
    case 'loadModule': {
      const m = state.modules;
      const d = action.moduleData;

      m[action.moduleName] = {...d};
      if (action.moduleName === 'main') {
        const dm = d[''];
        let displayName = 'undefined';
        for (const lineNum in d.memory) {
          const match = d.memory[lineNum].match(RE_BOT_NAME);
          if (match) {
            displayName = match[1];
            break;
          }
        }
        return {
          ...state,
          botRepr: {
            ...state.botRepr,
            description: dm.description,
            avatarDir: dm.avatarDir,
            avatar: 'peace',
            author: dm.author,
            backgroundColor: dm.backgroundColor,
            displayName: displayName,
          },
        };
      }

      return {
        ...state,
        modules: m,
      };
    }

    case 'loadCompleted': {
      return {
        ...state,
        botId: action.botId,
        schemeName: action.schemeName,
      };
    }
  }
}

export default function BotProperties({schemeName, instance, firestore}) {
  /*チャットボットの詳細表示

  instance: {
   avatarDir, botId,
   index:{
     scriptName: {
       memory: {seconds},
       origin: {seconds},
       page0: {seconds}
     }
   }
  }

  state.modules: {
    scriptName: {
      memory: {1: 'line1', 3: 'line 3'...},
      origin: {0: 'line0', ...},
      page0: {}
    }
  }

  * スクリプトのエクスポート
  mainはjson形式で出力する。それ以外はテキスト形式。

  */
  const [state, dispatch] = useReducer(reducer, initialState);
  console.log(instance);

  // --------------------------------------------------
  // download from firestore
  //

  useEffect(() => {
    if (state.botId !== instance.botId && firestore) {
      const promises = Object.keys(instance.index).map(async (modName) => {
        dispatch({
          type: 'loadModule',
          moduleName: modName,
          moduleData: await downloadFsModule(
            firestore,
            instance.botId,
            modName
          ),
        });
      });
      Promise.allSettled(promises).then(() => {
        dispatch({
          type: 'loadCompleted',
          botId: instance.botId,
          schemeName: schemeName,
        });
      });
    }
  }, [firestore, state.botId]);

  console.log(state);
  // --------------------------------------------

  function handleDownload() {
    // 全ファイルをzip化してブラウザからダウンロードさせる
    const zip = new JSZip();
    for (const moduleName in state.modules) {
      const timestamp = new Date(instance.index[moduleName].seconds * 1000);
      const data = scriptify(state.modules);
    }
  }

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <Container>
          <FairyPanel repr={state.botRepr} />
        </Container>
      </Grid>
      <Grid size={3}>SchemeName</Grid>
      <Grid size={9}>{state.schemeName}</Grid>
      <Grid size={3}>説明</Grid>
      <Grid size={9}>{state.botRepr.description}</Grid>
      <Grid size={3}>作者</Grid>
      <Grid size={9}>{state.botRepr.author}</Grid>
      <Grid size={4}>
        <Button>アップロード</Button>
      </Grid>
      <Grid size={4}>
        <Button onClick={handleDownload} disabled={!state.botId}>
          ダウンロード
        </Button>
      </Grid>
    </Grid>
  );
}
