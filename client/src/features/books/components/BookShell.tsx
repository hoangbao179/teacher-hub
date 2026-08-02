import { AutoStoriesOutlined } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { PublicHeader } from "../../../components/PublicHeader";
import { publicHomeContent } from "../../../content/publicHome";

export function BookShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ minHeight: "100dvh", overflowX: "clip", bgcolor: "#f7fbfc", color: "#172238", "& h1, & h2, & h3": { textWrap: "balance" }, "& p": { textWrap: "pretty" } }}>
      <PublicHeader active="books" />
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
