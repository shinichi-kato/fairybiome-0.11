
import React from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import IconButton from '@mui/material/IconButton';


function MyIconButton({ bgColor, ...other }) {
  return (
    <IconButton
      sx={{
        backgroundColor: bgColor,
        "&:hover": { backgroundColor: bgColor },
        mx: "2px",
      }}
      {...other}
    />
  );
}

export default function ColorPicker({
  title,
  palette,
  value,
  handleChangeValue
}) {

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box>
        <Typography>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        {palette.map((c, i) =>
          <MyIconButton
            key={i}
            bgColor={c}
            size="small"
            onClick={e => handleChangeValue(c)}
          >
              <CheckIcon sx={{ color: c=== value ? "#ffffff": "transparent" }} />
          </MyIconButton>
        )}
      </Box>
    </Box>
  )
}