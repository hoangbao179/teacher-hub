import {
  CalendarMonth,
  Groups,
  Home,
  Menu,
  Payments,
  Logout,
} from "@mui/icons-material";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Container,
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
  ["/admin/students", <Menu key="students" />, "Học sinh"],
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
    <Box sx={{ pb: `calc(${uiTokens.navigationHeight}px + env(safe-area-inset-bottom) + 16px)`, minWidth: 0, overflowX: "clip" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar>
          <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>Teacher Class Hub</Typography>
          <IconButton aria-label="Đăng xuất" onClick={() => void auth.logout().then(() => navigate("/admin/login"))}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="sm" sx={{ py: 2, minWidth: 0 }}>
        <Outlet />
      </Container>
      <BottomNavigation
        showLabels
        aria-label="Điều hướng quản trị chính"
        value={current}
        onChange={(_e, value) => navigate(nav[value][0])}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          borderTop: 1,
          borderColor: "divider",
          pb: "env(safe-area-inset-bottom)",
          height: `calc(${uiTokens.navigationHeight}px + env(safe-area-inset-bottom))`,
        }}
      >
        {nav.map(([, icon, label]) => (
          <BottomNavigationAction key={label} label={label} icon={icon} />
        ))}
      </BottomNavigation>
    </Box>
  );
}
