import type { PropsWithChildren } from "react";
import { Box, Container, LinearProgress, Stack, ThemeProvider, Typography } from "@mui/material";
import { publicLearningTheme } from "../../theme";

export function PlayShell({
  children,
  progress,
  progressLabel,
}: PropsWithChildren<{ progress?: number; progressLabel?: string }>) {
  return (
    <ThemeProvider theme={publicLearningTheme}><Box sx={{
      minHeight: "100dvh",
      overflowX: "hidden",
      background: "linear-gradient(160deg,#fff6d9 0%,#eaf5ff 48%,#eaf8f3 100%)",
      pb: "max(24px,env(safe-area-inset-bottom))",
    }}>
      <Box component="header" sx={{ py: 1.5, px: 2 }}>
        <Container maxWidth="sm">
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Typography sx={{ fontWeight: 800, color: "primary.main" }}>
              Lớp học cô Vy
            </Typography>
            {progressLabel && (
              <Typography aria-live="polite" sx={{ fontWeight: 700, color: "text.secondary" }}>
                {progressLabel}
              </Typography>
            )}
          </Stack>
          {progress != null && (
            <LinearProgress
              aria-label="Tiến độ bài học"
              variant="determinate"
              value={Math.max(0, Math.min(100, progress))}
              sx={{ mt: 1, height: 10, borderRadius: 8 }}
            />
          )}
        </Container>
      </Box>
      <Container component="main" maxWidth="sm" sx={{ pt: { xs: 2, sm: 4 } }}>
        {children}
      </Container>
    </Box></ThemeProvider>
  );
}
