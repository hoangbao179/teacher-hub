import { Box, Typography } from "@mui/material";
export function EmptyState({ message }: { message: string }) {
  return (
    <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
      <Typography>{message}</Typography>
    </Box>
  );
}
