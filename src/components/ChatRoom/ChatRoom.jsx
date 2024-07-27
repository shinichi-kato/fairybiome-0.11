import React, {useContext, useState} from 'react';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

import {AuthContext} from '../Auth/AuthProvider';
import {BiomebotContext} from '../../biomebot-0.11/BiomebotProvider';
import {EcosystemContext} from '../Ecosystem/EcosystemProvider';
import ConsoleBar from './ConsoleBar';
import UserPanel from '../Panel/UserPanel';
import FairyPanel from '../Panel/FairyPanel';
import LogView from './LogView';

import {MessageFactory} from '../../message';

const panelWidth = 192;

/**
 * チャットルーム
 * @param {Object} firestore firestoreオブジェクト
 * @return {JSX.Element} コンポーネント
 */
export default function ChatRoom({firestore}) {
  const [text, setText] = useState('');
  const auth = useContext(AuthContext);
  const eco = useContext(EcosystemContext);
  const bot = useContext(BiomebotContext);

  const handleChangeText = (e) => {
    setText(e.target.value);
  };

  const handleToBack = () => {
    // navigate
  };

  const handleSend = () => {
    const message = new MessageFactory(text, {
      user: auth.user,
      ecosys: eco.ecoState,
    });
    bot.writeLog(message.toObject());
  };
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
          <LogView firestore={firestore} uid={auth.uid} />
        </Box>
        <Box
          sx={{
            display: 'flex',
            felxDirection: 'row',
          }}
        >
          <Box>
            <FairyPanel repr={bot.botRepr} panelWidth={panelWidth} />
          </Box>
          <Box sx={{flexGrow: 1}} />
          <Box>
            <UserPanel user={auth.user} panelWidth={panelWidth} />
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
