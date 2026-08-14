import { AutoStories } from "@mui/icons-material";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { PlayShell } from "../PlayShell";

export function VocabularyGamesUnavailablePage() {
  return (
    <PlayShell>
      <Card data-testid="vocabulary-games-unavailable" sx={{ borderRadius: 5, boxShadow: "0 16px 50px rgba(57,77,124,.14)" }}>
        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
          <Stack spacing={2.25} sx={{ alignItems: "center", textAlign: "center" }}>
            <AutoStories aria-hidden sx={{ fontSize: 56, color: "primary.main" }} />
            <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>
              Trò chơi đang được hoàn thiện
            </Typography>
            <Typography color="text.secondary">
              Con có thể tiếp tục học ở Góc học.
            </Typography>
            <Button component={Link} to="/hoc" variant="contained" size="large" sx={{ minHeight: 48, borderRadius: 3 }}>
              Về Góc học
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </PlayShell>
  );
}
