/*
チャットボットのアップロード
==================================
チャットボットのファイル(複数)がアップロードされたらすべての
ファイルが同一schemeNameか確認。
OKならfirestore上で同じschemeNameのチャットボットを取得して
リスト表示。なければアップロードはできない。

リストから一つまたは複数のチャットボットを選択
how==="overwrite"の場合f
*/
import React from 'react';
import Box from '@mui/material/Box';

export default function BotUpload({how, firestore}) {
  return <Box></Box>;
}
