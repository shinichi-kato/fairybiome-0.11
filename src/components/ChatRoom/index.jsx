import React, {useContext, useState, useEffect} from 'react';
import {useStaticQuery, graphql} from 'gatsby';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

import {AuthContext} from '../Auth/AuthProvider';
import {BiomebotContext} from '../../biomebot-0.11/BiomebotProvider';
import {EcosystemContext} from '../Ecosystem/EcosystemProvider';
import ConsoleBar from './ConsoleBar';
import UserPanel from '../Panel/UserPanel';
import FairyPanel from '../Panel/FairyPanel';

/**
 * チャットルーム
 * @return {JSX.Element} コンポーネント
 */
export default function ChatRoom() {
  const [text, setText] = useState('');
  const auth = useContext(AuthContext);
  const eco = useContext(EcosystemContext);
  const bot = useContext(BiomebotContext);

  const siteSnap = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          balloonBackgroundAlpha
        }
      }
    }
  `);

  function handleChangeText(e) {
    setText(e.target.value);
  }

  return (
    <Container maxWidth='xs'>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
        }}
      >
        <Box>
          <ConsoleBar
            text={text}
            handleChangeText={handleChangeText}
            handleToBack={handleToBack}
            handleSend={handleSend}
          />
        </Box>
        <Box
          sx={{
            height: 'calc ( 100vh - 48px - 256px )',
            overflowY: 'scroll',
            alignItems: 'flex-end',
            flexGrow: 1,
          }}
        >
          <LogViewer
            log={log}
            uid={auth.uid}
            bgAlpha={siteSnap.site.siteMetadata.balloonBackgroundAlpha}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            felxDirection: 'row',
          }}
        >
          <Box>
            <FairyPanel state={bot.state} panelWidth={panelWidth} />
          </Box>
          <Box sx={{flexGrow: 1}} />
          <Box>
            <UserPanel user={auth.userProps} panelWidth={panelWidth} />
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
