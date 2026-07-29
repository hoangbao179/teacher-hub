import { Box, Typography } from "@mui/material";
export function EmptyState({ message }: { message: string }) {
  return (
    <Box role="status" sx={{ p: { xs: 3, md: 4 }, textAlign: "center", color: "text.secondary", border: "1px dashed", borderColor: "divider", borderRadius: 2, bgcolor: "rgba(240,247,245,.65)" }}>
      <Typography>{message}</Typography>
    </Box>
  );
}
