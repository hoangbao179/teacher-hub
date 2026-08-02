import { AutoStoriesOutlined, HomeOutlined, SchoolOutlined } from "@mui/icons-material";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";
import { publicHomeContent } from "../../../content/publicHome";

export function BookShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ minHeight: "100dvh", overflowX: "clip", bgcolor: "#f7fbfc", color: "#172238", "& h1, & h2, & h3": { textWrap: "balance" }, "& p": { textWrap: "pretty" } }}>
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid #dbe7eb", bgcolor: "rgba(255,255,255,.96)", backdropFilter: "blur(10px)" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: "60px !important", gap: { xs: 0.5, sm: 1 } }}>
            <Box aria-hidden="true" sx={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "#159f98", color: "white", flexShrink: 0 }}><AutoStoriesOutlined fontSize="small" /></Box>
            <Typography component={Link} to="/sach" color="inherit" sx={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", textDecoration: "none", fontSize: { xs: 14, sm: 16 }, fontWeight: 800, whiteSpace: "nowrap" }}>Tủ sách cô Vy</Typography>
            <Button component={Link} to="/hoc" color="inherit" aria-label="Góc học miễn phí" startIcon={<SchoolOutlined />} sx={{ minWidth: 44, minHeight: "44px !important", px: { xs: 1, sm: 1.5 }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Góc học</Box></Button>
            <Button component={Link} to="/" color="inherit" aria-label="Trang chủ" startIcon={<HomeOutlined />} sx={{ minWidth: 44, minHeight: "44px !important", px: { xs: 1, sm: 1.5 }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}><Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Trang chủ</Box></Button>
          </Toolbar>
        </Container>
      </AppBar>
      {children}
      <Box component="footer" sx={{ py: 2, pb: "calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #dbe7eb", bgcolor: "white" }}>
        <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", alignItems: "center" }}>
          <AutoStoriesOutlined aria-hidden="true" sx={{ fontSize: 17, color: "#159f98" }} />
          <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>{publicHomeContent.footer.copy}</Typography>
        </Stack>
      </Box>
    </Box>
  );
}
