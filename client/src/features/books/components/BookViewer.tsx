import { FullscreenOutlined, OpenInNewOutlined } from "@mui/icons-material";
import { Alert, Box, Button, Stack } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { isAllowedBookPreviewUrl } from "../content/publicBookCatalog";
import type { PublicBook } from "../types";

export function BookViewer({ book }: { book: PublicBook }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [slowBookId, setSlowBookId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlowBookId(book.id), 8000);
    return () => window.clearTimeout(timer);
  }, [book.id]);

  if (!isAllowedBookPreviewUrl(book.previewUrl)) return <Alert severity="warning">Nguồn sách chưa hợp lệ. Vui lòng quay lại Tủ sách.</Alert>;

  const openFullscreen = async () => {
    if (shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen();
    else window.open(book.previewUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Stack spacing={1.5}>
      {slowBookId === book.id && <Alert severity="info" action={<Button component="a" href={book.previewUrl} target="_blank" rel="noopener noreferrer">Mở ở tab mới</Button>}>Sách có thể đang tải chậm. Em có thể tiếp tục chờ hoặc mở ở tab mới.</Alert>}
      <Box ref={shellRef} data-testid="book-viewer" sx={{ bgcolor: "#152337", borderRadius: { xs: 2.5, md: 3.5 }, overflow: "hidden", p: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
        <Box component="iframe" title={`Xem ${book.title}`} src={book.previewUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen" allowFullScreen sx={{ display: "block", width: "100%", height: { xs: "72dvh", md: "80vh" }, minHeight: { xs: 480, md: 620 }, border: 0, borderRadius: 1.5, bgcolor: "#fffdf5" }} />
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ pb: { xs: "calc(72px + env(safe-area-inset-bottom, 0px))", sm: 0 } }}>
        <Button variant="contained" onClick={openFullscreen} startIcon={<FullscreenOutlined />} sx={{ minHeight: 48, bgcolor: "#159f98", "&:hover": { bgcolor: "#0c817b" } }}>Mở toàn màn hình</Button>
        <Button component="a" href={book.previewUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<OpenInNewOutlined />} sx={{ minHeight: 48 }}>Mở sách ở tab mới</Button>
      </Stack>
    </Stack>
  );
}
