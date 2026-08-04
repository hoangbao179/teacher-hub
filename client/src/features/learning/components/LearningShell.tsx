import { AutoStories } from "@mui/icons-material";
import { Box, Stack, ThemeProvider, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { PublicHeader } from "../../../components/PublicHeader";
import { publicLearningTheme, publicUiTokens } from "../../../theme";

export function LearningShell({ children }: PropsWithChildren) {
  return (
    <ThemeProvider theme={publicLearningTheme}><Box sx={{ minHeight: "100dvh", overflowX: "clip", bgcolor: "background.default", color: "text.primary", "& h1, & h2, & h3": { textWrap: "balance" }, "& p": { textWrap: "pretty" } }}>
      <PublicHeader active="learning" />
      {children}
      <Box component="footer" sx={{ py: 2, pb: "calc(16px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${publicUiTokens.border}`, bgcolor: "white" }}>
        <Stack direction="row" spacing={0.75} aria-label="Góc học công khai của lớp tiếng Anh cô Vy" sx={{ justifyContent: "center", alignItems: "center" }}>
          <AutoStories aria-hidden="true" sx={{ fontSize: 17, color: "primary.main" }} />
          <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>Học vui mỗi ngày cùng cô Vy</Typography>
        </Stack>
      </Box>
    </Box></ThemeProvider>
  );
}
