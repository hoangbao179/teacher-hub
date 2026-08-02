import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { publicHomeContent } from "../content/publicHome";

type PublicSection = "home" | "learning" | "books";

interface PublicHeaderProps {
  active: PublicSection;
  showHomepageLinks?: boolean;
}

const navButtonSx = {
  minHeight: "44px !important",
  minWidth: 0,
  px: { xs: 1.25, sm: 1.5 },
  borderRadius: 2,
  whiteSpace: "nowrap",
  fontSize: { xs: 13.5, sm: 14 },
  fontWeight: 700,
} as const;

export function PublicHeader({ active, showHomepageLinks = false }: PublicHeaderProps) {
  const activeSx = { bgcolor: "#e5f6f3", color: "#087a72", "&:hover": { bgcolor: "#d8f0ec" } } as const;

  return (
    <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "rgba(255,255,255,.96)", backdropFilter: "blur(10px)" }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: "56px !important", sm: "60px !important" }, gap: { xs: 0.5, sm: 0.75 } }}>
          <Box component={Link} to="/" aria-label="Trang chủ" data-testid="header-logo-link" sx={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 2 }}>
            <Box data-testid="header-logo" component="img" src={publicHomeContent.media.headerMark} alt="" width="32" height="32" sx={{ width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 } }} />
          </Box>
          <Typography data-testid="header-brand" component={Link} to="/" color="inherit" sx={{ display: { xs: "none", sm: "flex" }, flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", textDecoration: "none", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap" }}>
            {publicHomeContent.headerBrandName}
          </Typography>
          <Box sx={{ display: { xs: "block", sm: "none" }, flex: 1 }} />
          <Stack component="nav" aria-label="Điều hướng công khai" direction="row" spacing={{ xs: 0.25, sm: 0.5 }} sx={{ alignItems: "center", flexShrink: 0 }}>
            <Button component={Link} to="/" data-testid="header-home" aria-current={active === "home" ? "page" : undefined} sx={{ ...navButtonSx, display: { xs: "none", md: "inline-flex" }, ...(active === "home" ? activeSx : {}) }}>Trang chủ</Button>
            <Button component={Link} to="/hoc" data-testid="header-learning" aria-current={active === "learning" ? "page" : undefined} sx={{ ...navButtonSx, ...(active === "learning" ? activeSx : {}) }}>Góc học</Button>
            <Button component={Link} to="/sach" data-testid="header-books" aria-current={active === "books" ? "page" : undefined} sx={{ ...navButtonSx, ...(active === "books" ? activeSx : {}) }}>Tủ sách</Button>
            {showHomepageLinks && <Button component="a" href="#contact" data-testid="header-contact" sx={{ ...navButtonSx, display: { xs: "none", md: "inline-flex" } }}>Liên hệ</Button>}
            {showHomepageLinks && <Button component={Link} to="/admin/login" data-testid="header-admin" color="inherit" sx={{ ...navButtonSx, display: { xs: "none", md: "inline-flex" } }}>Quản trị</Button>}
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
