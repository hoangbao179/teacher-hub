import { Box, CircularProgress } from "@mui/material";
export function LoadingState() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: 180 }}>
      <CircularProgress />
    </Box>
  );
}
