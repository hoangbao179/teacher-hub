import { Box, Skeleton, Typography } from "@mui/material";
import { createContext, forwardRef, useContext, useState } from "react";
import type { FlipPage } from "./bookFlipPages.ts";

export const BookPageLoadContext = createContext<ReadonlySet<number>>(new Set([1, 2, 3]));

export const BookPage = forwardRef<HTMLDivElement, {
  bookTitle: string;
  page: FlipPage;
  onAspectRatio?: (aspectRatio: number) => void;
}>(({ bookTitle, page, onAspectRatio }, ref) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const pagesToLoad = useContext(BookPageLoadContext);
  const shouldLoad = pagesToLoad.has(page.manifestPage.index);

  return (
    <Box
      ref={ref}
      data-density={page.density}
      data-manifest-page={page.manifestPage.index}
      sx={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", bgcolor: "white", userSelect: "none" }}
    >
      {status === "loading" && <Skeleton variant="rectangular" animation="wave" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}
      {status === "error" && (
        <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 2, bgcolor: "#fff8e1" }}>
          <Typography color="warning.dark" sx={{ textAlign: "center", fontSize: 14 }}>Ảnh trang này chưa tải được.</Typography>
        </Box>
      )}
      {shouldLoad && (
        <Box
          component="img"
          src={page.manifestPage.imageUrl}
          alt={`${bookTitle} — ${page.manifestPage.label}`}
          loading="eager"
          draggable={false}
          onLoad={(event) => {
            setStatus("loaded");
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) onAspectRatio?.(image.naturalWidth / image.naturalHeight);
          }}
          onError={() => setStatus("error")}
          sx={{ display: "block", width: "100%", height: "100%", objectFit: "contain", visibility: status === "loaded" ? "visible" : "hidden", userSelect: "none", WebkitUserDrag: "none" }}
        />
      )}
    </Box>
  );
});

BookPage.displayName = "BookPage";
