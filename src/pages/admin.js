import React, { useEffect, useReducer } from 'react';
import { navigate, graphql } from 'gatsby';
import Container from '@mui/material/Container';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIos';

import useFirebase from '../useFirebase';
import AuthProvider from '../components/Auth/AuthProvider';
import AdminAuth from '../components/Admin/AdminAuth';
import ListByScheme from '../components/Admin/ListBySchemes';
import ListByInstances from '../components/Admin/ListByInstances';
import BotProperty from '../components/Admin/BotProperty'


import {
  collection,
  query,
  // where,
  // getDocs,
  onSnapshot,
} from 'firebase/firestore';

const initialState = {
  schemes: null, // 全チャットボットデータをscheme単位で集計
  instances: null, // 全ユーザについてそれぞれ紐付いたinstance
  users: null,
  chatbots: null,
  page: 'schemes',
  appTitle: 'ロード中...',
  targetScheme: null,
  taregtUserId: null,
};

function reducer(state, action) {
  console.log(action);
  switch (action.type) {
    case 'loadChatbots': {
      // Schemeごとのデータ生成
      const schemes = {};
      for (const bot of action.chatbots) {
        const botData = bot.data;
        if (!(botData.schemeName in schemes)) {
          schemes[botData.schemeName] = [];
        }
        schemes[botData.schemeName].push({
          botId: bot.id,
          userId: botData.userId,
          avatarDir: botData.avatarDir,
          index: botData.index
        });
      }

      // usersデータがある場合、チャットボットのデータを
      // instancesに紐付ける。
      // instancesは
      // instances={schemeName: {userId: instance }}
      // という形式で格納
      const instances = {};
      if (state.users) {
        // 特定のschemeNameのインスタンスを保持していないユーザも
        // リストに表示し、uploadableにするため全scheme全ユーザの
        // 初期データを与える 
        for (const schemeName in schemes) {
          if (!(schemeName in instances)) {
            instances[schemeName] = {}
          }

          for (const userId in state.users) {
            instances[schemeName][userId] = {
              botId: null,
              avatarDir: null,
              index: null,
            };
          }

          // 各instanceで上書き
          for (const bot of action.chatbots) {
            const botData = bot.data;
            instances[botData.schemeName][botData.userId] = {
              botId: bot.id,
              index: botData.index,
              avatarDir: botData.avatarDir,
            }
          }
        }
      }
      return {
        ...state,
        instances: instances,
        schemes: schemes,
        chatbots: [...action.chatbots],
        page: 'schemes',
        appTitle: '全チャットボットのリスト'
      };
    }

    case 'loadUsers': {

      // schemesデータがある場合、チャットボットのデータを
      // instancesに紐付ける。
      // instancesは
      // instances={schemeName: {userId: instance }}
      // という形式で格納
      const instances = {};
      if (state.schemes) {
        // 特定のschemeNameのインスタンスを保持していないユーザも
        // リストに表示し、uploadableにするため全scheme全ユーザの
        // 初期データを与える 
        for (const schemeName in state.schemes) {
          if (!(schemeName in instances)) {
            instances[schemeName] = {}
          }

          // 全ユーザの空リスト(schemeNameを持っていないユーザも対象)
          for (const userId in action.users) {
            instances[schemeName][userId] = {
              botId: null,
              avatarDir: null,
              index: null,
            };
          }

          // 各instanceで上書き
          for (const bot of state.chatbots) {
            const botData = bot.data;
            instances[botData.schemeName][botData.userId] = {
              botId: bot.id,
              index: botData.index,
              avatarDir: botData.avatarDir
            }
          }
        }
      }
      return {
        ...state,
        instances: instances,
        users: action.users,
      };
    }

    case 'toSchemes': {
      return {
        ...state,
        page: 'schemes',
        appTitle: '全チャットボットのリスト',
        targetSchemeInstance: null
      }
    }

    case 'toInstances': {
      const target = action.targetScheme ? action.targetScheme.schemeName : state.targetScheme;
      return {
        ...state,

        page: 'instances',
        appTitle: `チャットボット ${target} のリスト`,
        targetScheme: target
      }
    }

    case 'toBotProperty': {
      return {
        ...state,
        page: 'botProperty',
        appTitle: 'チャットボットの詳細',
        targetUserId: action.targetUserId
      }
    }

  }
}

/*Adminページ
参加全ユーザのチャットボットデータをupload/download/削除できる。
管理者はこのfirestoreにアカウントを持っていることが必要条件で、
さらに管理者のパスワードを入力することで管理者モードに入れる。

schemes画面ではschemeごとにインスタンスを集計した数をリスト表示し、
その中から一つを選びinstances画面に遷移する。

instances画面では選択したschemeについてユーザごとに使用/不使用の
状況をリスト表示する。その中から一つを選びinstance画面に遷移する。
またこの画面は複数のインスタンスを選択することができ、選択中は
一括アップロードが可能になる。

instance画面では選択したinstanceの詳細を表示し、upload/downloadの
ボタンを表示する。

*/
export default function AdminPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [firebase, firestore] = useFirebase();

  // ----------------------------------------------------------------
  // chatbotsの購読
  //

  useEffect(() => {
    let unsubscribe = null;
    if (firestore && !unsubscribe) {
      const q = query(collection(firestore, 'chatbots'));

      unsubscribe = onSnapshot(q, (snap) => {
        const l = [];
        snap.forEach((doc) => {
          l.push({
            id: doc.id,
            data: doc.data(),
          });
        });
        dispatch({ type: 'loadChatbots', chatbots: l });
      });
    }
  }, [firestore, dispatch]);

  // ----------------------------------------------------------
  // user情報の購読
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
        dispatch({ type: 'loadUsers', users: ud });
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [dispatch, firestore]);


  // instances画面へ
  function toInstances(item) {
    dispatch({ type: 'toInstances', targetScheme: item });
  }

  // 一つのボットの詳細画面へ
  function toBotProperty(userId) {
    dispatch({ type: 'toBotProperty', targetUserId: userId });
  }

  function handleClickBack() {
    switch (state.page) {
      case 'schemes': {
        // index.jsに戻る
        navigate('/');
        return
      }

      case 'instances': {
        dispatch({ type: 'toSchemes' });
        return
      }

      case 'botProperty': {
        dispatch({ type: 'toInstances' });
      }
    }
  }

  return (
    <Container maxWidth='lg' disableGutters sx={{ height: '100vh', backGoundColor: '#dddddd' }}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <AdminAuth >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
            }}
          >
            <Box>
              <AppBar position="static">
                <Toolbar>
                  <IconButton
                    size="large"
                    edge="start"
                    color="inherit"
                    aria-label="menu"
                    sx={{ mr: 2 }}
                    onClick={handleClickBack}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    {state.appTitle}
                  </Typography>
                </Toolbar>
              </AppBar>
            </Box>
            {state.page === 'schemes' &&
              <ListByScheme schemes={state.schemes} toInstances={toInstances} />
            }
            {state.page === 'instances' &&
              <ListByInstances
                instances={state.instances[state.targetScheme]}
                users={state.users}
                toBotProperty={toBotProperty}
              />
            }
            {state.page === 'botProperty' &&
              <BotProperty
                firestore={firestore}
                schemeName={state.targetScheme}
                instance={state.instances[state.targetScheme][state.targetUserId]}
              />
            }
          </Box>
        </AdminAuth>
      </AuthProvider>
    </Container>
  )
}

export const Head = ({ data }) => (
  <>
    <html lang='ja' />
    <title>{data.site.siteMetadata.title}</title>
  </>
);

export const pageQuery = graphql`
  query IndexPageQuery {
    site {
      siteMetadata {
        title
      }
    }
  }
`;