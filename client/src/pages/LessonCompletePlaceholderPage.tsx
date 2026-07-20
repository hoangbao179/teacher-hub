import { Alert, Stack, Typography } from "@mui/material";
export function LessonCompletePlaceholderPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h5" sx={{ fontWeight: 900 }}>
        Điểm danh và hoàn thành
      </Typography>
      <Alert severity="info">
        Route và API core đã có. Triển khai wizard 3 bước theo wireframe 05–07
        và `docs/features/lesson-recording.md` trong milestone tiếp theo.
      </Alert>
    </Stack>
  );
}
