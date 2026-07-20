import { Box, CircularProgress, Typography } from "@mui/material";
export function LoadingState({ message = "Đang tải dữ liệu…" }: { message?: string }) {
  return (
    <Box role="status" aria-live="polite" sx={{ display: "grid", placeItems: "center", gap: 1, minHeight: 180 }}>
      <CircularProgress aria-hidden="true" />
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}
