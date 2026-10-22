import {
  ArrowBackRounded,
  AutoStoriesRounded,
  CloudUploadRounded,
  FavoriteRounded,
  LocalFloristRounded,
  OpenInNewRounded,
  PhotoLibraryRounded,
  PrintRounded,
  SpaRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Container,
  GlobalStyles,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { theme } from "../theme";

type PrintImage = { name: string; url: string };

function inspectLink(raw: string): { url: string; host: string; hint: string } | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    let hint = "Công cụ sẽ mở trang gốc. Nếu chủ tài liệu cho phép, cô chọn Tải xuống hoặc In tại đó.";
    if (host === "drive.google.com") {
      hint = "Google Drive: mở file và chọn biểu tượng Tải xuống nếu chủ file cho phép.";
    } else if (host === "docs.google.com") {
      hint = "Google Docs/Sheets/Slides: mở tài liệu, vào Tệp → Tải xuống để chọn PDF nếu được cho phép.";
    }
    return { url: url.href, host, hint };
  } catch {
    return null;
  }
}

const cardSx = {
  borderRadius: { xs: 4, sm: 5 },
  border: "2px solid rgba(255,255,255,.95)",
  boxShadow: "0 14px 34px rgba(69,49,102,.10)",
  p: { xs: 2.5, sm: 3.5 },
  position: "relative",
  overflow: "hidden",
} as const;

export function PublicToolsPage() {
  const [link, setLink] = useState("");
  const [images, setImages] = useState<PrintImage[]>([]);
  const [imageMessage, setImageMessage] = useState("");
  const imageUrls = useRef<PrintImage[]>([]);
  const inspected = link.trim() ? inspectLink(link) : null;

  useEffect(() => () => {
    imageUrls.current.forEach((image) => URL.revokeObjectURL(image.url));
  }, []);

  function pickImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const allowed = files.filter((file) => ["image/png", "image/jpeg", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024);
    const printable = allowed.slice(0, 12);
    if (!printable.length) {
      setImageMessage("Cô chọn ảnh JPG, PNG hoặc WebP, mỗi ảnh không quá 10 MB nhé.");
      return;
    }
    imageUrls.current.forEach((image) => URL.revokeObjectURL(image.url));
    const next = printable.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }));
    imageUrls.current = next;
    setImages(next);
    setImageMessage(
      files.length > printable.length
        ? "Đã nhận " + printable.length + " ảnh. Mỗi lần hỗ trợ tối đa 12 ảnh JPG/PNG/WebP, mỗi ảnh tối đa 10 MB."
        : "Đã sẵn sàng " + printable.length + " ảnh. Cô chọn In A4 để in hoặc lưu PDF."
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles styles={{
        "@page": { size: "A4 portrait", margin: "10mm" },
        "@media print": {
          "html, body": { background: "#fff !important", margin: 0 },
          "#teacher-tools-ui": { display: "none !important" },
          "#teacher-print-pages": { display: "block !important" },
        },
      }} />
      <Box id="teacher-tools-ui" data-testid="public-teacher-tools" sx={{
        minHeight: "100svh",
        overflowX: "clip",
        color: "#392e58",
        bgcolor: "#fff8fd",
        background: "radial-gradient(circle at 7% 10%, #fff0a9 0, transparent 25%), radial-gradient(circle at 90% 3%, #fcd6ef 0, transparent 32%), linear-gradient(165deg, #fff9ed, #f8efff 52%, #edfff8)",
        pt: "max(16px, env(safe-area-inset-top))",
        pb: "max(36px, env(safe-area-inset-bottom))",
      }}>
        <Container maxWidth="md">
          <Button component={Link} to="/" startIcon={<ArrowBackRounded />} sx={{ color: "#5b4686", minHeight: 48, fontWeight: 800 }}>
            Về trang chủ
          </Button>
          <Box sx={{ textAlign: "center", position: "relative", pt: { xs: 1.5, sm: 3 }, pb: 3 }}>
            <LocalFloristRounded aria-hidden="true" sx={{ position: "absolute", color: "#ef80b7", fontSize: { xs: 42, sm: 58 }, transform: "rotate(-22deg)", top: { xs: 8, sm: 16 }, left: { xs: 0, sm: 74 }, opacity: .9 }} />
            <SpaRounded aria-hidden="true" sx={{ position: "absolute", color: "#88caa6", fontSize: { xs: 38, sm: 52 }, transform: "rotate(25deg)", right: { xs: 0, sm: 76 }, top: { xs: 16, sm: 22 } }} />
            <Chip label="GÓC TIỆN ÍCH CỦA CÔ VY" sx={{ bgcolor: "#fff", border: "1px solid #eed7ef", color: "#9256ae", fontWeight: 900, letterSpacing: ".04em", fontSize: { xs: 10.5, sm: 12 } }} />
            <Typography component="h1" sx={{ fontSize: { xs: 30, sm: 44 }, fontWeight: 900, lineHeight: 1.25, mt: 1.75, letterSpacing: "-.03em", color: "#713fb3" }}>
              Tài liệu xinh, in thật nhanh!
            </Typography>
            <Typography sx={{ mt: 1, color: "#76688b", maxWidth: 520, mx: "auto", fontSize: { xs: 14, sm: 17 }, lineHeight: 1.65 }}>
              Dán link hoặc chọn vài tấm ảnh. Cô chuẩn bị bài in ngay trên điện thoại, không cần vào hệ thống quản lý.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Chip icon={<FavoriteRounded />} label="Dễ dùng" size="small" sx={{ bgcolor: "#ffe0ee", color: "#af437e", fontWeight: 800 }} />
              <Chip icon={<AutoStoriesRounded />} label="Cho giờ học" size="small" sx={{ bgcolor: "#e5f7e7", color: "#367f55", fontWeight: 800 }} />
            </Stack>
          </Box>
          <Stack spacing={2.25} sx={{ maxWidth: 660, mx: "auto" }}>
            <Box component="section" aria-labelledby="link-tool-title" sx={{ ...cardSx, background: "linear-gradient(140deg,#ffffff,#fff5d8)" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 54, height: 54, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "#f3ddff", color: "#8340b9", flexShrink: 0 }}>
                  <OpenInNewRounded sx={{ fontSize: 29 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography id="link-tool-title" component="h2" sx={{ fontSize: { xs: 19, sm: 22 }, fontWeight: 900 }}>Mở tài liệu từ link</Typography>
                  <Typography sx={{ color: "#756888", fontSize: 13.5 }}>Google Drive, Google Docs và các trang tài liệu khác</Typography>
                </Box>
              </Stack>
              <TextField
                fullWidth
                type="url"
                label="Dán liên kết tài liệu vào đây"
                placeholder="https://drive.google.com/..."
                value={link}
                onChange={(event) => setLink(event.target.value)}
                error={Boolean(link.trim()) && !inspected}
                helperText={Boolean(link.trim()) && !inspected ? "Cô dán một liên kết HTTPS hợp lệ nhé." : "Không cần tải tài liệu lên website này."}
                sx={{ mt: 2.5, "& .MuiOutlinedInput-root": { borderRadius: 2.5, bgcolor: "#fff" } }}
                inputProps={{ "aria-label": "Liên kết tài liệu" }}
              />
              {inspected && (
                <Typography role="status" sx={{ mt: 1, fontSize: 13.5, color: "#625575", lineHeight: 1.6 }}>
                  {inspected.hint}
                </Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                component="a"
                href={inspected?.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!inspected}
                endIcon={<OpenInNewRounded />}
                sx={{ mt: 2, minHeight: 54, borderRadius: 3, bgcolor: "#854cd0", "&:hover": { bgcolor: "#6933b2" }, fontWeight: 900, fontSize: 15 }}
              >
                Mở tài liệu
              </Button>
              <Typography sx={{ mt: 1.5, fontSize: 12.5, color: "#8a7d91", lineHeight: 1.5 }}>
                Lưu ý: thao tác này mở trang gốc, chưa tự tải file. Nếu chủ sở hữu tắt quyền tải/in thì công cụ không thể lấy file thay cô.
              </Typography>
            </Box>
            <Box component="section" aria-labelledby="photo-tool-title" sx={{ ...cardSx, background: "linear-gradient(140deg,#ffffff,#e5fff0)" }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 54, height: 54, display: "grid", placeItems: "center", borderRadius: 3, bgcolor: "#ffdef0", color: "#be4f8d", flexShrink: 0 }}>
                  <PhotoLibraryRounded sx={{ fontSize: 30 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography id="photo-tool-title" component="h2" sx={{ fontSize: { xs: 19, sm: 22 }, fontWeight: 900 }}>Ảnh thành trang in A4</Typography>
                  <Typography sx={{ color: "#756888", fontSize: 13.5 }}>Chọn ảnh có sẵn rồi in hoặc lưu PDF</Typography>
                </Box>
              </Stack>
              <Box component="input" id="teacher-image-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pickImages} sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)" }} />
              <Button component="label" htmlFor="teacher-image-input" fullWidth variant="outlined" startIcon={<CloudUploadRounded />} sx={{ mt: 2.5, minHeight: 56, border: "2px dashed #76caa5", color: "#287b59", bgcolor: "rgba(255,255,255,.75)", borderRadius: 3, fontSize: 15, fontWeight: 900 }}>
                Chọn ảnh từ điện thoại
              </Button>
              {!!images.length && (
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 1, mt: 2 }}>
                  {images.map((image, index) => (
                    <Box key={image.url} component="img" src={image.url} alt={"Ảnh " + (index + 1) + ": " + image.name} sx={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 2, border: "2px solid #fff", boxShadow: "0 3px 10px rgba(0,0,0,.1)" }} />
                  ))}
                </Box>
              )}
              <Typography role="status" sx={{ mt: 1.25, minHeight: 20, color: "#547667", fontSize: 12.5 }}>{imageMessage || "Tối đa 12 ảnh JPG, PNG hoặc WebP; 10 MB mỗi ảnh."}</Typography>
              <Button fullWidth variant="contained" startIcon={<PrintRounded />} disabled={!images.length} onClick={() => window.print()} sx={{ mt: 1.25, minHeight: 54, borderRadius: 3, bgcolor: "#208b72", "&:hover": { bgcolor: "#176957" }, fontSize: 15, fontWeight: 900 }}>
                In A4 / Lưu thành PDF
              </Button>
              <Typography sx={{ color: "#758578", mt: 1.5, fontSize: 12.5, lineHeight: 1.5 }}>
                Mỗi ảnh nằm trên một trang A4. Trên điện thoại, chọn “Lưu thành PDF” trong hộp thoại in nếu thiết bị hỗ trợ. Ảnh chỉ xử lý trên máy của cô.
              </Typography>
            </Box>
          </Stack>
          <Typography sx={{ mt: 3.5, textAlign: "center", color: "#a48da9", fontSize: 12.5 }}>
            Làm giáo án nhẹ nhàng hơn, mỗi ngày một chút.
          </Typography>
        </Container>
      </Box>
      <Box id="teacher-print-pages" aria-label="Các trang ảnh để in" sx={{ display: "none" }}>
        {images.map((image, index) => (
          <Box key={image.url} sx={{
            width: "190mm",
            height: "270mm",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pageBreakAfter: index === images.length - 1 ? "auto" : "always",
            breakAfter: index === images.length - 1 ? "auto" : "page",
          }}>
            <Box component="img" src={image.url} alt={image.name} sx={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </Box>
        ))}
      </Box>
    </ThemeProvider>
  );
}
