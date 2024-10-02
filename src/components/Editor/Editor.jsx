import React, {useContext} from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

import {AuthContext} from '../Auth/AuthProvider';

export default function Editor() {
  /*
    authされたユーザの所有するチャットボットのデータは
    firestoreとdexieの両方にあるが、このeditorではsyncしているものとして
    dexie上のデータのダウンロード/アップロードを行う。
    dexie上のスクリプトではoriginはgraphql由来、page0〜は
    会話から学習した内容になっている。editorでは全データをダウンロードし、
    originとpageを区別して表示する。
    ダウンロード及びアップロードが可能なのはpage部分のみである。
    このバージョンでは画面上での編集には対応しない。

  
  */
  const auth = useContext(AuthContext);

  return (
    <Container maxWidth='xs'>
      <Box></Box>
    </Container>
  );
}
