import React from 'react';
import {alpha} from '@mui/material/styles';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIos';
import SendIcon from '@mui/icons-material/Send';
import InputBase from '@mui/material/InputBase';

/**
 * チャット画面最上部のinput兼メニューアイコン
 * @param {string} text 入力中の文字列
 * @param {Function} handleChangeText 文字列変更用ハンドラ
 * @param {Function} handleOpenMenu メニューボタン押下ハンドラ
 * @param {Function} handleSend 送信ボタン押下ハンドラ
 * @return {JSX.Element} コンポーネント
 */
export default function ConsoleBar({
  text,
  handleChangeText,
  handleOpenMenu,
  handleSend,
}) {
  /**
   * 送信
   * @param {event} e onClickで生成するeventオブジェクト
   */
  function handleSubmit(e) {
    e.preventDefault();
    handleSend();
  }

  return (
    <AppBar position='static'>
      <Toolbar>
        <IconButton onClick={handleOpenMenu} edge='start' color='inherit'>
          <ArrowBackIcon />
        </IconButton>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flexGrow: 1,
          }}
          component='form'
          onSubmit={handleSubmit}
        >
          <Box
            sx={{
              my: '2px',
              ml: '2px',
              borderRadius: '6px',
              backgroundColor: alpha('#eeeeee', 0.2),
              display: 'flex',
              flexDirection: 'row',
              width: '100%',
            }}
          >
            <Box></Box>
            <InputBase
              value={text}
              onChange={handleChangeText}
              sx={{
                width: '100%',
                color: 'inherit',
                p: 1,
              }}
            />
            <IconButton color='inherit' type='submit'>
              <SendIcon />
            </IconButton>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
