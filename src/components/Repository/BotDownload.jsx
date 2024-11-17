import React, {useMemo} from 'react';
import JSZip from 'jszip';
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

  'origin'、'page0'をどう区別するか？
  page0〜のデータはダウンロードしたあとにはoriginに
  組み込まれる。区別のためpageごとにスクリプトを分けて
  
  "",
  "# ----------------------------",
  "# page0",
  "#",
  "",

  というデータを追加する。
  */

  async function handleDownload(botId) {
    const scheme = await downloadFsScheme(firestore, botId);
    /*
    scheme: {
      updatedAt,     // botModulesの中で最新のもの
      botModules: [
        {
          id: fsid
          data: {
            moduleName: 'main' // `${moduleName}.json`をファイル名に
            
          }
        }
      ]
    }
    */
    let schemeName = '';
    const zip = new JSZip();
    const pages = {};

    for (const botModule of scheme.botModules) {
      // scriptをdocごとに分ける
      for (const line of botModule.data.script) {
        const doc = line.doc;
        if (doc in pages) {
          pages[doc].push(line);
        } else {
          pages[doc] = [line];
        }
      }
    }

    for (const botModule of scheme.botModules) {
      const scripts = [];
      for (const p in pages) {
        if (p !== 'origin') {
          scripts.push([
            '',
            '# -------------------------------------',
            `# ${p}`,
            '#',
            '',
          ]);
        }
        scripts.push(...pages[p]);
      }

      zip.file(
        `${botModule.data.moduleName}.json`,
        JSON.stringify({
          ...botModule.data,
          script: scripts,
        }),
        {
          date: new Date(botModule.data.updatedAt.seconds * 1000),
        }
      );
      schemeName = botModule.data.schemeName;
    }

    // zip 生成
    const zipBlob = await zip.generateAsync({type: 'blob'});

    // ダウンロードリンク
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `${schemeName}.zip`; // The name of the downloaded file
    link.click();

    URL.revokeObjectURL(link.href);
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
