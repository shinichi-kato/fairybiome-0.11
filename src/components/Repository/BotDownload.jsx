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
  * ログに含まれる\t11223345式のタイムスタンプ情報は(mm/dd hh:mm)に変換する
  * main.json以外の辞書ファイルはテキスト形式として入出力する
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

  という行を追加し、すべてoriginに巻き取る。


  */

  async function handleDownload(botId) {
    const scheme = await downloadFsScheme(firestore, botId);
    /*
    取得したschemeの構造
    scheme: {
      updatedAt,     // botModulesの中で最新のもの
      botModules: [
        {
          id: fsid
          data: {
            botId: 'botId',
            mainFsId: 'mainFsId',
            moduleName: 'main', // `${moduleName}.json`をファイル名に
            schemeName: 'fairy', //
            avatarDir: 'default',
            backgroundColor: '#cccccc',
            script: [
              {
                doc: 'origin',
                line: 'text'
              }
            ]

          }
        }
      ]
    }
    */
    const zip = new JSZip();
    const pages = {};
    let schemeName = scheme.botModules[0].data.schemeName;

    for (const botModule of scheme.botModules) {
      // scriptをdocごとに分ける
      for (let item of botModule.data.script) {
        const doc = item.doc;

        if (doc in pages) {
          pages[doc].push(item);
        } else {
          pages[doc] = [item];
        }
      }
    }

    for (const botModule of scheme.botModules) {
      const timestamp = new Date(botModule.data.updatedAt.seconds * 1000);
      const scripts = [];
      for (const p in pages) {
        if (p !== 'origin') {
          scripts.push([
            '',
            '# -------------------------------------',
            `# ${p} ${timestamp.toString()}`,
            '#',
            '',
          ]);
        }
        scripts.push(...pages[p]);
      }

      if (botModule.data.moduleName === 'main') {
        zip.file(
          `${schemeName}/main.json`,
          JSON.stringify({
            ...botModule.data,
            script: scripts,
          }),
          {
            date: timestamp,
          }
        );
      } else {
        let script = scripts.map((l) => l.join('\n')).join('\n');
        zip.file(`${schemeName}/${botModule.data.moduleName}.txt`, script, {
          date: timestamp,
        });
      }
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
