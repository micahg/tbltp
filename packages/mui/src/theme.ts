import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  components: {
    // MUI 9 narrowed the list icon column; keep the previous 56px spacing
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 56 } } },
  },
});
