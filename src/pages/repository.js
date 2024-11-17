/*
Editor画面
=======================================
チャットボットの辞書データはstaticから提供される組み込みのものだけ
でなく、 任意のデータをアップロードすることでも提供できるようにしたい。
その際複数のユーザに対して送信できると管理が用意になるため、この画面は
管理者のパスワードを必要とする。管理者の ユーザ名、パスワードは
.env.localまたはgithub上のSECRETSを利用して提供する。
.env.localのみにそれらを定義すればdevelopmentインスタンスのみから
制御可能になる。SECRETSに定義すれば外部からも実行可能になる。

firestorer上のデータに対する、
1. チャットボットとユーザ一覧
2. チャットボットの削除
3. チャットボット＋ユーザの削除
4. 選択したチャットボットに対する辞書データの一括アップロード
5. チャットボット辞書データの一括ダウンロード

*/

import React, { useEffect, useReducer } from 'react';
import { graphql } from 'gatsby';

import useFirebase from '../useFirebase';
import {
  collection,
  query,
  where,
  // getDocs,
  onSnapshot,
} from 'firebase/firestore';

import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

import AuthProvider from '../components/Auth/AuthProvider';
import AdminAuth from '../components/Admin/AdminAuth';
import SettingsItem from '../components/Repository/SettingsItem';
import BotDownload from '../components/Repository/BotDownload';
import BotUpload from '../components/Repository/BotUpload';

const initialState = {
  mainModules: [],
  users: {},
  page: null,
};

function reducer(state, action) {
  console.log(action);
  switch (action.type) {
    case 'loadMainModules': {
      let mains = [];
      // 各ボットのidと外見情報のみ取得。
      // usersデータがあれば紐付ける
      for (let main of action.mainModules) {
        const d = main.data;
        const uid = d.botId.slice(d.schemeName.length);
        mains.push({
          fsId: main.id,
          botId: d.botId,
          uid: uid,
          schemeName: d.schemeName,
          updatedAt: d.updatedAt,
          avatarDir: d.avatarDir,
          backgroundColor: d.backgroundColor,
          userProps: uid in state.users ? state.users[uid] : {
            displayName: 'deleted user',
            backgroundColor: '',
            avatarDir: 'deleted_user'
          }
        })
      }
      return {
        ...state,
        mainModules: mains
      }
    }

    case 'loadUsers': {
      let mains = [];
      for (let main of state.mainModules) {
        mains.push({
          ...main,
          userProps: main.uid in action.users ? action.users[main.uid] : {
            displayName: 'deleted user',
            backgroundColor: '',
            avatarDir: 'deleted_user'
          }
        });
      }
      return {
        ...state,
        users: action.users,
        mainModules: mains
      }
    }

    case 'changePage': {
      return {
        ...state,
        page: action.page
      }
    }

    default:
      throw new Error(`invalid action ${action.type}`)
  }

}

export default function RepositoryPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [firebase, firestore] = useFirebase();

  // ----------------------------------------------------------
  // 名前がmainであるbotModuleの購読
  //

  useEffect(() => {
    let unsubscribe = null;
    if (firestore && !unsubscribe) {
      const q = query(
        collection(firestore, 'botModules'),
        where('moduleName', '==', 'main')
      );

      unsubscribe = onSnapshot(q, (snap) => {
        const l = [];
        snap.forEach((doc) => {
          l.push({
            id: doc.id,
            data: doc.data()
          })
        });
        dispatch({ type: 'loadMainModules', mainModules: l });
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


  function handleChangePage(page) {
    dispatch({ type: 'changePage', page: page })
  }

  function handleBack() {
    dispatch({ type: 'changePage', page: null })
  }
  const page = state.page;

  return (
    <Container maxWidth='xs' disableGutters sx={{ height: '100vh', backGoundColor: '#dddddd' }}>
      <AuthProvider firebase={firebase} firestore={firestore}>
        <AdminAuth >
          {
            page === 'download' ?
              <BotDownload
                repoState={state}
                firestore={firestore}
                handleBack={handleBack}
              /> :
              page === 'append' ?
                <BotUpload
                  how='appwnd'
                  repoState={state}
                  firestore={firestore}
                  handleBack={handleBack}
                /> :
                page === 'overwrite' ?
                  <BotUpload
                    how='overwrite'
                    repoState={state}
                    firestore={firestore}
                    handleBack={handleBack}
                  /> :
                  <Box sx={{ p: 1, backgroundColor: '#eeeeee' }}>
                    <Box sx={{ p: 1, backgroundColor: '#cccccc' }}>FairyBiome Repository Control</Box>

                    <SettingsItem title="ダウンロード"
                      text={["チャットボットの一覧を表示し、そのうちの一つを選んでデータをダウンロードします"]}
                      handleClick={() => handleChangePage('download')}
                    />
                    <SettingsItem title="追加アップロード"
                      text={["ユーザとそのチャットボットの一覧を表示し、追加アップロードを行うユーザを一つまたは複数選択します。",
                        "選択したユーザに対してデータをアップロードします。このチャットボットをユーザが保有していない場合は",
                        "新規のデータがアップロードされ、ユーザが同じschemeNameのチャットボットを保有している場合",
                        "ユーザの学習データは温存され、アップロード元の非originデータはアップロードされません。",
                        "アップロード元にないbotModuleは温存されます。"]}
                      handleClick={() => handleChangePage('append')}
                    />
                    <SettingsItem title="上書ダウンロード"
                      text={["ユーザとそのチャットボットの一覧を表示し、上書きアップロードを行うユーザを一つまたは複数選択します。",
                        "選択したユーザに対してデータをアップロードします。このチャットボットをユーザが保有していない場合は",
                        "新規のデータがアップロードされ、ユーザがすでに同じschemeNameのチャットボットを保有している場合",
                        "ユーザの学習データは破棄され、アップロード元にないbotModuleは削除されます。"]}
                      handleClick={() => handleChangePage('overwrite')}
                    />

                  </Box>
          }
        </AdminAuth>
      </AuthProvider>
    </Container >
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