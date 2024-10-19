import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Input from '@mui/material/InputBase';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export default function AdminAuth({children}) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);

  function handleChangeUserName(e) {
    setUserName(e.target.value);
  }

  function handleChangePassword(e) {
    setPassword(e.target.value);
  }

  function handleSignIn(e) {
    e.preventDefault();
    if (
      process.env.GATSBY_ADMIN_USERNAME === userName &&
      process.env.GATSBY_ADMIN_PASSWORD === password
    ) {
      setStatus(true);
    } else {
      setStatus(false);
    }
  }

  return (
    <>
      {status ? (
        children
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#eeeeee',
            padding: 1,
          }}
          component='form'
          onSubmit={handleSignIn}
        >
          <Box sx={{mb: 2}}>
            <Typography variant='h5'>FairyBiome Administrator</Typography>
          </Box>
          <Box>name</Box>
          <Box sx={{mb: 2}}>
            <Input
              name='admin-name'
              sx={{backgroundColor: '#ffffff'}}
              value={userName}
              required
              onChange={handleChangeUserName}
            />
          </Box>
          <Box>password</Box>
          <Box sx={{mb: 2}}>
            <Input
              value={password}
              sx={{backgroundColor: '#ffffff'}}
              onChange={handleChangePassword}
              required
              type='password'
              autoComplete='new-password'
            />
            {status === false && 'ユーザ名またはパスワードが一致しません'}
          </Box>
          <Box>
            <Button variant='contained' type='submit' onClick={handleSignIn}>
              サインイン
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
