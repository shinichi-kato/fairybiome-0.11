import React, {useEffect, useReducer} from 'react';
import {useStaticQuery, graphql} from 'gatsby';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';

const RE_AVATAR_DIR = /"avatarDir": "([^"]+)"/;

const biomebotQuery = graphql`
  query {
    allFile(
      filter: {
        sourceInstanceName: {in: ["userAvatar", "botAvatar"]}
        ext: {eq: ".svg"}
      }
    ) {
      nodes {
        relativeDirectory
        name
        sourceInstanceName
      }
    }
    allJson {
      nodes {
        parent {
          ... on File {
            relativeDirectory
            name
            internal {
              content
              description
            }
            sourceInstanceName
            modifiedTime
          }
        }
      }
    }
  }
`;

const getSchemeToAvatarDir = (biomebotSnap) => {
  const snap = {};
  biomebotSnap.allJson.nodes.forEach((node) => {
    const p = node.parent;
    if (
      p.sourceInstanceName === 'botModules' &&
      p.relativeDirectory !== '_loading' &&
      p.name === 'main'
    ) {
      for (const l of p.internal.content.split(',')) {
        const m = l.match(RE_AVATAR_DIR);
        if (m) {
          snap[p.relativeDirectory] = m[1];
        }
      }
    }
  });
  return snap;
};

const initialState = {
  schemeToAvatarDir: null,
  items: [],
  message: null,
};

function reducer(state, action) {
  console.log('ListBySchemes', action);
  switch (action.type) {
    case 'loadSchemes': {
      const items = [];
      let message = null;
      const names = Object.keys(action.schemes);
      if (names.length !== 0) {
        for (const schemeName of names) {
          items.push({
            schemeName: schemeName,
            avatarDir: action.schemeToAvatarDir[schemeName],
            count: action.schemes[schemeName].length,
          });
        }
      } else {
        message = 'チャットボットが見つかりません';
      }

      return {
        schemeToAvatarDir: action.schemeToAvatarDir,
        items: items,
        message: message,
      };
    }
  }
}
/**
 * schemeごとにgroup byしたNPCを含む全チャットボットのリスト表示
 */
export default function ListByScheme({schemes, toInstances}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const biomebotSnap = useStaticQuery(biomebotQuery);

  useEffect(() => {
    if (schemes && state.items.length === 0) {
      dispatch({
        type: 'loadSchemes',
        schemes: schemes,
        schemeToAvatarDir: getSchemeToAvatarDir(biomebotSnap),
      });
    }
  }, [schemes, state.items]);

  function handleClick(item) {
    toInstances(item);
  }

  const listItems = state.items.map((item) => (
    <ListItem key={item.schemeName}>
      <ListItemButton
        onClick={() => handleClick(item)}
        sx={{background: '#EEEEEE'}}
      >
        <ListItemIcon>
          <Avatar
            alt={item.schemeName}
            src={`/chatbot/avatar/${item.avatarDir}/avatar.svg`}
          />
        </ListItemIcon>
        <ListItemText>{`${item.schemeName} (${item.count})`}</ListItemText>
      </ListItemButton>
    </ListItem>
  ));

  return (
    <Box
      sx={{
        height: 'calc ( 100vh - 48px )',
        overflowY: 'scroll',
        alignItems: 'flex-end',
        flexGrow: 1,
      }}
    >
      <List>{listItems}</List>
      {state.message}
    </Box>
  );
}
