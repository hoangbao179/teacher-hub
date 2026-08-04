import { AutoStoriesOutlined } from "@mui/icons-material";
import { Box, Stack, ThemeProvider, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { PublicHeader } from "../../../components/PublicHeader";
import { publicHomeContent } from "../../../content/publicHome";
import { publicLearningTheme } from "../../../theme";

export function BookShell({ children, readerMode = false }: PropsWithChildren<{ readerMode?: boolean }>) {
  return (
    <ThemeProvider theme={publicLearningTheme}><Box data-testid="book-shell" sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", overflowX: "clip", bgcolor: readerMode ? "#eef3f5" : "background.default", color: "text.primary", "& > main": { flex: "1 0 auto" }, "& h1, & h2, & h3": { textWrap: "balance" }, "& p": { textWrap: "pretty" } }}>
      {!readerMode && <PublicHeader active="books" />}
      {children}
      {!readerMode && <Box component="footer" sx={{ flex: "0 0 auto", height: "auto", py: 1.5, pb: "calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid #dbe7eb", bgcolor: "white" }}>
        <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", alignItems: "center" }}>
          <AutoStoriesOutlined aria-hidden="true" sx={{ fontSize: 17, color: "#159f98" }} />
          <Typography color="text.secondary" sx={{ fontSize: 12.5 }}>{publicHomeContent.footer.copy}</Typography>
        </Stack>
      </Box>}
    </Box></ThemeProvider>
  );
}
