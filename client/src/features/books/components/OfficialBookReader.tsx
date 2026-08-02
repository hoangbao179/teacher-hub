import { Alert, Box, Button } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { OfficialPageManifest } from "../content/officialPageManifest.ts";
import type { PublicBook } from "../types.ts";
import { BookReaderToolbar } from "./BookReaderToolbar.tsx";
import { currentSpreadLabel, initialManifestPage, isFlipGestureEnabled, manifestPagesInSpread, type BookReaderMode } from "./bookFlipPages.ts";
import { OfficialSourceLink } from "./OfficialSourceLink.tsx";
import { ResponsivePageFlip, type ResponsivePageFlipHandle } from "./ResponsivePageFlip.tsx";

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;

const clampPage = (value: number, pageCount: number) => Math.min(pageCount, Math.max(1, Math.trunc(value)));

function ReaderImage({ book, imageUrl, label }: { book: PublicBook; imageUrl: string; label: string }) {
  return <Box component="img" src={imageUrl} alt={`${book.title} — ${label}`} loading="eager" draggable={false} sx={{ display: "block", width: "100%", height: "auto", objectFit: "contain", bgcolor: "white", userSelect: "none", WebkitUserDrag: "none" }} />;
}

export function OfficialBookReader({ book, manifest }: { book: PublicBook; manifest: OfficialPageManifest }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPage = initialManifestPage(searchParams.get("page"), manifest.pages.length);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [mode, setMode] = useState<BookReaderMode>("single");
  const [busy, setBusy] = useState(false);
  const [engineFailed, setEngineFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<ResponsivePageFlipHandle | null>(null);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spreadPages = useMemo(() => manifestPagesInSpread(currentPage, manifest.pages.length, mode), [currentPage, manifest.pages.length, mode]);
  const canPrevious = currentPage > 1;
  const canNext = (spreadPages.at(-1) ?? currentPage) < manifest.pages.length;

  const resetViewport = useCallback(() => {
    setZoom(MIN_ZOOM);
    window.requestAnimationFrame(() => scrollRef.current?.scrollTo({ left: 0, top: 0 }));
  }, []);

  const commitPage = useCallback((nextPage: number) => {
    const normalized = clampPage(nextPage, manifest.pages.length);
    setCurrentPage(normalized);
    setPageInput(String(normalized));
    setBusy(false);
    resetViewport();
    const nextParams = new URLSearchParams(searchParams);
    if (normalized === 1) nextParams.delete("page"); else nextParams.set("page", String(normalized));
    setSearchParams(nextParams, { replace: true });
  }, [manifest.pages.length, resetViewport, searchParams, setSearchParams]);

  const runAfterReset = useCallback((action: () => boolean, fallbackPage: number) => {
    resetViewport();
    window.requestAnimationFrame(() => {
      if (!action()) commitPage(fallbackPage);
    });
  }, [commitPage, resetViewport]);

  const goPrevious = useCallback(() => {
    if (busy || !canPrevious) return;
    const target = mode === "double" && currentPage > 2 ? Math.max(1, currentPage - 2) : currentPage - 1;
    if (engineFailed) commitPage(target);
    else runAfterReset(() => pageFlipRef.current?.flipPrevious() ?? false, target);
  }, [busy, canPrevious, commitPage, currentPage, engineFailed, mode, runAfterReset]);

  const goNext = useCallback(() => {
    if (busy || !canNext) return;
    const target = mode === "double" && currentPage > 1 ? Math.min(manifest.pages.length, currentPage + 2) : currentPage + 1;
    if (engineFailed) commitPage(target);
    else runAfterReset(() => pageFlipRef.current?.flipNext() ?? false, target);
  }, [busy, canNext, commitPage, currentPage, engineFailed, manifest.pages.length, mode, runAfterReset]);

  const submitPageInput = useCallback(() => {
    const parsed = Number(pageInput);
    if (!Number.isInteger(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const target = clampPage(parsed, manifest.pages.length);
    if (target === currentPage) return setPageInput(String(currentPage));
    if (engineFailed) commitPage(target);
    else runAfterReset(() => pageFlipRef.current?.flipToManifestPage(target) ?? false, target);
  }, [commitPage, currentPage, engineFailed, manifest.pages.length, pageInput, runAfterReset]);

  const changeZoom = useCallback((nextZoom: number) => {
    const normalized = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setZoom(normalized);
    window.requestAnimationFrame(() => {
      const viewport = scrollRef.current;
      if (!viewport) return;
      viewport.scrollTo({ left: normalized === MIN_ZOOM ? 0 : (viewport.scrollWidth - viewport.clientWidth) / 2, top: 0 });
    });
  }, []);

  const handleModeChange = useCallback((nextMode: BookReaderMode) => {
    setMode((currentMode) => {
      if (currentMode !== nextMode) resetViewport();
      return nextMode;
    });
  }, [resetViewport]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, a")) return;
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrevious]);

  useEffect(() => {
    const neighbours = new Set<number>();
    for (const page of spreadPages) for (const offset of [-2, -1, 0, 1, 2]) neighbours.add(page + offset);
    for (const pageNumber of neighbours) {
      const page = manifest.pages[pageNumber - 1];
      if (page) new Image().src = page.imageUrl;
    }
  }, [manifest.pages, spreadPages]);

  const gesturesEnabled = isFlipGestureEnabled(zoom) && !engineFailed;

  return (
    <Box data-testid="official-page-image-viewer" sx={{ border: "1px solid #d5e1e6", borderRadius: { xs: 2.5, md: 3.5 }, bgcolor: "#eef4f6", overflow: "clip" }}>
      <BookReaderToolbar
        pageCount={manifest.pages.length}
        pageInput={pageInput}
        pageLabel={currentSpreadLabel(currentPage, manifest.pages.length, mode)}
        zoom={zoom}
        busy={busy}
        canPrevious={canPrevious}
        canNext={canNext}
        sourceUrl={book.officialViewerUrl}
        onPageInput={setPageInput}
        onPageInputSubmit={submitPageInput}
        onPrevious={goPrevious}
        onNext={goNext}
        onZoom={changeZoom}
        onResetZoom={resetViewport}
      />

      <Box
        ref={scrollRef}
        data-testid="official-page-scroll"
        sx={{ position: "relative", width: "100%", maxHeight: zoom > MIN_ZOOM ? { xs: "72dvh", md: "78dvh" } : "none", overflowX: zoom > MIN_ZOOM ? "auto" : "hidden", overflowY: zoom > MIN_ZOOM ? "auto" : "visible", overscrollBehavior: "contain", bgcolor: "#dfe8eb" }}
      >
        {!engineFailed && (
          <Box sx={zoom > MIN_ZOOM ? { position: "absolute", inset: 0, visibility: "hidden", pointerEvents: "none" } : undefined}>
            <ResponsivePageFlip
              ref={pageFlipRef}
              bookTitle={book.title}
              currentPage={currentPage}
              pages={manifest.pages}
              gesturesEnabled={gesturesEnabled}
              reducedMotion={reducedMotion}
              onFlipComplete={commitPage}
              onModeChange={handleModeChange}
              onBusyChange={setBusy}
              onEngineError={() => { setBusy(false); setEngineFailed(true); }}
            />
          </Box>
        )}

        {(zoom > MIN_ZOOM || engineFailed) && (
          <Box data-testid={engineFailed ? "single-page-reader-fallback" : "official-page-zoom-layer"} data-flip-gestures="disabled" sx={{ width: engineFailed && zoom === MIN_ZOOM ? "100%" : `${zoom * 100}%`, minWidth: "100%", display: "grid", gridTemplateColumns: mode === "double" && !engineFailed ? `repeat(${spreadPages.length}, minmax(0, 1fr))` : "minmax(0, 1fr)", gap: mode === "double" && !engineFailed ? "2px" : 0, p: { xs: 1, sm: 2 }, mx: "auto" }}>
            {(engineFailed ? [currentPage] : spreadPages).map((pageNumber) => {
              const page = manifest.pages[pageNumber - 1];
              return <ReaderImage key={page.index} book={book} imageUrl={page.imageUrl} label={page.label} />;
            })}
          </Box>
        )}
      </Box>

      <Box sx={{ display: { xs: "flex", md: "none" }, p: 1, justifyContent: "flex-end" }}><OfficialSourceLink href={book.officialViewerUrl} mobile /></Box>
      <Box component="span" aria-live="polite" sx={{ position: "absolute", left: 0, width: "1px", height: "1px", p: 0, m: 0, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>Trang hiện tại: {currentSpreadLabel(currentPage, manifest.pages.length, mode)}</Box>
      {engineFailed && <Alert severity="info" action={<Button component="a" href={book.officialViewerUrl} target="_blank" rel="noopener noreferrer">Mở nguồn NXBGD</Button>}>Hiệu ứng lật trang chưa khởi tạo được. Trình đọc ảnh đơn vẫn sẵn sàng.</Alert>}
    </Box>
  );
}
