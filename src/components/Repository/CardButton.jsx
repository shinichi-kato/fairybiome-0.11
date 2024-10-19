import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

export default function CardButton({title, text, handleClick}) {
  return (
    <Card sx={{mb: 2, mt: 2}}>
      <ButtonBase onClick={(event) => handleClick(event)}>
        <CardContent>
          <Typography variant='h5'>{title}</Typography>
          <Typography>{text}</Typography>
        </CardContent>
      </ButtonBase>
    </Card>
  );
}
