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
import { Link } from "react-router-dom";
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
          <Button component="a" href="#contact" variant="contained" color="secondary" size="large">
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
        <Stack id="contact" direction="row" spacing={1} sx={{ mt: 4 }}>
          <Button fullWidth variant="contained" disabled>
            Zalo · Chưa cấu hình
          </Button>
          <Button fullWidth variant="outlined" startIcon={<Phone />} disabled>
            Gọi · Chưa cấu hình
          </Button>
          <Button fullWidth variant="outlined" startIcon={<Facebook />} disabled>
            Facebook · Chưa cấu hình
          </Button>
        </Stack>
        {import.meta.env.DEV && (
          <Button component={Link} to="/admin/login" sx={{ mt: 3 }} size="small">
            Đăng nhập quản trị (development)
          </Button>
        )}
      </Container>
    </Box>
  );
}
