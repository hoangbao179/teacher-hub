import { createTheme } from "@mui/material/styles";

const applicationFont = '"Be Vietnam Pro", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const uiTokens = {
  spacingUnit: 8,
  radius: 12,
  compactRadius: 10,
  cardPadding: 16,
  compactCardPadding: 12,
  sectionSpacing: 24,
  itemSpacing: 12,
  elevation: { card: 1, raised: 3 },
  touchTarget: 44,
  buttonHeight: 44,
  iconSize: { small: 18, regular: 20, large: 22 },
  navigationHeight: 64,
  desktopNavigationWidth: 232,
  contentWidth: 1160,
  formWidth: 680,
  colors: {
    canvas: "#f7f7fb",
    surface: "#ffffff",
    subtleSurface: "#f2f0fa",
    border: "#dedce7",
    lavender: "#f0ebff",
    lavenderBorder: "#d8ccff",
    mint: "#ecf8f1",
    mintBorder: "#c9ead7",
    blue: "#edf6ff",
    blueBorder: "#cce3f8",
  },
  breakpoints: { mobile: 360, wideMobile: 390, tablet: 768, desktop: 1200 },
  status: {
    active: "#168754",
    warning: "#b85c00",
    danger: "#c73535",
    neutral: "#5e6070",
    info: "#087ca7",
  },
  typography: {
    fontFamily: applicationFont,
    pageTitle: { fontSize: 21, lineHeight: 1.3, fontWeight: 700 },
    sectionTitle: { fontSize: 17, lineHeight: 1.4, fontWeight: 700 },
    cardKpi: { fontSize: 20, lineHeight: 1.3, fontWeight: 700 },
    body: { fontSize: 14.5, lineHeight: 1.55, fontWeight: 400 },
    supporting: { fontSize: 13, lineHeight: 1.5, fontWeight: 400 },
    button: { fontSize: 14, lineHeight: 1.4, fontWeight: 600 },
  },
} as const;

export const theme = createTheme({
  palette: {
    primary: { main: "#6d3df5" },
    success: { main: "#168754" },
    warning: { main: "#e87812" },
    error: { main: "#d64545" },
    info: { main: "#087ca7" },
    background: { default: uiTokens.colors.canvas, paper: uiTokens.colors.surface },
    divider: uiTokens.colors.border,
    text: { primary: "#211f2b", secondary: "#686574" },
  },
  spacing: uiTokens.spacingUnit,
  shape: { borderRadius: uiTokens.radius },
  shadows: [
    "none",
    "0 1px 2px rgba(36, 29, 62, 0.08)",
    "0 2px 6px rgba(36, 29, 62, 0.10)",
    "0 4px 12px rgba(36, 29, 62, 0.12)",
    "0 6px 18px rgba(36, 29, 62, 0.13)",
    "0 8px 22px rgba(36, 29, 62, 0.14)",
    ...Array(19).fill("0 8px 24px rgba(36, 29, 62, 0.15)"),
  ] as unknown as ReturnType<typeof createTheme>["shadows"],
  breakpoints: { values: { xs: 0, sm: 600, md: uiTokens.breakpoints.tablet, lg: uiTokens.breakpoints.desktop, xl: 1536 } },
  typography: {
    fontFamily: applicationFont,
    fontSize: 14,
    h1: { fontSize: 40, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.025em" },
    h2: { fontSize: 32, lineHeight: 1.2, fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontSize: 27, lineHeight: 1.25, fontWeight: 700, letterSpacing: "-0.015em" },
    h4: { fontSize: 24, lineHeight: 1.3, fontWeight: 700, letterSpacing: "-0.01em" },
    h5: uiTokens.typography.pageTitle,
    h6: uiTokens.typography.sectionTitle,
    subtitle1: { fontSize: 15, lineHeight: 1.45, fontWeight: 600 },
    subtitle2: { fontSize: 14, lineHeight: 1.45, fontWeight: 600 },
    body1: uiTokens.typography.body,
    body2: uiTokens.typography.supporting,
    button: { ...uiTokens.typography.button, textTransform: "none", letterSpacing: 0 },
    caption: { fontSize: 12.5, lineHeight: 1.45 },
    overline: { fontSize: 12, lineHeight: 1.5, fontWeight: 700, letterSpacing: "0.035em" },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          minHeight: uiTokens.touchTarget,
          "&:focus-visible": { outline: "3px solid #2f6fed", outlineOffset: 2 },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: uiTokens.buttonHeight, borderRadius: uiTokens.compactRadius, paddingInline: 16 } },
    },
    MuiCard: {
      styleOverrides: { root: { backgroundImage: "none", borderColor: uiTokens.colors.border } },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: uiTokens.cardPadding, "&:last-child": { paddingBottom: uiTokens.cardPadding } } },
    },
    MuiChip: {
      styleOverrides: { root: { height: 26, fontSize: 12.5, fontWeight: 500 }, label: { paddingInline: 9 } },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          flex: "1 1 20%",
          minWidth: 0,
          maxWidth: "none",
          padding: "6px 2px 7px",
          color: "#686574",
          "&.Mui-selected": { color: "#6d3df5", backgroundColor: "#f5f1ff" },
          "& .MuiSvgIcon-root": { fontSize: 20 },
        },
        label: {
          fontSize: "0.6875rem",
          lineHeight: 1.2,
          fontWeight: 500,
          whiteSpace: "nowrap",
          "&.Mui-selected": { fontSize: "0.6875rem", fontWeight: 700 },
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { margin: 16, maxHeight: "calc(100dvh - 32px)", backgroundColor: uiTokens.colors.surface, backgroundImage: "none" } },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 18, lineHeight: 1.4, fontWeight: 700 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { minHeight: uiTokens.touchTarget },
        input: { padding: "11px 14px", "&.MuiInputBase-inputMultiline": { padding: 0 } },
      },
    },
    MuiFormLabel: { styleOverrides: { root: { fontSize: 14 } } },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--admin-nav-height": `${uiTokens.navigationHeight}px`,
          "--app-content-width": `${uiTokens.contentWidth}px`,
          "--app-form-width": `${uiTokens.formWidth}px`,
        },
        body: { overflowWrap: "break-word" },
      },
    },
  },
});
