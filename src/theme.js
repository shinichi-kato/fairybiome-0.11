import { red } from '@mui/material/colors';
import {alpha} from "@mui/material";
import { createTheme } from '@mui/material/styles';

// A custom theme for this app
const theme = createTheme({
  palette: {
    primary: {
      main: '#556cd6',
    },
    secondary: {
      main: '#19857b',
    },
    error: {
      main: red.A400,
    },
    drawerBg: {
      main: alpha('#000000',0)
    },
    inputBg: {
      main: alpha('#000000', 0.1)
    }
  },
});

export default theme;
