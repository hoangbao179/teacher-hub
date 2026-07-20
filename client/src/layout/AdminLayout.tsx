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
  const current = Math.max(
    0,
    nav.findIndex(([path]) =>
      path === "/admin"
        ? location.pathname === "/admin"
        : location.pathname.startsWith(path),
    ),
  );
  return (
    <Box sx={{ pb: "78px" }}>
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
      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Outlet />
      </Container>
      <BottomNavigation
        showLabels
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
          height: "calc(64px + env(safe-area-inset-bottom))",
        }}
      >
        {nav.map(([, icon, label]) => (
          <BottomNavigationAction key={label} label={label} icon={icon} />
        ))}
      </BottomNavigation>
    </Box>
  );
}
