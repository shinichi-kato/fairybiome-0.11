/*
チャットボットのアップロード
==================================
チャットボットのファイル(複数)がアップロードされたらすべての
ファイルが同一schemeNameか確認。
OKならfirestore上で同じschemeNameのチャットボットを取得して
リスト表示。なければアップロードはできない。
firestoreにアップロードしたfsSchemeが有効になるには
dxScheme、gqSchemeの両者よりも新しいタイムスタンプが設定されている
必要がある。タイムスタンプが24h以内でない場合ユーザに警告を出力。
アップロードするファイルはzipまたはjsonで、
zipの場合は解凍し、含まれたjsonファイルを利用する。
アップロードするファイルにはmain.jsonが含まれている必要がある。
またアップロード元に存在しないファイルがfs上に存在している
場合はhow=="overwrite"であれば削除し、how=="append"であれば残す。

リストから一つまたは複数のチャットボットを選択
how==="overwrite"の場合f
*/
import React, {useMemo, useReducer} from 'react';
import {styled} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBeforeOutlined';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import Typography from '@mui/material/Typography';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const initialState = {
  files: [],
  isRecentlyUpdated: null,
  hasMainJson: null,
  selectedUsers: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'recieve': {
      // filesにmain.jsonが含まれることをチェック
      let hasMainJson = false;
      for (const file of action.files) {
        if (file.name === 'main') {
          hasMainJson = true;
        }
      }
      // ファイルが新しいことをチェック
      return {
        ...state,
        hasMainJson: hasMainJson,
        files: action.files,
        selectedUsers: [],
      };
    }
  }
}

export default function BotUpload({how, repoState, firestore, handleBack}) {
  /*
    1. チャットボットをアップロード
    ↓
    2. ユーザを一人または複数人選択

  */
  const [state, dispatch] = useReducer(reducer, initialState);

  const userList = useMemo(() => {
    let ul = [];
    for (const user in repoState.users) {
      ul.push(<>{user.name}</>);
    }
    return ul;
  }, [repoState.users]);

  function handleRecieveJson(event) {
    // zipファイルは展開する
  }

  function handleRecieveZip(event) {
    dispatch({type: 'recieve', files: event.target.files});
  }

  return (
    <Box
      sx={{
        p: 1,
        backgroundColor: '#eeeeee',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          p: 1,
          backgroundColor: '#cccccc',
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <Box>
          <IconButton onClick={handleBack}>
            <NavigateBeforeIcon />
          </IconButton>
        </Box>
        <Box flexGrow={1}>Upload</Box>
      </Box>
      <Box>
        <Typography variant='h3'>チャットボットデータの選択</Typography>
        <Typography variant='caption'>
          チャットボットを定義した複数の
          .jsonファイルまたはそれらを圧縮した一つの.zipファイルのどちらかを指定します。
          これらの.jsonファイルには一つのmain.jsonが含まれており、すべてのファイルについてタイムスタンプが現在に更新されている
          必要があります。
        </Typography>
        <Button
          component='label'
          role={undefined}
          variant='contained'
          tabIndex={-1}
          startIcon={<CloudUploadIcon />}
        >
          jsonファイルをアップロード
          <VisuallyHiddenInput
            type='file'
            inputProps={{accept: '.json'}}
            onChange={(event) => handleRecieveJson(event)}
            multiple
          />
        </Button>
        <Button
          component='label'
          role={undefined}
          variant='contained'
          tabIndex={-1}
          startIcon={<CloudUploadIcon />}
        >
          zipファイルをアップロード
          <VisuallyHiddenInput
            type='file'
            inputProps={{accept: '.zip'}}
            onChange={(event) => handleRecieveZip(event)}
          />
        </Button>
      </Box>
      {state.hasMainJson && (
        <Box>
          <Box>対象ユーザ</Box>
          <Box>usersとそれに属するchatbotのリスト</Box>
        </Box>
      )}
      {state.selectedUsers.length !== 0 && (
        <Box>
          <Box>ファイルのアップロード</Box>
          <Box>{userList}</Box>
        </Box>
      )}
    </Box>
  );
}
