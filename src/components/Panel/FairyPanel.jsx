import React from 'react';
import {withPrefix} from 'gatsby';
import Box from '@mui/material/Box';

/**
 *
 * @param {Object} param.repr チャットボットの外見設定
 * @param {Number} param.panelWidth 表示幅
 * @return {JSX.Element} チャットボットのアバター
 */
export default function FairyPanel({repr, panelWidth}) {
  /*
    fairyのavatarと背景を表示する。
    props.status | 説明
  ---------------|----------
  false          | 灰色の背景のみ
  true           | 色付きの背景＋avatar
  */

  const width = 192;
  const height = (width * 4) / 3;

  return (
    <Box
      sx={{
        width: width,
        height: height,
      }}
      position='relative'
    >
      <Box
        sx={{
          width: width,
          height: width,
          borderRadius: '0% 100% 100% 0% / 100% 100% 0% 0%',
          backgroundColor: repr.backgroundColor,
        }}
        position='absolute'
        bottom={0}
        left={0}
      />
      <Box
        sx={{
          width: width,
          height: height,
          p: 0,
          m: 0,
        }}
        position='absolute'
        bottom={0}
        left={0}
      >
        <img
          style={{
            width: width,
            height: height,
          }}
          src={withPrefix(
            `/chatbot/avatar/${repr.avatarDir}/${repr.avatar}.svg`
          )}
          alt={repr.botState}
        />
      </Box>
    </Box>
  );
}
