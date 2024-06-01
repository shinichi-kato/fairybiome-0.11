import React from 'react';
import {withPrefix} from 'gatsby';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';


export default function Landing({ authState }) {
  return (
    <Container
      maxWidth="xs"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Box
          sx={{ alignSelf: 'center' }}
        >
          <img src={withPrefix('/images/fairydoor.svg')} alt="" />
        </Box>
        <Box
          sx={{ alignSelf: 'center' }}
        >
          "Loading ..."
        </Box>
        <Box>
          {authState.errorCode &&
            <Alert severity="warning">{authState.errorCode}</Alert>
          }
        </Box>
      </Box >
    </Container>
  )
}