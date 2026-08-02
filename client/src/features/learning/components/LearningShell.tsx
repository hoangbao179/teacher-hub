import { AutoStories } from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import type { PropsWithChildren } from "react";
import { PublicHeader } from "../../../components/PublicHeader";

export function LearningShell({ children }: PropsWithChildren) {
  return (
    <Box sx={{ minHeight: "100dvh", overflowX: "clip", bgcolor: "#fbf9ff", color: "#27223b", "& h1, & h2, & h3": { textWrap: "balance" }, "& p": { textWrap: "pretty" } }}>
      <PublicHeader active="learning" />
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
