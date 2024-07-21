import React from 'react';
import {withPrefix} from 'gatsby';
import Box from '@mui/material/Box';

/**
 * ユーザのアバター表示
 * @param {Parameters.user} auth.userオブジェクト
 * @param {Number} panelWidth
 * @return {JSX.Elements} ユーザアバター
 */
export default function UserPanel({user, panelWidth}) {
  /*
  user:{
    displayName,
    backgroundColor,
    avatarDir
  */
  const width = panelWidth;
  const height = (width * 4) / 3;
  const photoURL = user ? `/user/avatar/${user.avatarDir}/peace.svg` : '';

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
          borderRadius: '100% 0% 0% 100% / 100% 100% 0% 0%',
          backgroundColor: user ? user.backgroundColor : '#EEEEEE',
        }}
        position='absolute'
        bottom={0}
        right={0}
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
        right={0}
      >
        <img
          style={{
            width: width,
            height: height,
          }}
          src={withPrefix(photoURL)}
          alt={withPrefix(photoURL)}
        />
      </Box>
    </Box>
  );
}
