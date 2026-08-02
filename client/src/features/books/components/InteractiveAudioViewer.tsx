import { Alert, Box, Button, Stack } from "@mui/material";
import { useEffect, useState } from "react";
import { isAllowedInteractiveAudioUrl } from "../content/publicBookCatalog";
import type { PublicBook } from "../types";

const iframeSandbox = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-presentation",
].join(" ");

export function InteractiveAudioViewer({ book }: { book: PublicBook }) {
  const source = book.interactiveAudioUrl;
  const [loadState, setLoadState] = useState({ source, isLoaded: false, isSlow: false });
  const currentLoadState = loadState.source === source
    ? loadState
    : { source, isLoaded: false, isSlow: false };
  const { isLoaded, isSlow } = currentLoadState;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoadState((current) => current.source === source && current.isLoaded
        ? current
        : { source, isLoaded: false, isSlow: true });
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [source]);

  if (!source || !isAllowedInteractiveAudioUrl(source) || book.bookType !== "STUDENT_BOOK") {
    return <Alert severity="warning">Cuốn sách này chưa có bản nghe tương tác hợp lệ. Em hãy quay lại Tủ sách nhé.</Alert>;
  }

  return (
    <Stack spacing={1.5}>
      {isSlow && !isLoaded && (
        <Alert severity="info" action={<Button component="a" href={source} target="_blank" rel="noopener noreferrer">Mở ở tab mới</Button>}>
          Bản nghe có thể đang tải chậm. Em có thể tiếp tục chờ hoặc mở ở tab mới.
        </Alert>
      )}
      <Box data-testid="interactive-audio-viewer" sx={{ bgcolor: "#152337", borderRadius: { xs: 2.5, md: 3.5 }, overflow: "hidden", p: { xs: 0.75, sm: 1.5 }, minWidth: 0 }}>
        <Box
          component="iframe"
          title={`Nghe tương tác ${book.title}`}
          src={source}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; fullscreen"
          allowFullScreen
          sandbox={iframeSandbox}
          onLoad={() => setLoadState({ source, isLoaded: true, isSlow: false })}
          sx={{ display: "block", width: "100%", height: { xs: "72dvh", md: "80vh" }, minHeight: { xs: 500, md: 620 }, border: 0, borderRadius: 1.5, bgcolor: "#fffdf5" }}
        />
      </Box>
    </Stack>
  );
}
