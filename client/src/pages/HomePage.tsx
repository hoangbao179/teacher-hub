import { Facebook, Phone, School } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from "@mui/material";
export function HomePage() {
  return (
    <Box>
      <Box
        sx={{
          minHeight: 420,
          display: "grid",
          alignItems: "end",
          p: 3,
          color: "white",
          background: "linear-gradient(135deg,#33205f,#8c63f7)",
        }}
      >
        <Container maxWidth="sm">
          <School sx={{ fontSize: 46 }} />
          <Typography variant="h3" sx={{ fontWeight: 900 }}>
            Dạy tận tâm
            <br />
            Học tiến bộ mỗi ngày
          </Typography>
          <Typography sx={{ my: 2 }}>
            Lớp 1 kèm 1 và lớp nhóm, theo sát năng lực từng học sinh.
          </Typography>
          <Button variant="contained" color="secondary" size="large">
            Liên hệ ngay
          </Button>
        </Container>
      </Box>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Về cô giáo
        </Typography>
        <Typography sx={{ mt: 1, color: "text.secondary" }}>
          Nội dung Home do developer quản lý trực tiếp trong source. Không có
          CMS trong V1.
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 4 }}>
          Phương pháp giảng dạy
        </Typography>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {[
            "Cá nhân hóa theo từng học sinh",
            "Lộ trình rõ ràng",
            "Theo dõi từng buổi học",
          ].map((text) => (
            <Card key={text}>
              <CardContent>
                <Typography sx={{ fontWeight: 700 }}>{text}</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 4 }}>
          Video học tập
        </Typography>
        <Box
          sx={{
            aspectRatio: "16/9",
            borderRadius: 3,
            bgcolor: "#ddd",
            display: "grid",
            placeItems: "center",
            mt: 2,
          }}
        >
          YouTube embed / thumbnail
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 4 }}>
          <Button fullWidth variant="contained">
            Zalo
          </Button>
          <Button fullWidth variant="outlined" startIcon={<Phone />}>
            Gọi
          </Button>
          <Button fullWidth variant="outlined" startIcon={<Facebook />}>
            Facebook
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
