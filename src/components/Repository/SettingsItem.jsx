import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export default function SettingsItem({title, text, handleClick}) {
  return (
    <Box sx={{my: 2}}>
      <Typography variant='subtitle1'>{text}</Typography>
      <Button variant='contained' onClick={(event) => handleClick(event)}>
        {title}
      </Button>
    </Box>
  );
}
