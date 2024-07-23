import React, {useLayoutEffect, useRef, useEffect, useState} from 'react';
import {useStaticQuery, graphql} from 'gatsby';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {alpha} from '@mui/material';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';

/**
 * 半透明化辞書の生成
 * @param {Array} log
 * @param {*} bgAlpha
 * @return {Dict}
 */
function getPalletteDict(log, bgAlpha) {
  // messageのリストからspeakerIdと背景色の辞書を生成し、
  // 背景色をbgAlphaに従った半透明にする。
  // see: https://qiita.com/kiyoshi999/items/3935734624fc909079e8

  const dict = {};
  for (const m of log) {
    const sid = m.ownweId;
    if (sid) {
      const bgColor = m.backgroundColor;
      dict[`balloon_${sid}`] = {main: alpha(bgColor, bgAlpha)};
      dict[`avatar_${sid}`] = {main: bgColor};
    }
  }
  return dict;
}

/**
 * 左吹き出しコンポーネント
 * @param {param.message} messageオブジェクト
 * @param {param.uid} uid
 * @return {JSX.Elements} 左吹き出しコンポーネント
 */
function LeftBalloon({message}) {
  const avatarPath =
    message.kind === 'bot'
      ? `/chatbot/avatar/${message.avatarDir}/avatar.svg`
      : `/user/avatar/${message.avatarDir}/avatar.svg`;
  const sid = message.ownerId;

  return (
    <Box
      display='flex'
      flexDirection='row'
      sx={{
        borderRadius: '15px 15px 15px 0px',
        alignSelf: 'flex-start',
        padding: '0.5em',
        marginLeft: '2px',
        marginBottom: '2px',
        backgroundColor: `balloon_${sid}.main`,
      }}
    >
      <Box>
        <Avatar
          alt={message.displayName}
          src={avatarPath}
          sx={{bgcolor: `avatar_${sid}.main`}}
        />
      </Box>
      <Box>
        <Typography variant='body1'>{message.text}</Typography>
        <Typography variant='caption'>{message.displayName}</Typography>
      </Box>
    </Box>
  );
}

/**
 * 右吹き出しコンポーネント
 * @param {param.message} messageオブジェクト
 * @return {JSX.Elements} 右吹き出しコンポーネント
 */
function RightBalloon({message}) {
  const avatarPath =
    message.kind === 'bot'
      ? `/chatbot/avatar/${message.avatarDir}/avatar.svg`
      : `/user/avatar/${message.avatarDir}/avatar.svg`;
  const sid = message.ownerId;

  return (
    <Box
      display='flex'
      flexDirection='row'
      alignSelf='flex-end'
      sx={{
        borderRadius: ' 15px 15px 0px 15px',
        padding: '0.5em',
        marginRight: '2px',
        marginBottom: '2px',
        backgroundColor: `balloon_${sid}.main`,
      }}
    >
      <Box>
        <Typography variant='body1'>{message.text}</Typography>
        <Typography variant='caption'>{message.displayName}</Typography>
      </Box>
      <Box alignSelf='flex-end'>
        <Avatar
          alt={message.displayName}
          src={avatarPath}
          sx={{bgcolor: `avatar_${sid}.main`}}
        />
      </Box>
    </Box>
  );
}

/**
 * システムメッセージコンポーネント
 * @param {param.message} messageオブジェクト
 * @return {JSX.Elements} システムメッセージコンポーネント
 */
function SystemMessage({message}) {
  let texts = message.text.split('\n');
  texts = texts.map((text, index) => (
    <Typography variant='body2' color='error.main' key={index}>
      {text}
    </Typography>
  ));
  return (
    <Box display='flex' flexDirection='row' alignItems='center'>
      <Box>
        {message.displayName && (
          <Typography variant='caption'>{message.displayName}</Typography>
        )}
        {texts}
      </Box>
    </Box>
  );
}

/**
 * ログの表示
 * @param {firestore} firestoreオブジェクト
 * @param {uid} userのId
 * @return {JSX.Elements} LogViewコンポーネント
 */
export default function LogView({firestore, uid}) {
  const [log, setLog] = useState([]);
  const scrollBottomRef = useRef();

  const siteSnap = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          balloonBackgroundAlpha
        }
      }
    }
  `);

  const customTheme = createTheme({
    palette: getPalletteDict(
      log,
      siteSnap.site.siteMetadata.balloonBackgroundAlpha
    ),
  });

  // ------------------------------------------------
  // 書き換わるたびに最下行へ自動スクロール
  //

  useLayoutEffect(() => {
    scrollBottomRef?.current?.scrollIntoView();
  }, [log]);

  // ------------------------------------------------
  // ログの購読
  //

  useEffect(() => {
    let unsubscribe = null;

    if (uid && firestore) {
      console.log('subscribe start');
      const logRef = collection(firestore, 'users', uid, 'log');
      const q = query(logRef, orderBy('timestamp', 'desc'), limit(20));

      unsubscribe = onSnapshot(q, (snap) => {
        const l = [];
        snap.forEach((doc) => {
          const d = doc.data();
          l.push({
            ...d,
            id: doc.id,
            timestamp: d.timestamp ? d.timestamp.toDate() : '',
            // timestampはserverTimestamp()で書き込むとratency補正時にnullが帰ってくる
          });
        });
        setLog(l);
      });
    }

    return () => {
      if (unsubscribe) {
        console.log('unsubscribed');
        unsubscribe();
      }
    };
  }, [uid, firestore]);

  return (
    <ThemeProvider theme={customTheme}>
      <Box display='flex' flexDirection='column'>
        {log.map((message) => {
          const id = message.ownerId;
          if (!id) {
            return <SystemMessage key={message.id} message={message} />;
          } else if (id === uid) {
            return <RightBalloon key={message.id} message={message} />;
          } else {
            return <LeftBalloon key={message.id} message={message} />;
          }
        })}
      </Box>
    </ThemeProvider>
  );
}
