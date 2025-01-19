import React, {useEffect, useReducer} from 'react';
import Grid from '@mui/material/Grid2';

import {downloadFsModule} from '../../biomebot-0.11/botIO2';
import FairyPanel from '../../components/Panel/FairyPanel';

const RE_BOT_NAME = /^\{BOT_NAME\}\s+(.+)$/;

const initialState = {
  botId: null,
  modules: {},
  schemeName: '',
  botRepr: {
    displayName: '',
    avatarDir: 'default',
    avatar: 'loading',
    backrgoundColor: '#cccccc',
    description: '',
    author: '',
    botId: null,
  },
};

function reducer(state, action) {
  switch (action.type) {
    case 'loadModule': {
      const m = state.modules;
      const d = action.moduleData;
      console.log(action);
      m[action.moduleName] = {...d};
      if (action.moduleName === 'main') {
        const dm = d[''];
        let displayName = 'undefined';
        for (const line of d.memory) {
          const match = line.match(RE_BOT_NAME);
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
            author: dm.author,
            backgroundCOlor: dm.backgroundColor,
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
      };
    }
  }
}

export default function BotProperties({instance, firestore}) {
  /*チャットボットの詳細表示

  */
  const [state, dispatch] = useReducer(reducer, initialState);
  console.log(instance);

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
        dispatch({type: 'loadCompleted', botId: instance.botId});
      });
    }
  }, [firestore, state.botId]);

  return (
    <Grid container spacing={2}>
      <Grid size={12}>
        <FairyPanel repr={state.botRepr} />
      </Grid>
      <Grid size={4}>SchemeName</Grid>
      <Grid size={8}></Grid>
      <Grid size={4}>説明</Grid>
      <Grid size={8}>{state.description}</Grid>
    </Grid>
  );
}
