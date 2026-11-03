import { ArrowBack, AutoStories } from "@mui/icons-material";
import { Box, Button, Container, Stack, ThemeProvider, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { adminTheme } from "../../theme";

export function TeacherGameShell({
  title, subtitle, children, backTo = "/admin/games",
}: {
  title: string; subtitle: string; children: ReactNode; backTo?: string;
}) {
  return (
    <ThemeProvider theme={adminTheme}>
      <Box sx={{
        minHeight: "100svh", overflowX: "clip",
        bgcolor: "#f5faf8",
        background: "linear-gradient(165deg, #effbf6 0%, #f7fbff 48%, #fff9f3 100%)",
        px: { xs: 1.5, sm: 3 },
        pt: "max(16px, env(safe-area-inset-top))",
        pb: "max(32px, env(safe-area-inset-bottom))",
      }}>
        <Container maxWidth="md" disableGutters>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Button component={Link} to={backTo} startIcon={<ArrowBack />} sx={{ minHeight: 48 }}>Quay lại</Button>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minWidth: 0, color: "#0f766e" }}>
              <AutoStories aria-hidden="true" />
              <Typography variant="body2" sx={{ fontWeight: 800 }}>Tiếng Anh cô Vy</Typography>
            </Stack>
          </Stack>
          <Stack sx={{ mt: { xs: 2, sm: 3 }, mb: 3 }} spacing={0.75}>
            <Typography component="h1" variant="h4" sx={{ fontSize: { xs: "1.65rem", sm: "2rem" }, fontWeight: 800 }}>{title}</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 650 }}>{subtitle}</Typography>
          </Stack>
          {children}
        </Container>
      </Box>
    </ThemeProvider>
  );
}
