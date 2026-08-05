import {
  CalendarMonth,
  Groups,
  Home,
  Person,
  Payments,
  Logout,
  School,
  Translate,
  Assignment,
  AccountCircle,
  MenuBook,
} from "@mui/icons-material";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  ButtonBase,
  Container,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
  IconButton,
  Divider,
  Menu,
  MenuItem,
  ThemeProvider,
} from "@mui/material";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { adminTheme, uiTokens } from "../theme";
import { displayDashboardDate } from "../utils/date";
import { useHoChiMinhToday } from "../hooks/useHoChiMinhToday";

const nav = [
  ["/admin", <Home key="home" />, "Hôm nay"],
  ["/admin/calendar", <CalendarMonth key="calendar" />, "Lịch"],
  ["/admin/classes", <Groups key="classes" />, "Lớp học"],
  ["/admin/tuition", <Payments key="tuition" />, "Học phí"],
  ["/admin/students", <Person key="students" data-testid="student-navigation-icon" />, "Học sinh"],
] as const;
const desktopNav = [
  ...nav,
  ["/admin/vocabulary", <Translate key="vocabulary" />, "Kho từ vựng"],
  ["/admin/assignments", <Assignment key="assignments" />, "Bài tập từ vựng"],
  ["/admin/account", <AccountCircle key="account" />, "Tài khoản"],
] as const;

function shouldUseAdminSafeArea() {
  if (typeof navigator === "undefined") return false;
  const iosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = typeof window !== "undefined"
    && Boolean(window.matchMedia?.("(display-mode: standalone)").matches);
  return iosDevice || standalone;
}

const adminSafeBottom = shouldUseAdminSafeArea()
  ? "env(safe-area-inset-bottom, 0px)"
  : "0px";

export function AdminLayout() {
  const today = useHoChiMinhToday();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const closeAccountMenu = () => setAccountAnchor(null);
  const openAccountRoute = (path: string) => { closeAccountMenu(); navigate(path); };
  const logout = () => { closeAccountMenu(); void auth.logout().then(() => navigate("/admin/login")); };
  const directIndex = nav.findIndex(([path]) =>
      path === "/admin"
        ? location.pathname === "/admin"
        : location.pathname.startsWith(path),
    );
  const current = directIndex >= 0 ? directIndex
    : /^\/admin\/(reconciliation|busy-slots|lessons)/.test(location.pathname) ? 1
      : /^\/admin\/(vocabulary|assignments|account)/.test(location.pathname) ? -1 : 0;
  const desktopCurrent = desktopNav.findIndex(([path]) =>
    path === "/admin" ? location.pathname === "/admin" : location.pathname.startsWith(path),
  );
  return (
    <ThemeProvider theme={adminTheme}>
    <Box data-testid="admin-layout" sx={{
      "--admin-safe-bottom": adminSafeBottom,
      minHeight: { xs: "100svh", lg: "100dvh" },
      minWidth: 0,
      overflowX: "clip",
      bgcolor: "background.default",
      pb: { xs: `calc(${uiTokens.navigationHeight}px + var(--admin-safe-bottom) + 16px)`, lg: 0 },
    }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ bgcolor: "rgba(255,255,255,.96)", backdropFilter: "blur(10px)", borderBottom: 1, borderColor: "divider", boxShadow: "0 2px 10px rgba(15, 23, 42, 0.035)", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ minHeight: `${uiTokens.navigationHeight}px !important`, px: { xs: 1.75, lg: 3 } }}>
          <ButtonBase
            aria-label="Về Hôm nay"
            onClick={() => navigate("/admin")}
            sx={{ alignItems: "center", justifyContent: "flex-start", gap: 1.1, flexGrow: 1, minWidth: 0, borderRadius: 1.5, textAlign: "left" }}
          >
            <Box sx={{ display: "grid", placeItems: "center", width: { xs: 36, lg: 40 }, height: { xs: 36, lg: 40 }, flexShrink: 0, borderRadius: { xs: 1.5, lg: 1.75 }, color: "common.white", background: "linear-gradient(145deg, #14b8a6, #0f766e)", boxShadow: "0 7px 16px rgba(15,118,110,.2)" }}><School sx={{ fontSize: { xs: 21, lg: 23 } }} /></Box>
            <Stack spacing={0} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>Lớp học cô Vy</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", lg: "block" }, lineHeight: 1.1 }}>Tiếng Anh lớp 1–9</Typography>
            </Stack>
          </ButtonBase>
          <Box sx={{ display: { xs: "none", lg: "block" }, mr: 1.25, px: 1.5, py: 0.75, borderRadius: 999, bgcolor: uiTokens.colors.subtleSurface, color: "primary.dark", fontSize: 12, fontWeight: 600 }}>{displayDashboardDate(today)}</Box>
          <IconButton data-testid="account-menu-button" aria-label="Mở menu tài khoản" aria-controls={accountAnchor ? "admin-account-menu" : undefined} aria-haspopup="menu" aria-expanded={accountAnchor ? "true" : undefined} onClick={(event) => setAccountAnchor(event.currentTarget)}>
            <AccountCircle />
          </IconButton>
          <Menu id="admin-account-menu" anchorEl={accountAnchor} open={Boolean(accountAnchor)} onClose={closeAccountMenu} slotProps={{ paper: { sx: { minWidth: 230, mt: 0.75 } } }}>
            <MenuItem onClick={() => openAccountRoute("/admin/vocabulary")}><Translate fontSize="small" sx={{ mr: 1.25 }} /><ListItemText>Kho từ vựng</ListItemText></MenuItem>
            <MenuItem onClick={() => openAccountRoute("/admin/assignments")}><MenuBook fontSize="small" sx={{ mr: 1.25 }} /><ListItemText>Bài tập từ vựng</ListItemText></MenuItem>
            <MenuItem onClick={() => openAccountRoute("/admin/account")}><AccountCircle fontSize="small" sx={{ mr: 1.25 }} /><ListItemText>Tài khoản</ListItemText></MenuItem>
            <Divider />
            <MenuItem onClick={logout}><Logout fontSize="small" sx={{ mr: 1.25 }} /><ListItemText>Đăng xuất</ListItemText></MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        data-testid="desktop-navigation"
        sx={{
          display: { xs: "none", lg: "block" },
          width: uiTokens.desktopNavigationWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: uiTokens.desktopNavigationWidth,
            top: uiTokens.navigationHeight,
            height: `calc(100% - ${uiTokens.navigationHeight}px)`,
            boxSizing: "border-box",
            borderRightColor: "divider",
            background: "linear-gradient(180deg, #fbfffe 0%, #f3faf8 100%)",
            p: "18px 12px 20px",
            overflow: "hidden",
          },
        }}
      >
        <List component="nav" aria-label="Điều hướng quản trị trên máy tính" sx={{ p: 0, pb: 23, height: "100%", overflowY: "auto" }}>
          {desktopNav.map(([path, icon, label], index) => <ListItemButton
            key={path}
            selected={desktopCurrent === index}
            onClick={() => navigate(path)}
            sx={{ minHeight: 44, borderRadius: 1.5, mb: 0.5, px: 1.5, color: "text.secondary", "&:hover": { bgcolor: "#edf8f5", color: "primary.dark" }, "&.Mui-selected": { bgcolor: uiTokens.colors.primarySurface, color: "primary.dark", boxShadow: "inset 0 0 0 1px rgba(20,184,166,.08)" }, "&.Mui-selected:hover": { bgcolor: "#d3f2eb" } }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: desktopCurrent === index ? "primary.main" : "text.secondary", "& .MuiSvgIcon-root": { fontSize: 20 } }}>{icon}</ListItemIcon>
            <ListItemText primary={label} slotProps={{ primary: { variant: "body2", sx: { fontWeight: desktopCurrent === index ? 600 : 500 } } }} />
          </ListItemButton>)}
        </List>
        <Box sx={{ position: "absolute", left: 12, right: 12, bottom: 16, height: 170, overflow: "hidden", border: `1px solid ${uiTokens.colors.border}`, borderRadius: 2.5, background: "linear-gradient(155deg, #e8f8f4, #eaf5ff)", "@media (max-height: 760px)": { display: "none" } }}>
          <Typography sx={{ position: "absolute", zIndex: 1, top: 13, left: 14, right: 10, color: "#4d6d68", fontSize: 11.5, lineHeight: 1.45, fontWeight: 600 }}>Mỗi ngày một niềm vui dạy học</Typography>
          <Box component="img" src="/assets/admin-ui/sidebar-english-learning.webp" alt="" aria-hidden="true" sx={{ position: "absolute", width: "100%", height: 280, left: 0, bottom: -77, objectFit: "contain", objectPosition: "center" }} />
        </Box>
      </Drawer>
      <Box sx={{ ml: { lg: `${uiTokens.desktopNavigationWidth}px` }, pt: `${uiTokens.navigationHeight}px`, minWidth: 0 }}>
        <Container
          component="main"
          maxWidth={false}
          data-testid="admin-content"
          sx={{ width: "100%", maxWidth: `${uiTokens.contentWidth}px`, mx: "auto", px: { xs: 1.5, sm: 3, lg: 3.5 }, py: { xs: 1.5, lg: 3 }, minWidth: 0 }}
        >
          <Outlet />
        </Container>
      </Box>
      <Box
        data-testid="mobile-navigation-shell"
        sx={{
          display: { xs: "flex", lg: "none" },
          flexDirection: "column",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          height: `calc(${uiTokens.navigationHeight}px + var(--admin-safe-bottom))`,
          bgcolor: "#ffffff",
          boxShadow: "0 -7px 25px rgba(15, 118, 110, 0.08)",
          boxSizing: "border-box",
          transform: "translate3d(0, 0, 0)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          contain: "layout paint",
          isolation: "isolate",
          transition: "none",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            bgcolor: "divider",
            pointerEvents: "none",
          },
          "& .MuiBottomNavigationAction-root": {
            boxSizing: "border-box",
            height: `${uiTokens.navigationHeight}px`,
            maxHeight: `${uiTokens.navigationHeight}px`,
            transition: "none",
          },
        }}
      >
        <BottomNavigation
          showLabels
          data-testid="mobile-navigation"
          aria-label="Điều hướng quản trị chính"
          value={current}
          onChange={(_e, value) => navigate(nav[value][0])}
          sx={{
            display: { xs: "flex", lg: "none" },
            flex: "0 0 auto",
            width: "100%",
            height: `${uiTokens.navigationHeight}px`,
            bgcolor: "#ffffff",
            boxSizing: "border-box",
            transition: "none",
          }}
        >
          {nav.map(([, icon, label]) => (
            <BottomNavigationAction key={label} label={label} icon={icon} aria-label={label} />
          ))}
        </BottomNavigation>
        <Box
          data-testid="mobile-navigation-safe-area"
          aria-hidden="true"
          sx={{ flex: "0 0 auto", width: "100%", height: "var(--admin-safe-bottom)", bgcolor: "#ffffff" }}
        />
      </Box>
    </Box>
    </ThemeProvider>
  );
}
