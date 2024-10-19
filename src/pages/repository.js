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

import React, { useState } from 'react';
import { graphql } from 'gatsby';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';


import AdminAuth from '../components/Admin/AdminAuth';
import CardButton from '../components/Repository/CardButton';
import BotDownload from '../components/Repository/BotDownload';
import BotUpload from '../components/Repository/BotUpload';
import useFirebase from '../useFirebase';

export default function EditorPage() {
  const [firebase, firestore] = useFirebase();
  const [page, setPage] = useState(null);
  console.log(page)
  function handleToPage(page) {
    setPage(page)
  }

  return (
    <Container maxWidth='xs' disableGutters sx={{ height: '100vh', backGoundColor: '#dddddd' }}>
      <AdminAuth >
        {
          page === 'download' ? <BotDownload firestore={firestore} /> :
            page === 'append' ? <BotUpload how='appwnd' firestore={firestore} /> :
              page === 'overwrite' ? <BotUpload how='overwrite' firestore={firestore} /> :
                <Box sx={{ p: 1, backgroundColor: '#eeeeee' }}>
                  <CardButton title="ダウンロード"
                    text={["チャットボットの一覧を表示し、そのうちの一つを選んでデータをダウンロードします"]}
                    handleClick={() => handleToPage('download')}
                  />
                  <CardButton title="追加アップロード"
                    text={["データをアップロードしたら、そのデータと同じschemeNameを持つチャットボットの一覧を表示します。",
                      "そのうち１つまたは複数を選んでデータをアップロードします。",
                      "ユーザの学習データは温存され、アップロード元の非originデータはアップロードされません。",
                      "アップロード元にないbotModuleは温存されます。"]}
                    handleClick={() => handleToPage('download')}
                  />
                  <CardButton title="上書きダウンロード"
                    text={["データをアップロードしたら、そのデータと同じschemeNameを持つチャットボットの一覧を表示します。",
                      "そのうち１つまたは複数を選んでデータをアップロードします。",
                      "ユーザの学習データは破棄され、アップロード元にないbotModuleは削除されます。"]}
                    handleClick={() => handleToPage('overwrite')}
                  />

                </Box>
        }
      </AdminAuth>
    </Container >
  )
}

export const Head = ({ data }) => (
  <>
    <html lang='ja' />
    <title>{data.site.siteMetadata.title}</title>
  </>
);

export const query = graphql`
  query IndexPageQuery {
    site {
      siteMetadata {
        title
      }
    }
  }
`;