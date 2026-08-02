import { Box, Skeleton } from "@mui/material";
import HTMLFlipBook from "react-pageflip";
import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { OfficialPageManifestPage } from "../content/officialPageManifest.ts";
import { BookPage, BookPageLoadContext } from "./BookPage.tsx";
import {
  buildFlipPages,
  DEFAULT_BOOK_ASPECT_RATIO,
  flipIndexToManifestPage,
  manifestPageToFlipIndex,
  pageFlipDuration,
  readerModeForWidth,
  type BookReaderMode,
} from "./bookFlipPages.ts";

interface PageFlipEngine {
  flipNext: (corner?: "top" | "bottom") => void;
  flipPrev: (corner?: "top" | "bottom") => void;
  flip: (page: number, corner?: "top" | "bottom") => void;
}

interface ReactPageFlipRef {
  pageFlip: () => PageFlipEngine | undefined;
}

export interface ResponsivePageFlipHandle {
  flipNext: () => boolean;
  flipPrevious: () => boolean;
  flipToManifestPage: (page: number) => boolean;
}

class PageFlipErrorBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Không thể khởi tạo trình lật trang NXBGD.", error, info.componentStack);
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export const ResponsivePageFlip = forwardRef<ResponsivePageFlipHandle, {
  bookTitle: string;
  currentPage: number;
  pages: readonly OfficialPageManifestPage[];
  gesturesEnabled: boolean;
  reducedMotion: boolean;
  onFlipComplete: (manifestPage: number) => void;
  onModeChange: (mode: BookReaderMode) => void;
  onBusyChange: (busy: boolean) => void;
  onEngineError: (error: unknown) => void;
}>(({ bookTitle, currentPage, pages, gesturesEnabled, reducedMotion, onFlipComplete, onModeChange, onBusyChange, onEngineError }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReactPageFlipRef | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_BOOK_ASPECT_RATIO);
  const flipPages = useMemo(() => buildFlipPages(pages), [pages]);
  const pagesToLoad = useMemo(() => {
    const values = new Set<number>();
    for (let page = Math.max(1, currentPage - 4); page <= Math.min(pages.length, currentPage + 4); page += 1) values.add(page);
    return values;
  }, [currentPage, pages.length]);
  const mode = readerModeForWidth(containerWidth);
  const maxPageHeight = Math.max(420, Math.min(900, viewportHeight * 0.78));
  const availableWidth = Math.max(280, containerWidth - (mode === "double" ? 32 : 16));
  const pageWidth = Math.max(280, Math.floor(Math.min(mode === "double" ? availableWidth / 2 : availableWidth, maxPageHeight * aspectRatio)));
  const pageHeight = Math.max(420, Math.floor(pageWidth / aspectRatio));

  useEffect(() => onModeChange(mode), [mode, onModeChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    let timeoutId: number | undefined;
    const update = (width: number) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setContainerWidth(Math.round(width));
        setViewportHeight(window.innerHeight);
      }, 120);
    };
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(container);
    update(container.getBoundingClientRect().width);
    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  const withEngine = useCallback((action: (engine: PageFlipEngine) => void) => {
    try {
      const engine = engineRef.current?.pageFlip();
      if (!engine) return false;
      onBusyChange(true);
      action(engine);
      return true;
    } catch (error) {
      onBusyChange(false);
      onEngineError(error);
      return false;
    }
  }, [onBusyChange, onEngineError]);

  useImperativeHandle(ref, () => ({
    flipNext: () => withEngine((engine) => engine.flipNext("bottom")),
    flipPrevious: () => withEngine((engine) => engine.flipPrev("bottom")),
    flipToManifestPage: (page) => withEngine((engine) => engine.flip(manifestPageToFlipIndex(page, pages.length), "bottom")),
  }), [pages.length, withEngine]);

  const handleAspectRatio = useCallback((nextRatio: number) => {
    if (Number.isFinite(nextRatio) && nextRatio > 0.45 && nextRatio < 1.2) {
      setAspectRatio((current) => Math.abs(current - nextRatio) > 0.01 ? nextRatio : current);
    }
  }, []);

  const pageNodes = useMemo(() => flipPages.map((page) => (
    <BookPage key={page.manifestPage.index} bookTitle={bookTitle} page={page} onAspectRatio={handleAspectRatio} />
  )), [bookTitle, flipPages, handleAspectRatio]);

  return (
    <Box ref={containerRef} data-testid="responsive-page-flip" data-reader-mode={mode} data-flip-gestures={gesturesEnabled ? "enabled" : "disabled"} aria-label={`Trình lật trang ${bookTitle}`} sx={{ position: "relative", width: "100%", minWidth: 0, display: "grid", placeItems: "center", py: { xs: 1, sm: 2 }, overflow: "hidden", touchAction: gesturesEnabled ? "pan-y" : "auto" }}>
      {containerWidth === 0 ? <Skeleton variant="rounded" sx={{ width: "min(100%, 600px)", height: 560 }} /> : (
        <PageFlipErrorBoundary onError={onEngineError}>
          <BookPageLoadContext.Provider value={pagesToLoad}>
            <HTMLFlipBook
            key={`${mode}-${pageWidth}-${pageHeight}`}
            ref={engineRef}
            className="official-page-flip"
            style={{ margin: "0 auto", pointerEvents: gesturesEnabled ? "auto" : "none" }}
            startPage={manifestPageToFlipIndex(currentPage, pages.length)}
            size="fixed"
            width={pageWidth}
            height={pageHeight}
            minWidth={pageWidth}
            maxWidth={pageWidth}
            minHeight={pageHeight}
            maxHeight={pageHeight}
            drawShadow={!reducedMotion}
            flippingTime={pageFlipDuration(reducedMotion)}
            usePortrait={mode === "single"}
            startZIndex={0}
            autoSize
            maxShadowOpacity={reducedMotion ? 0.08 : 0.28}
            showCover
            mobileScrollSupport
            clickEventForward
            useMouseEvents={gesturesEnabled}
            swipeDistance={30}
            showPageCorners={gesturesEnabled && !reducedMotion}
            disableFlipByClick
            renderOnlyPageLengthChange
            onInit={() => onBusyChange(false)}
            onChangeState={(event: { data: string }) => onBusyChange(event.data === "flipping")}
            onFlip={(event: { data: number }) => {
              onBusyChange(false);
              onFlipComplete(flipIndexToManifestPage(event.data, pages.length));
            }}
            >
              {pageNodes}
            </HTMLFlipBook>
          </BookPageLoadContext.Provider>
        </PageFlipErrorBoundary>
      )}
    </Box>
  );
});

ResponsivePageFlip.displayName = "ResponsivePageFlip";
