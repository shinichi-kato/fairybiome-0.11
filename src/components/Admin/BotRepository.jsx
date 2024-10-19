/*
BotRepository
===================================
一つのチャットボットは複数のbotModulesからなり、このコンポーネント
ではbotModules単位ではなくチャットボット単位での管理を行う。

■ダウンロード
すべてのチャットボットの一覧を表示し、その中からひとつを
選んですべてのbotModulesをダウンロード

■追加アップロード
アップロードしたデータと同一のschemeNameを持つチャットボットの
一覧を表示し、そのなかから一つまたは複数の選択した対象にデータの
追加を行う。
この場合学習した内容は保持されアップロード元の非originデータは
アップロードされない。アップロード先にしか存在しないbotModuleは
残される。

■上書きアップロード
アップロードしたデータと同一のschemeNameを持つチャットボットの
一覧を表示し、その中から一つまたは複数の選択した対象にデータの
上書きを行う。
この場合学習した内容は破棄されアップロード元の全データが
アップロードされる。アップロード先にしか存在しないbotModulesは
削除される。

*/

import React, {useReducer, useEffect} from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';

const initialState = {
  users: {},
  botModules: [],
  items: [],
  mode: 'byScheme', // byScheme:一括, byUser:個別
};

function reducer(state, action) {
  switch (action.type) {
    case 'setUsers': {
      // users情報を使ってbotModulesのユーザ情報を追加
      let newBots = [];
      let newBot = {};

      for (let bot of state.botModules) {
        newBot = {...bot};
        const uid = bot.schemeName.slice(bot.schemeName.length);
        if (uid in action.users){
          newBot.user = action.users[uid];
        } else {
          newBot.user = {displayName: '', backgroundColor: '', avatarDir: ''}
        }
        newBots.push(newBot);
      }

      const items = newBots.map((bot) => {
        return (
          <ListItem>
            <ListItemText 
          </ListItem>
        )
      });

      return {
        ...state,
        users: action.users,
        botModules: newBots,
        items: items,
      };
    }

    case 'setBotModules': {
      // users情報を使ってbotModulesのユーザ情報を追加
      let newBots = [];
      let newBot = {};
      for (let bot of action.botModules) {
        newBot = {...bot};
        const uid = bot.schemeName.slice(bot.schemeName.length);
        if (uid in action.users){
          newBot.user = action.users[uid];
        } else {
          newBot.user = {displayName: '', backgroundColor: '', avatarDir: ''}
        }
        newBots.push(newBot);
      }
      return {
        ...state,
        botModules: newBots,
      };
    }
  }
}

export default function BotRepository({firebase, firestore}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // --------------------------------------------------
  // users情報の購読
  //

  useEffect(() => {
    let unsubscribe = null;
    if (firestore && !unsubscribe) {
      const usersRef = collection(firestore, 'users');

      unsubscribe = onSnapshot(usersRef, (snap) => {
        const ud = {};
        snap.forEach((doc) => {
          ud[doc.id] = doc.data();
        });
        dispatch({type: 'setUsers', users: ud});
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [dispatch, firestore]);

  // --------------------------------------------------
  // botModulesの購読
  //

  useEffect(() => {
    let unsubscribe = null;
    if (firestore && !unsubscribe) {
      const modRef = collection(firestore, 'botModules');

      unsubscribe = onSnapshot(modRef, (snap) => {
        const l = [];
        snap.forEach((doc) => {
          const d = doc.data();
          l.push(d);
        });
        dispatch({type: 'setBotModules', botModules: l});
      });
    }
  }, [firestore, dispatch]);

  return <List></List>;
}
