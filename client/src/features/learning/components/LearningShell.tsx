import { AutoStories, HomeOutlined } from "@mui/icons-material";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

export function LearningShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ minHeight: "100dvh", overflowX: "clip", bgcolor: "#fbf9ff", color: "#27223b", "& h1, & h2, & h3": { textWrap: "balance" }, "& p": { textWrap: "pretty" } }}>
      <AppBar component="header" position="sticky" color="inherit" elevation={0} sx={{ borderBottom: "1px solid #e5ddf6", bgcolor: "rgba(255,255,255,.95)", backdropFilter: "blur(10px)" }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: "60px !important", gap: 1 }}>
            <Box aria-hidden="true" sx={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 2.5, bgcolor: "#7455d9", color: "white" }}><AutoStories fontSize="small" /></Box>
            <Typography component={Link} to="/hoc" color="inherit" sx={{ flex: 1, minWidth: 0, minHeight: 44, display: "flex", alignItems: "center", textDecoration: "none", fontSize: { xs: 14, sm: 16 }, fontWeight: 800, whiteSpace: "nowrap" }}>Lớp tiếng Anh cô Vy</Typography>
            <Button component={Link} to="/" color="inherit" startIcon={<HomeOutlined />} sx={{ minWidth: 44, minHeight: "44px !important", px: { xs: 1, sm: 1.5 }, "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}>
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Trang chủ</Box>
            </Button>
          </Toolbar>
        </Container>
      </AppBar>
      {children}
      <Box component="footer" sx={{ py: 2, pb: "calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #e5ddf6", bgcolor: "white" }}>
        <Stack direction="row" spacing={0.75} aria-label="Góc học công khai của lớp tiếng Anh cô Vy" sx={{ justifyContent: "center", alignItems: "center" }}>
          <AutoStories aria-hidden="true" sx={{ fontSize: 17, color: "#7455d9" }} />
          <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Học vui mỗi ngày cùng cô Vy</Typography>
        </Stack>
      </Box>
    </Box>
  );
}
