import React, {useEffect, useMemo} from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';

import CloudDownloadIcon from '@mui/icons-material/CloudDownloadOutlined';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBeforeOutlined';

import {downloadFsScheme} from '../../biomebot-0.11/botio';

export default function BotDownload({repoState, firestore, handleBack}) {
  /*
  全チャットボットをリスト表示し、右端にダウンロードボタンを置く
  ※削除するにはcloud functionを経由して再帰的にサブコレクションを削除する必要がある。
  実装は先送り
  */

  function handleDownload(botId) {
    const scheme = downloadFsScheme(firestore, botId);
  }

  const botItems = useMemo(() => {
    let l = [];
    for (let r of repoState.mainModules) {
      console.log(r);
      const updatedAt = new Date(r.updatedAt.seconds * 1000).toLocaleString(
        'sv-SE'
      );

      l.push(
        <ListItem
          sx={{backgroundColor: '#ffffff', my: 1}}
          key={r.fsId}
          secondaryAction={
            <>
              <IconButton onClick={() => handleDownload(r.botId)}>
                <CloudDownloadIcon />
              </IconButton>
            </>
          }
        >
          <ListItemAvatar>
            <Avatar
              alt={r.schemeName}
              src={`/chatbot/avatar/${r.avatarDir}/avatar.svg`}
            />
          </ListItemAvatar>
          <ListItemText
            primary={`${r.schemeName} @ ${r.userProps.displayName}`}
            secondary={updatedAt}
          />
        </ListItem>
      );
    }
    return l;
  }, [repoState.mainModules]);

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
        <Box flexGrow={1}>Download</Box>
      </Box>
      <Box>
        <List dense>{botItems}</List>
      </Box>
    </Box>
  );
}
