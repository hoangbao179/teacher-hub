import { Alert, Button, Card, Skeleton, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { isAllowedOfficialBookUrl, isAllowedOfficialPageManifestUrl } from "../content/publicBookCatalog";
import { validateOfficialPageManifest, type OfficialPageManifest } from "../content/officialPageManifest";
import type { PublicBook } from "../types";
import { OfficialBookReader } from "./OfficialBookReader";

function OfficialSourceFallback({ book, message }: { book: PublicBook; message: string }) {
  return (
    <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 800 }}>Đọc từ nguồn chính thức NXBGD</Typography>
        <Typography color="text.secondary">{message}</Typography>
        <Button component="a" href={book.officialViewerUrl} target="_blank" rel="noopener noreferrer" variant="contained" sx={{ minHeight: 44 }}>
          Mở trên trang NXBGD
        </Button>
      </Stack>
    </Card>
  );
}

export function OfficialBookViewer({ book }: { book: PublicBook }) {
  const manifestUrl = book.officialPageManifestUrl;
  const [loadState, setLoadState] = useState<{ bookId: string; manifest?: OfficialPageManifest; failed?: boolean }>({ bookId: book.id });
  const currentState = loadState.bookId === book.id ? loadState : { bookId: book.id };

  useEffect(() => {
    if (book.officialViewerMode !== "PAGE_IMAGES" || !manifestUrl || !isAllowedOfficialPageManifestUrl(manifestUrl)) return;
    const controller = new AbortController();
    void fetch(manifestUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        const manifest = validateOfficialPageManifest(value, book.id);
        if (!manifest || manifest.sourceViewerUrl !== book.officialViewerUrl) throw new Error("Manifest không khớp catalog");
        setLoadState({ bookId: book.id, manifest });
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setLoadState({ bookId: book.id, failed: true });
      });
    return () => controller.abort();
  }, [book.id, book.officialViewerMode, book.officialViewerUrl, manifestUrl]);

  if (!isAllowedOfficialBookUrl(book.officialViewerUrl)) {
    return <Alert severity="warning">Nguồn đọc chính thức chưa hợp lệ. Em hãy quay lại Tủ sách nhé.</Alert>;
  }
  if (book.officialViewerMode !== "PAGE_IMAGES" || !manifestUrl || !isAllowedOfficialPageManifestUrl(manifestUrl)) {
    return <OfficialSourceFallback book={book} message="Cuốn sách này hiện được mở trực tiếp trên trang của nhà xuất bản." />;
  }
  if (currentState.failed) {
    return <OfficialSourceFallback book={book} message="Dữ liệu trang sách chưa tải được. Em có thể mở nguồn chính thức để tiếp tục đọc." />;
  }
  if (!currentState.manifest) {
    return <Stack data-testid="official-page-loading" spacing={1} sx={{ p: 0.5 }}><Skeleton variant="rounded" height={48} /><Skeleton variant="rounded" sx={{ height: { xs: 180, sm: 280, md: 360 } }} /></Stack>;
  }

  return <OfficialBookReader key={book.id} book={book} manifest={currentState.manifest} />;
}
