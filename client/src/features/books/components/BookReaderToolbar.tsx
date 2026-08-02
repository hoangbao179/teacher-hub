import { Add, NavigateBefore, NavigateNext, Remove } from "@mui/icons-material";
import { Button, IconButton, Stack, TextField, Typography } from "@mui/material";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { OfficialSourceLink } from "./OfficialSourceLink.tsx";

export function BookReaderToolbar({
  pageCount,
  pageInput,
  pageLabel,
  zoom,
  busy,
  canPrevious,
  canNext,
  sourceUrl,
  onPageInput,
  onPageInputSubmit,
  onPrevious,
  onNext,
  onZoom,
  onResetZoom,
}: {
  pageCount: number;
  pageInput: string;
  pageLabel: string;
  zoom: number;
  busy: boolean;
  canPrevious: boolean;
  canNext: boolean;
  sourceUrl: string;
  onPageInput: (value: string) => void;
  onPageInputSubmit: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onZoom: (zoom: number) => void;
  onResetZoom: () => void;
}) {
  const handlePageInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onPageInputSubmit();
  };

  return (
    <Stack component="nav" aria-label="Điều khiển đọc sách" direction={{ xs: "column", sm: "row" }} useFlexGap sx={{ position: "sticky", top: 0, zIndex: 20, gap: 1, alignItems: { sm: "center" }, justifyContent: "space-between", p: 1, bgcolor: "rgba(255,255,255,.97)", borderBottom: "1px solid #d5e1e6" }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: { xs: "space-between", sm: "flex-start" } }}>
        <IconButton aria-label="Trang trước" disabled={busy || !canPrevious} onClick={onPrevious} sx={{ minWidth: 44, minHeight: 44 }}><NavigateBefore /></IconButton>
        <TextField value={pageInput} onChange={(event) => onPageInput(event.target.value)} onBlur={onPageInputSubmit} onKeyDown={handlePageInputKeyDown} slotProps={{ htmlInput: { min: 1, max: pageCount, inputMode: "numeric", "aria-label": "Số trang" } }} type="number" size="small" sx={{ width: 76, "& .MuiInputBase-root": { minHeight: 44 } }} />
        <Typography aria-label={`Trang ${pageLabel}`} sx={{ minWidth: { xs: 72, md: 92 }, textAlign: "center", fontSize: 13.5, fontWeight: 700 }}>{pageLabel}</Typography>
        <IconButton aria-label="Trang sau" disabled={busy || !canNext} onClick={onNext} sx={{ minWidth: 44, minHeight: 44 }}><NavigateNext /></IconButton>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", justifyContent: { xs: "space-between", sm: "flex-end" } }}>
        <IconButton aria-label="Thu nhỏ" disabled={zoom <= 1} onClick={() => onZoom(zoom - 0.25)} sx={{ minWidth: 44, minHeight: 44 }}><Remove /></IconButton>
        <Typography data-testid="official-page-zoom" sx={{ minWidth: 44, textAlign: "center", fontSize: 13.5, fontWeight: 800 }}>{Math.round(zoom * 100)}%</Typography>
        <Button onClick={onResetZoom} variant="outlined" sx={{ minHeight: 44, whiteSpace: "nowrap" }}>Vừa trang</Button>
        <IconButton aria-label="Phóng to" disabled={zoom >= 2.5} onClick={() => onZoom(zoom + 0.25)} sx={{ minWidth: 44, minHeight: 44 }}><Add /></IconButton>
        <OfficialSourceLink href={sourceUrl} />
      </Stack>
    </Stack>
  );
}
