import React from "react";
import { withPrefix } from 'gatsby';
import Box from '@mui/material/Box';


export default function UserPanel({ user, panelWidth }) {
  /*
  user:{
    displayName,
    backgroundColor,
    avatarDir
  
  */
  const width = panelWidth;
  const height = width * 4 / 3;
  const photoURL = `/user/avatar/${user.avatarDir}/peace.svg`;

  return (
    <Box
      sx={{
        width: width,
        height: height,
      }}
      position="relative">
      <Box
        sx={{
          width: width,
          height: width,
          borderRadius: "100% 0% 0% 100% / 100% 100% 0% 0%",
          backgroundColor: user.backgroundColor
        }}
        position="absolute"
        bottom={0}
        right={0}
      />
      <Box
        sx={{
          width: width,
          height: height,
          p: 0, m: 0
        }}
        position="absolute"
        bottom={0}
        right={0}
      >
        <img
          style={{
            width: width,
            height: height,
          }}
          src={withPrefix(photoURL)}
          alt={withPrefix(photoURL)} />
      </Box>

    </Box>

  )
}