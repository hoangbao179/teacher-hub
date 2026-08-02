import { Alert, Box, Button, Stack } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { isAllowedBookPreviewUrl } from "../content/publicBookCatalog";
import type { PublicBook } from "../types";

export function BookViewer({ book }: { book: PublicBook }) {
  const timeoutRef = useRef<number | null>(null);
  const [loadState, setLoadState] = useState({ bookId: book.id, isLoaded: false, isSlow: false });
  const currentLoadState = loadState.bookId === book.id
    ? loadState
    : { bookId: book.id, isLoaded: false, isSlow: false };
  const { isLoaded, isSlow } = currentLoadState;

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => {
      setLoadState((current) => current.bookId === book.id && current.isLoaded
        ? current
        : { bookId: book.id, isLoaded: false, isSlow: true });
    }, 8000);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [book.id]);

  if (!isAllowedBookPreviewUrl(book.previewUrl)) return <Alert severity="warning">Nguồn sách chưa hợp lệ. Vui lòng quay lại Tủ sách.</Alert>;

  const handleLoad = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setLoadState({ bookId: book.id, isLoaded: true, isSlow: false });
  };

  return (
    <Stack spacing={1.5}>
      {isSlow && !isLoaded && <Alert severity="info" action={<Button component="a" href={book.previewUrl} target="_blank" rel="noopener noreferrer">Mở ở tab mới</Button>}>Sách có thể đang tải chậm. Em có thể tiếp tục chờ hoặc mở ở tab mới.</Alert>}
      <Box data-testid="book-viewer" sx={{ bgcolor: "#152337", borderRadius: { xs: 2.5, md: 3.5 }, overflow: "hidden", p: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
        <Box component="iframe" title={`Xem ${book.title}`} src={book.previewUrl} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen" allowFullScreen onLoad={handleLoad} sx={{ display: "block", width: "100%", height: { xs: "72dvh", md: "80vh" }, minHeight: { xs: 480, md: 620 }, border: 0, borderRadius: 1.5, bgcolor: "#fffdf5" }} />
      </Box>
    </Stack>
  );
}
