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

const textLinkSx = {
  ...navButtonSx,
  color: "text.primary",
  bgcolor: "transparent",
  "&:link, &:visited, &:hover, &:active": {
    color: "text.primary",
    bgcolor: "transparent",
  },
} as const;

export function PublicHeader({ active, showHomepageLinks = false }: PublicHeaderProps) {
  const activeSx = { bgcolor: "#e5f6f3", color: "#087a72", "&:hover": { bgcolor: "#d8f0ec" } } as const;

  return (
    <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "rgba(255,255,255,.96)", backdropFilter: "blur(10px)" }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: "56px !important", sm: "60px !important" }, gap: { xs: 0.5, sm: 0.75 } }}>
          <Box component={Link} to="/" aria-label="Trang chủ" data-testid="header-logo-link" sx={{ minWidth: 44, minHeight: 44, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 2, bgcolor: "transparent", "&:link, &:visited, &:hover, &:active": { bgcolor: "transparent" } }}>
            <Box data-testid="header-logo" component="img" src={publicHomeContent.media.headerMark} alt="" width="32" height="32" sx={{ width: { xs: 28, sm: 32 }, height: { xs: 28, sm: 32 } }} />
          </Box>
          <Typography data-testid="header-brand" component={Link} to="/" sx={{ display: { xs: "none", sm: "flex" }, flex: 1, minWidth: 0, minHeight: 44, alignItems: "center", color: "text.primary", bgcolor: "transparent", textDecoration: "none", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", "&:link, &:visited, &:hover, &:active": { color: "text.primary", bgcolor: "transparent", textDecoration: "none" } }}>
            {publicHomeContent.headerBrandName}
          </Typography>
          <Box sx={{ display: { xs: "block", sm: "none" }, flex: 1 }} />
          <Stack component="nav" aria-label="Điều hướng công khai" direction="row" spacing={{ xs: 0.25, sm: 0.5 }} sx={{ alignItems: "center", flexShrink: 0 }}>
            {showHomepageLinks ? <>
              <Button disableRipple component="a" href="#contact" data-testid="header-contact" sx={textLinkSx}>Liên hệ</Button>
            </> : <>
              <Button component={Link} to="/hoc" data-testid="header-learning" aria-current={active === "learning" ? "page" : undefined} sx={{ ...navButtonSx, px: { xs: 0.75, sm: 1.5 }, ...(active === "learning" ? activeSx : {}) }}>Góc học</Button>
              <Button component={Link} to="/sach" data-testid="header-books" aria-current={active === "books" ? "page" : undefined} sx={{ ...navButtonSx, px: { xs: 0.75, sm: 1.5 }, ...(active === "books" ? activeSx : {}) }}>Tủ sách</Button>
            </>}
            <Button disableRipple component={Link} to="/admin/login" data-testid="header-admin" sx={textLinkSx}>Quản trị</Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
