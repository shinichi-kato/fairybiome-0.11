import React from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import IconButton from '@mui/material/IconButton';

/**
 *
 * @param {String} param.bgColor
 * @return {JSX.Element} 色ボタン
 */
function MyIconButton({bgColor, ...other}) {
  return (
    <IconButton
      sx={{
        'backgroundColor': bgColor,
        '&:hover': {backgroundColor: bgColor},
        'mx': '2px',
      }}
      {...other}
    />
  );
}

/**
 * 色選択
 * @param {String} param.title タイトル
 * @param {Array} param.palette パレット
 * @param {String} param.value 色
 * @param {Function} param.handleChangeValue 色を変えるcallback
 * @return {JSX.Element} 色選択コンポーネント
 */
export default function ColorPicker({
  title,
  palette,
  value,
  handleChangeValue,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box>
        <Typography>{title}</Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {palette.map((c, i) => (
          <MyIconButton
            key={i}
            bgColor={c}
            size='small'
            onClick={(e) => handleChangeValue(c)}
          >
            <CheckIcon sx={{color: c === value ? '#ffffff' : 'transparent'}} />
          </MyIconButton>
        ))}
      </Box>
    </Box>
  );
}
