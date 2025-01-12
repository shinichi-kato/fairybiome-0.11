import React, { useEffect, useReducer } from 'react';
import { graphql } from 'gatsby';
import Container from '@mui/material/Container';

import useFirebase from '../useFirebase';
import AuthProvider from '../components/Auth/AuthProvider';
import AdminAuth from '../components/Admin/AdminAuth';
import ListByScheme from '../components/Admin/ListBySchemes';


import {
  collection,
  query,
  // where,
  // getDocs,
  onSnapshot,
} from 'firebase/firestore';

const initialState = {
  chatbots: [],
  groupedByScheme: [],
  users: {},
  page: 'groupByScheme'
};

function reducer(state, action) {
  console.log(action);
  switch (action.type) {
    case 'loadChatbots': {
      // Schemeごとのデータ生成
      const botsByScheme = {};
      for (const bot of action.chatbots) {
        if (bot.schemeName in botsByScheme) {
          botsByScheme[bot.schemeName].push({
            botId: bot.id,
            userId: bot.userId,
            avatarDir: bot.avatarDir,
          });
        }
      }

      // chatbotsデータにユーザ名があれば紐付ける
      const chatbots = [];
      for (const bot of action.chatbots) {
        chatbots.push({
          ...bot,
          userProps:
            bot.userId in state.users
              ? state.users[bot.userId]
              : {
                displayName: 'loading',
                backgroundColor: '',
                avatarDir: 'unknown_user_avatar',
              },
        });
      }

      return {
        ...state,
        chatbots: chatbots,
        groupedByScheme: botsByScheme,
      };
    }

    case 'loadUsers': {
      // chatbotsがあればユーザの情報を紐付け
      let chatbots = [];
      for (const bot of state.chatbots) {
        chatbots.push({
          ...bot,
          userProps:
            bot.userId in action.users
              ? action.users[bot.userId]
              : {
                displayName: 'not found',
                backgroundColor: '',
                avatarDir: 'unknown_user_avatar',
              },
        });
      }

      return {
        ...state,
        chatbots: chatbots,
        users: action.users,
      };
    }
  }
}

/*Adminページ
参加全ユーザのチャットボットデータをupload/download/削除できる。
管理者はこのfirestoreにアカウントを持っていることが必要条件で、
さらに管理者のパスワードを入力することで管理者モードに入れる。
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

  // ---------------------------------------------------------

  return (
    <Container maxWidth='lg' disableGutters sx={{ height: '100vh', backGoundColor: '#dddddd' }}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <AdminAuth >
          {state.page === 'groupByScheme' &&
            <ListByScheme items={state.groupByScheme} />
          }

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