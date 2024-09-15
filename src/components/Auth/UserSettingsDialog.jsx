import React, {useReducer, useEffect, useRef} from 'react';
import {useStaticQuery, graphql} from 'gatsby';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccountIcon from '@mui/icons-material/AccountCircle';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

import CustomInput from './CustomInput';
import AvatarSelector from './AvatarSelector';
import ColorPicker from './ColorPicker';
import UserPanel from '../Panel/UserPanel';

const initialState = {
  displayName: '',
  avatarDir: '',
  backgroundColor: '',
};

function reducer(state, action) {
  // console.log("UserSettingsDialog", action)
  switch (action.type) {
    case 'changeUserProps': {
      return {
        ...state,
        avatarDir: action.avatarDir,
        backgroundColor: action.backgroundColor,
      };
    }

    case 'changeDisplayName': {
      return {
        ...state,
        displayName: action.displayName,
      };
    }

    case 'changeAvatarDir': {
      return {
        ...state,
        avatarDir: action.avatarDir,
      };
    }

    case 'changeBackgroundColor': {
      return {
        ...state,
        backgroundColor: action.backgroundColor,
      };
    }

    default:
      throw new Error(`invalid action ${action.type}`);
  }
}
export default function UserSettingsDialog({
  authState,
  handleChangeUserSettings,
  handleSignOut,
}) {
  const {user, userProps, errorCode} = authState;
  const [state, dispatch] = useReducer(reducer, initialState);
  const data = useStaticQuery(graphql`
    query {
      site {
        siteMetadata {
          backgroundColorPalette
        }
      }
      allFile(
        filter: {
          sourceInstanceName: {eq: "userAvatar"}
          name: {eq: "peace"}
          relativeDirectory: {glob: "!_*"}
        }
      ) {
        nodes {
          relativeDirectory
        }
      }
    }
  `);

  const paletteRef = useRef(data.site.siteMetadata.backgroundColorPalette);
  const avatarDirsRef = useRef(
    data.allFile.nodes.map((node) => node.relativeDirectory)
  );

  useEffect(() => {
    if (user.displayName) {
      dispatch({type: 'changeDisplayName', displayName: user.displayName});
    }
  }, [user.displayName]);

  useEffect(() => {
    dispatch({
      type: 'changeAvatarDir',
      avatarDir: userProps.avatarDir || avatarDirsRef.current[0],
    });
  }, [userProps.avatarDir]);

  useEffect(() => {
    dispatch({
      type: 'changeBackgroundColor',
      backgroundColor: userProps.backgroundColor || paletteRef.current[0],
    });
  }, [userProps.backgroundColor]);

  function handleSubmit(e) {
    e.preventDefault();
    handleChangeUserSettings({
      displayName: state.displayName,
      avatarDir: state.avatarDir,
      backgroundColor: state.backgroundColor,
    });
  }

  return (
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
      <Typography component='h1' variant='h5'>
        ユーザ設定
      </Typography>
      <Box
        component='form'
        onSubmit={handleSubmit}
        id='user-settings'
        sx={{
          m: 1,
          width: 'xs',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box>
          <UserPanel
            user={{
              backgroundColor: state.backgroundColor,
              avatarDir: state.avatarDir,
            }}
            panelWidth={200}
          />
        </Box>
        <Box>
          <AvatarSelector
            avatarDirs={avatarDirsRef.current}
            avatarDir={state.avatarDir}
            handleChangeAvatarDir={(dir) =>
              dispatch({type: 'changeAvatarDir', avatarDir: dir})
            }
          />
        </Box>
        <Box>
          <CustomInput
            title='ユーザの名前'
            id='userSettings-name'
            value={state.displayName}
            onChange={(e) =>
              dispatch({type: 'changeDisplayName', displayName: e.target.value})
            }
            startIcon={<AccountIcon />}
          />
        </Box>
        <Box>
          <ColorPicker
            title='背景色'
            palette={paletteRef.current}
            value={state.backgroundColor}
            handleChangeValue={(c) =>
              dispatch({type: 'changeBackgroundColor', backgroundColor: c})
            }
          />
        </Box>
        <Box>{errorCode && <Alert severity='error'>{errorCode}</Alert>}</Box>
        <Box sx={{p: 1}}>
          <Button
            variant='contained'
            disabled={
              authState === 'UserSettingsDialog:waiting' ||
              state.displayName === ''
            }
            type='submit'
          >
            OK
          </Button>
        </Box>
        <Box sx={{p: 1}}>
          <Button variant='text' size='small' onClick={handleSignOut}>
            サインアウト
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
