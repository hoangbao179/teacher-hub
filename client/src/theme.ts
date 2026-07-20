import { createTheme } from "@mui/material/styles";
export const uiTokens = {
  spacingUnit: 8,
  radius: 14,
  elevation: 2,
  touchTarget: 44,
  navigationHeight: 64,
  breakpoints: { mobile: 360, wideMobile: 390, tablet: 768, desktop: 1200 },
  status: { active: "#168754", warning: "#b85c00", danger: "#c73535", neutral: "#5e6070" },
} as const;

export const theme = createTheme({
  palette: {
    primary: { main: "#6d3df5" },
    success: { main: "#20a464" },
    warning: { main: "#f28c28" },
    error: { main: "#e74c4c" },
    background: { default: "#f7f7fb" },
  },
  spacing: uiTokens.spacingUnit,
  shape: { borderRadius: uiTokens.radius },
  breakpoints: { values: { xs: 0, sm: 600, md: uiTokens.breakpoints.tablet, lg: uiTokens.breakpoints.desktop, xl: 1536 } },
  typography: {
    fontFamily:
      'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          minHeight: uiTokens.touchTarget,
          "&:focus-visible": {
            outline: "3px solid #2f6fed",
            outlineOffset: 2,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { margin: 16, maxHeight: "calc(100dvh - 32px)", backgroundColor: "#fff", backgroundImage: "none" } },
    },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": { "--admin-nav-height": `${uiTokens.navigationHeight}px` },
        body: { overflowWrap: "break-word" },
      },
    },
  },
});
