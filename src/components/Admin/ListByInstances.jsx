import React, {useEffect, useReducer} from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardIos';

const initialState = {
  instances: null,
  userIds: [],
  itemList: [],
  checked: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'load': {
      const userIds = Object.keys(action.instances);
      const itemList = userIds.map((userId) => ({
        userId: userId,
        userDisplayName: action.users[userId].displayName,
        ...action.instances[userId],
      }));
      return {
        instances: action.instances,
        userIds: userIds,
        itemList: itemList,
        checked: [],
      };
    }

    case 'check': {
      if (state.instances) {
        const currentIndex = state.checked.indexOf(action.userId);
        const newChecked = [...state.checked];

        if (currentIndex === -1) {
          newChecked.push(action.userId);
        } else {
          newChecked.splice(currentIndex, 1);
        }

        return {
          ...state,
          checked: newChecked,
        };
      }
      return {
        ...state,
      };
    }

    case 'toggleSelection': {
      return {
        ...state,
        checked: state.checked.length === 0 ? [...state.userIds] : [],
      };
    }
  }
}

export default function ListByInstances({instances, users, toBotProperty}) {
  /*instancesは
  instances={
    userId: {
      botId, avatarDir, index
    }
  }
    という情報が格納されている。
  */

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (instances) {
      dispatch({type: 'load', instances: instances, users: users});
    }
  }, [instances]);

  function handleToggle(userId) {
    dispatch({type: 'check', userId: userId});
  }

  function handleToggleSelection() {
    dispatch({type: 'toggleSelection'});
  }

  const items = state.itemList.map((item) => {
    const labelId = `checkbox-list-label-${item.userId}`;
    const userId = item.userId;
    let props = '';
    if (item.index) {
      let newest = 0;
      for (const script in item.index) {
        const index = item.index[script];
        for (const page in index) {
          if (index[page].seconds > newest) {
            newest = index[page].seconds;
          }
        }
      }

      const d = new Date(newest * 1000);
      const timestamp = `${d.toLocaleDateString(
        'sv-SE'
      )} ${d.toLocaleTimeString('ja-JP')}`;

      props = ` 📚ファイル数: ${
        Object.keys(item.index).length
      } 🗓️:${timestamp}`;
    }

    return (
      <ListItem
        key={userId}
        secondaryAction={
          <IconButton
            edge='end'
            aria-label='property'
            onClick={() => toBotProperty(userId)}
            disabled={!item.index}
          >
            <ArrowForwardIcon />
          </IconButton>
        }
        disablePadding
      >
        <ListItemButton
          role={undefined}
          onClick={() => handleToggle(userId)}
          sx={{backgroundColor: '#EEEEEE'}}
        >
          <ListItemIcon>
            <Checkbox
              edge='start'
              checked={state.checked.includes(userId)}
              tabIndex={-1}
              disableRipple
              inputProps={{'aria-labelledby': labelId}}
            />
          </ListItemIcon>
          <ListItemText
            id={labelId}
            primary={item.botId ? `botId: ${item.botId}` : 'botはありません'}
            secondary={`👤ユーザ名: ${item.userDisplayName} ${props}`}
          />
        </ListItemButton>
      </ListItem>
    );
  });

  return (
    <>
      <Box
        sx={{
          height: 'calc ( 100vh - 48px - 48px )',
          overflowY: 'scroll',
          alignItems: 'flex-end',
          flexGrow: 1,
        }}
      >
        <List>{items}</List>
      </Box>
      <Box sx={{display: 'flex', flexDirection: 'row'}}>
        <Box>
          <Button onClick={handleToggleSelection}>
            {state.checked.length === 0 ? '全て選択' : 'すべて選択解除'}
          </Button>
        </Box>
        <Box>
          <Button>一括アップロード</Button>
        </Box>
      </Box>
    </>
  );
}
