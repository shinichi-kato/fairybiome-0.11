import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Input from '@mui/material/InputBase';
import InputAdornment from '@mui/material/InputAdornment';

export default function CustomInput({ title, value, 
  onChange, startIcon, autoComplete, type = 'text' }) {
  return (
    <Box sx={{ p: 1 }}>
      <Box>
        <Typography>
          {title}
        </Typography>
      </Box>
      <Box>
        <Input
          sx={{
            backgroundColor: "inputBg.main",
            p: 0.5,
            borderRadius: 2
          }}
          required
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          startAdornment={
            <InputAdornment position="start">
              {startIcon}
            </InputAdornment>
          } />
      </Box>
    </Box>
  )
}