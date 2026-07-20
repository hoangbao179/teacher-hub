import { createTheme } from "@mui/material/styles";
export const theme = createTheme({
  palette: {
    primary: { main: "#6d3df5" },
    success: { main: "#20a464" },
    warning: { main: "#f28c28" },
    error: { main: "#e74c4c" },
    background: { default: "#f7f7fb" },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 700 },
  },
});
