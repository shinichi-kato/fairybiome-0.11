/*
 signIn, signUpダイアログ
 signIn画面の上にsignUp画面が重なったUIで、signUp画面はzoomで切り替わる。


 */

import React, {useReducer} from 'react';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Zoom from '@mui/material/Zoom';
import Typography from '@mui/material/Typography';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Avatar from '@mui/material/Avatar';
import EmailIcon from '@mui/icons-material/Email';
import KeyIcon from '@mui/icons-material/Key';
import CustomInput from './CustomInput';
import Alert from '@mui/material/Alert';

/**
 * emailのadornmentがついたsyledインプット
 * @param {String} props.title inputのタイトル
 * @param {String} props.email email値
 * @param {Function} props.onChange email値が変更されたときのcallback
 * @param {String} props.onChange email値が変更されたときのハンドラ
 * @return {Element.JSX}
 */
function EmailInput({title, email, onChange}) {
  return (
    <CustomInput
      title={title}
      value={email}
      type='email'
      autoComplete='email'
      onChange={onChange}
      startIcon={<EmailIcon />}
    />
  );
}

/**
 * パスワードのアイコンつきinput
 * @param {String} props.title インプット上に表示するタイトル
 * @param {String} props.password パスワード値
 * @param {Function} props.onChange パスワード変更時のcallback
 * @return {Element.JSX}
 */
function PasswordInput({title, password, onChange}) {
  return (
    <CustomInput
      title={title}
      type='password'
      autoComplete='current-password'
      value={password}
      onChange={onChange}
      startIcon={<KeyIcon />}
    />
  );
}

const initialState = {
  password1: '',
  password2: '',
  email: '',
  isPasswordsCorrect: false,
  openSignUp: false,
};

/**
 * このコンポーネントを制御するreducer
 * @param {Object} state 直前のstate
 * @param {Object} action stateに対する操作
 * @return {Object} 次のstate
 */
function reducer(state, action) {
  switch (action.type) {
    case 'openSignUp': {
      return {
        password1: '',
        password2: '',
        email: '',
        isPasswordsCorrect: null,
        openSignUp: true,
      };
    }

    case 'closeSignUp': {
      return {
        ...state,
        openSignUp: false,
      };
    }

    case 'changePassword':
    case 'changePassword1': {
      return {
        ...state,
        password1: action.password,
        isPasswordsCorrect:
          state.password2 !== '' &&
          action.password !== '' &&
          state.password2 === action.password,
      };
    }

    case 'changePassword2': {
      return {
        ...state,
        password2: action.password,
        isPasswordsCorrect:
          state.password1 !== '' &&
          action.password !== '' &&
          state.password1 === action.password,
      };
    }

    case 'changeEmail': {
      return {
        ...state,
        email: action.email,
      };
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Zoom ref={ref} {...props} />;
});

/**
 * サインイン/サインアップダイアログ
 * @param {Function} props hadleSignIn, handleSignUp ユーザ登録処理
 * @return {JSX.Element} コンポーネント
 */
export default function SignDialog(props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const authState = props.authState;

  function handleChangeEmail(v) {
    dispatch({type: 'changeEmail', email: v.target.value});
  }

  function handleChangePassword1(v) {
    dispatch({type: 'changePassword1', password: v.target.value});
  }

  function handleChangePassword2(v) {
    dispatch({type: 'changePassword2', password: v.target.value});
  }

  function handleSignUp(e) {
    e.preventDefault();
    props.handleSignUp(state.email, state.password1);
  }

  function handleSignIn(e) {
    e.preventDefault();
    props.handleSignIn(state.email, state.password1);
  }

  return (
    <Container maxWidth='xs'>
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 'xs',
          px: 'auto',
          borderRadius: '16px 16px 0px 0px',
          backgroundColor: 'background.paper',
        }}
      >
        <Avatar sx={{m: 1, bgcolor: 'secondary.main'}}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography component='h1' variant='h5'>
          サインイン
        </Typography>
        <Box
          component='form'
          onSubmit={handleSignIn}
          sx={{
            m: 1,
            width: 'xs',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <EmailInput
            id='email0'
            title='E-Mail'
            value={state.email}
            onChange={handleChangeEmail}
          />
          <PasswordInput
            id='password0'
            title='パスワード'
            value={state.password1}
            onChange={handleChangePassword1}
          />
          <Button
            variant='contained'
            disabled={
              authState.state === 'waiting' ||
              state.email === '' ||
              state.password1 === ''
            }
            fullWidth
            onClick={handleSignIn}
            type='submit'
          >
            サインイン
          </Button>
          <Button variant='text' onClick={() => dispatch({type: 'openSignUp'})}>
            新規登録
          </Button>
        </Box>
        <Box>
          {authState.error && (
            <Alert severity='error'>{authState.error}</Alert>
          )}
        </Box>
      </Box>
      <Dialog
        fullScreen
        open={state.openSignUp}
        onClose={() => dispatch({type: 'closeSignUp'})}
        TransitionComponent={Transition}
      >
        <Container maxWidth='xs'>
          <Box
            sx={{
              marginTop: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: 'xs',
              px: 'auto',
              borderRadius: '16px 16px 0px 0px',
              backgroundColor: 'background.paper',
            }}
          >
            <Avatar sx={{m: 1, bgcolor: 'secondary.main'}}>
              <LockOutlinedIcon />
            </Avatar>
            <Typography component='h1' variant='h5'>
              新規登録
            </Typography>
            <Box
              component='form'
              onSubmit={handleSignUp}
              sx={{
                m: 1,
                width: 'xs',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <EmailInput
                title='E-Mail'
                id='email1'
                value={state.email}
                onChange={handleChangeEmail}
              />
              <PasswordInput
                id='password1'
                title='パスワード'
                value={state.password1}
                onChange={handleChangePassword1}
              />
              <PasswordInput
                id='password2'
                title='パスワード(確認)'
                value={state.password2}
                onChange={handleChangePassword2}
              />
              <Button
                onClick={handleSignUp}
                disabled={
                  !state.isPasswordsCorrect || props.authState === 'waiting'
                }
                fullWidth
                type='submit'
                variant='contained'
              >
                新規登録
              </Button>
              <Button onClick={() => dispatch({type: 'closeSignUp'})}>
                サインイン
              </Button>
            </Box>
            <Box>
              {authState.error && (
                <Alert severity='error'>{authState.error}</Alert>
              )}
            </Box>
          </Box>
        </Container>
      </Dialog>
    </Container>
  );
}
