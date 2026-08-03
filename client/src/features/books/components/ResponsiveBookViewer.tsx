import { Skeleton, Stack, useMediaQuery } from "@mui/material";
import { useSyncExternalStore } from "react";
import type { PublicBook } from "../types";
import { selectBookViewer } from "./bookViewerSelection.ts";
import { InteractiveAudioViewer } from "./InteractiveAudioViewer";
import { OfficialBookViewer } from "./OfficialBookViewer";

const subscribeToClientReady = () => () => undefined;
const desktopInteractiveMediaQuery = "(min-width:900px)";

export function ResponsiveBookViewer({ book }: { book: PublicBook }) {
  const isDesktop = useMediaQuery(desktopInteractiveMediaQuery, { noSsr: true });
  const breakpointReady = useSyncExternalStore(subscribeToClientReady, () => true, () => false);

  if (!breakpointReady) {
    return (
      <Stack data-testid="responsive-book-viewer-loading" spacing={1} aria-label="Đang chuẩn bị trình đọc sách" sx={{ p: { xs: 0.5, sm: 1 } }}>
        <Skeleton variant="rounded" height={48} />
        <Skeleton variant="rounded" sx={{ height: { xs: 180, md: 320 } }} />
      </Stack>
    );
  }

  return selectBookViewer({ bookType: book.bookType, interactiveAudioUrl: book.interactiveAudioUrl, isDesktop }) === "INTERACTIVE"
    ? <InteractiveAudioViewer book={book} />
    : <OfficialBookViewer book={book} />;
}
