import { createTheme } from '@mui/material/styles';
import { pink, teal } from '@mui/material/colors';

// The theme of the pages that still use MUI. Its CSS variables switch with
// prefers-color-scheme, like the shell's tokens in index.css, and it uses the
// shell's font.
const muiTheme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: { palette: { primary: teal, secondary: pink } },
    // Lighter shades, so that gains and losses written in `dark` stay
    // readable on a dark background.
    dark: {
      palette: {
        primary: { light: teal[100], main: teal[300], dark: teal[400] },
        secondary: { light: pink[100], main: pink[300], dark: pink[400] },
      },
    },
  },
  typography: {
    fontFamily: 'var(--font-sans)',
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        // right-aligned cells hold numbers, whose digits should line up
        alignRight: { fontVariantNumeric: 'tabular-nums' },
      },
    },
  },
});

export default muiTheme;
