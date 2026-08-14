import { createTheme } from "@mui/material/styles";

const applicationFont = '"Be Vietnam Pro", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const uiTokens = {
  spacingUnit: 8,
  radius: 12,
  compactRadius: 10,
  cardRadius: 16,
  bannerRadius: 22,
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
  formWidth: 620,
  detailWidth: 920,
  operationWidth: 1080,
  wideWidth: 1360,
  colors: {
    primary: "#0f766e",
    primaryHover: "#0b625c",
    primaryStrong: "#0f766e",
    primarySurface: "#ddf7f1",
    canvas: "#f3f9f7",
    surface: "#ffffff",
    subtleSurface: "#f0f7f5",
    border: "#d9e9e5",
    mint: "#d1fae5",
    mintBorder: "#afe8cf",
    sky: "#e0f2fe",
    skyBorder: "#bddff4",
    peach: "#ffedd5",
    peachBorder: "#f6d0a8",
    coral: "#ff6b6b",
    coralSurface: "#fff0f0",
    cream: "#fff8f2",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
  },
  shadows: {
    card: "0 4px 12px rgba(15, 23, 42, 0.07)",
    raised: "0 10px 24px rgba(15, 23, 42, 0.09)",
  },
  breakpoints: { mobile: 360, wideMobile: 390, tablet: 768, desktop: 1200 },
  status: {
    active: "#168754",
    warning: "#9a4a00",
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

export const publicUiTokens = {
  primary: "#0F766E",
  primaryHover: "#0B625C",
  accent: "#14B8A6",
  primarySurface: "#DDF7F1",
  background: "#F5FBFA",
  surface: "#FFFFFF",
  textPrimary: "#142840",
  textSecondary: "#5C7188",
  border: "#D5E5E3",
  sky: "#EAF5FF",
  mint: "#EAF8F3",
  yellow: "#FFF6D9",
  coral: "#FFF0E8",
} as const;

export const theme = createTheme({
  palette: {
    primary: { main: "#6d3df5" },
    success: { main: "#168754" },
    warning: { main: "#e87812" },
    error: { main: "#d64545" },
    info: { main: "#087ca7" },
    background: { default: "#f7f7fb", paper: "#ffffff" },
    divider: "#dedce7",
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
          "&:focus-visible": { outline: "3px solid #2f6fed", outlineOffset: 2 },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: uiTokens.buttonHeight,
          borderRadius: uiTokens.compactRadius,
          paddingInline: 16,
          "@media (min-width:768px)": { minHeight: uiTokens.touchTarget, paddingInline: 14 },
        },
        sizeLarge: { "@media (min-width:768px)": { minHeight: 42, paddingInline: 14 } },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { minWidth: uiTokens.touchTarget, minHeight: uiTokens.touchTarget } },
    },
    MuiCard: {
      styleOverrides: { root: { backgroundImage: "none", borderColor: "#dedce7" } },
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
      styleOverrides: { paper: { margin: 16, maxHeight: "calc(100dvh - 32px)", backgroundColor: "#ffffff", backgroundImage: "none" } },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 18, lineHeight: 1.4, fontWeight: 700 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: uiTokens.touchTarget,
          "&.MuiInputBase-multiline": { padding: "10px 12px" },
          "@media (min-width:768px)": {
            minHeight: uiTokens.touchTarget,
            "&.MuiInputBase-multiline": { minHeight: 0, padding: "8px 12px" },
          },
        },
        input: {
          padding: "10px 12px",
          "&.MuiInputBase-inputMultiline": { padding: 0 },
          "@media (min-width:768px)": { padding: "8px 12px" },
        },
      },
    },
    MuiFormLabel: { styleOverrides: { root: { fontSize: 14 } } },
    MuiCssBaseline: {
      styleOverrides: {
        ":root": {
          "--admin-nav-height": `${uiTokens.navigationHeight}px`,
          "--app-content-width": `${uiTokens.contentWidth}px`,
          "--app-form-width": `${uiTokens.formWidth}px`,
          "--app-detail-width": `${uiTokens.detailWidth}px`,
          "--app-operation-width": `${uiTokens.operationWidth}px`,
          "--app-wide-width": `${uiTokens.wideWidth}px`,
        },
        html: { scrollBehavior: "smooth", scrollPaddingTop: "72px" },
        body: { overflowWrap: "break-word" },
        "@media (prefers-reduced-motion: reduce)": {
          html: { scrollBehavior: "auto" },
        },
      },
    },
  },
});

export const adminTheme = createTheme(theme, {
  palette: {
    primary: {
      main: uiTokens.colors.primary,
      dark: uiTokens.colors.primaryHover,
      light: uiTokens.colors.primarySurface,
      contrastText: "#ffffff",
    },
    secondary: { main: uiTokens.colors.coral, dark: "#d94f5c", light: uiTokens.colors.coralSurface },
    success: { main: "#168754", light: uiTokens.colors.mint },
    warning: { main: "#c76516", light: uiTokens.colors.peach },
    error: { main: "#d64545", light: uiTokens.colors.coralSurface },
    info: { main: "#2383b8", light: uiTokens.colors.sky },
    background: { default: uiTokens.colors.canvas, paper: uiTokens.colors.surface },
    divider: uiTokens.colors.border,
    text: { primary: uiTokens.colors.textPrimary, secondary: uiTokens.colors.textSecondary },
  },
  shape: { borderRadius: uiTokens.radius },
  typography: {
    h5: {
      ...uiTokens.typography.pageTitle,
      "@media (min-width:1200px)": { fontSize: 25, lineHeight: 1.25 },
    },
  },
  shadows: [
    "none",
    uiTokens.shadows.card,
    "0 6px 16px rgba(15, 23, 42, 0.075)",
    uiTokens.shadows.raised,
    ...Array(21).fill("0 12px 28px rgba(15, 23, 42, 0.10)"),
  ] as unknown as ReturnType<typeof createTheme>["shadows"],
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease",
          "&:focus-visible": { outline: `3px solid ${uiTokens.colors.primary}`, outlineOffset: 2 },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: uiTokens.buttonHeight,
          borderRadius: uiTokens.compactRadius,
          paddingInline: 16,
          fontWeight: 600,
        },
        containedPrimary: {
          boxShadow: "0 4px 10px rgba(20, 184, 166, 0.18)",
          "&:hover": { backgroundColor: uiTokens.colors.primaryHover, boxShadow: "0 6px 14px rgba(20, 184, 166, 0.22)" },
        },
        outlinedPrimary: {
          borderColor: "#8ed6cc",
          color: uiTokens.colors.primaryStrong,
          "&:hover": { borderColor: uiTokens.colors.primary, backgroundColor: "#eefaf7" },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: `1px solid ${uiTokens.colors.border}`,
          borderRadius: uiTokens.cardRadius,
          boxShadow: uiTokens.shadows.card,
          "&:focus-visible": { outline: `3px solid ${uiTokens.colors.primary}`, outlineOffset: 2 },
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: uiTokens.cardPadding,
          "&:last-child": { paddingBottom: uiTokens.cardPadding },
          "@media (min-width:768px)": { padding: 20, "&:last-child": { paddingBottom: 20 } },
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          flex: "1 1 20%",
          minWidth: 0,
          maxWidth: "none",
          position: "relative",
          padding: "6px 2px 7px",
          color: uiTokens.colors.textSecondary,
          "&.Mui-selected": { color: uiTokens.colors.primaryStrong, backgroundColor: "transparent" },
          "&.Mui-selected::before": {
            content: '""',
            position: "absolute",
            top: 4,
            left: "50%",
            width: 32,
            height: 28,
            transform: "translateX(-50%)",
            borderRadius: 10,
            backgroundColor: uiTokens.colors.primarySurface,
          },
          "& .MuiSvgIcon-root": { position: "relative", zIndex: 1, fontSize: 20 },
          "& .MuiBottomNavigationAction-label": { position: "relative", zIndex: 1 },
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
    MuiChip: {
      styleOverrides: {
        root: { height: 27, borderRadius: 999, fontSize: 12.5, fontWeight: 600 },
        colorPrimary: { backgroundColor: uiTokens.colors.primarySurface, color: uiTokens.colors.primaryStrong },
        colorWarning: {
          backgroundColor: uiTokens.colors.peach,
          borderColor: uiTokens.colors.peachBorder,
          color: uiTokens.status.warning,
          "&.MuiChip-outlined": { backgroundColor: "#fffaf5" },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          margin: 16,
          maxHeight: "calc(100dvh - 32px)",
          backgroundColor: uiTokens.colors.surface,
          backgroundImage: "none",
          borderRadius: uiTokens.cardRadius,
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.16)",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: uiTokens.touchTarget,
          borderRadius: uiTokens.compactRadius,
          backgroundColor: uiTokens.colors.surface,
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#83cfc5" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: uiTokens.colors.primary, borderWidth: 2 },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: "#dceee9" },
        bar: { backgroundColor: uiTokens.colors.primary },
      },
    },
    MuiTabs: {
      styleOverrides: { indicator: { backgroundColor: uiTokens.colors.primary, height: 3, borderRadius: 3 } },
    },
    MuiTab: {
      styleOverrides: { root: { minHeight: uiTokens.touchTarget, "&.Mui-selected": { color: uiTokens.colors.primaryStrong } } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { backgroundColor: "#f0f8f6", color: uiTokens.colors.primaryStrong, fontWeight: 700 },
        root: { borderColor: uiTokens.colors.border },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: uiTokens.radius } },
    },
  },
});

export const publicLearningTheme = createTheme(theme, {
  palette: {
    primary: { main: publicUiTokens.primary, dark: publicUiTokens.primaryHover, light: publicUiTokens.primarySurface, contrastText: "#ffffff" },
    background: { default: publicUiTokens.background, paper: publicUiTokens.surface },
    divider: publicUiTokens.border,
    text: { primary: publicUiTokens.textPrimary, secondary: publicUiTokens.textSecondary },
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&:focus-visible": { outline: `3px solid ${publicUiTokens.accent}`, outlineOffset: 2 },
          "@media (prefers-reduced-motion: reduce)": { transition: "none" },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: { "&:hover": { backgroundColor: publicUiTokens.primaryHover } },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { backgroundColor: publicUiTokens.primarySurface }, bar: { backgroundColor: publicUiTokens.primary } },
    },
  },
});
