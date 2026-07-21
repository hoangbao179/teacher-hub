import {
  CalendarMonth,
  Groups,
  Home,
  Person,
  Payments,
  Logout,
  School,
} from "@mui/icons-material";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
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
} from "@mui/material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { uiTokens } from "../theme";

const nav = [
  ["/admin", <Home key="home" />, "Hôm nay"],
  ["/admin/calendar", <CalendarMonth key="calendar" />, "Lịch"],
  ["/admin/classes", <Groups key="classes" />, "Lớp học"],
  ["/admin/tuition", <Payments key="tuition" />, "Học phí"],
  ["/admin/students", <Person key="students" data-testid="student-navigation-icon" />, "Học sinh"],
] as const;
export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const directIndex = nav.findIndex(([path]) =>
      path === "/admin"
        ? location.pathname === "/admin"
        : location.pathname.startsWith(path),
    );
  const current = directIndex >= 0 ? directIndex
    : /^\/admin\/(reconciliation|busy-slots|lessons)/.test(location.pathname) ? 1
      : 0;
  return (
    <Box sx={{ minHeight: "100dvh", minWidth: 0, overflowX: "clip", pb: { xs: `calc(${uiTokens.navigationHeight}px + env(safe-area-inset-bottom) + 16px)`, md: 0 } }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider", zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar sx={{ minHeight: `${uiTokens.navigationHeight}px !important`, px: { xs: 2, md: 3 } }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexGrow: 1 }}>
            <Box sx={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 2, bgcolor: "#eee8ff", color: "primary.main" }}><School sx={{ fontSize: 20 }} /></Box>
            <Typography variant="subtitle1">Lớp học cô Vy</Typography>
          </Stack>
          <IconButton aria-label="Đăng xuất" onClick={() => void auth.logout().then(() => navigate("/admin/login"))}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        data-testid="desktop-navigation"
        sx={{
          display: { xs: "none", md: "block" },
          width: uiTokens.desktopNavigationWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: uiTokens.desktopNavigationWidth,
            top: uiTokens.navigationHeight,
            height: `calc(100% - ${uiTokens.navigationHeight}px)`,
            boxSizing: "border-box",
            borderRightColor: "divider",
            bgcolor: "#fbfaff",
            p: 1.5,
          },
        }}
      >
        <List component="nav" aria-label="Điều hướng quản trị trên máy tính">
          {nav.map(([path, icon, label], index) => <ListItemButton
            key={path}
            selected={current === index}
            onClick={() => navigate(path)}
            sx={{ borderRadius: 1.25, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: current === index ? "primary.main" : "text.secondary" }}>{icon}</ListItemIcon>
            <ListItemText primary={label} slotProps={{ primary: { variant: "body2", sx: { fontWeight: current === index ? 600 : 500 } } }} />
          </ListItemButton>)}
        </List>
      </Drawer>
      <Box sx={{ ml: { md: `${uiTokens.desktopNavigationWidth}px` }, pt: `${uiTokens.navigationHeight}px`, minWidth: 0 }}>
        <Container
          component="main"
          maxWidth={false}
          data-testid="admin-content"
          sx={{ width: "100%", maxWidth: `${uiTokens.contentWidth}px`, mx: "auto", px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2, md: 3 }, minWidth: 0 }}
        >
          <Outlet />
        </Container>
      </Box>
      <BottomNavigation
        showLabels
        data-testid="mobile-navigation"
        aria-label="Điều hướng quản trị chính"
        value={current}
        onChange={(_e, value) => navigate(nav[value][0])}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          pb: "env(safe-area-inset-bottom)",
          height: `calc(${uiTokens.navigationHeight}px + env(safe-area-inset-bottom))`,
        }}
      >
        {nav.map(([, icon, label]) => (
          <BottomNavigationAction key={label} label={label} icon={icon} aria-label={label} />
        ))}
      </BottomNavigation>
    </Box>
  );
}
