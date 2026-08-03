import { Add, NavigateBefore, NavigateNext, Remove, VolumeOffOutlined, VolumeUpOutlined } from "@mui/icons-material";
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
  soundEnabled,
  soundAvailable,
  sourceUrl,
  onPageInput,
  onPageInputSubmit,
  onPrevious,
  onNext,
  onZoom,
  onResetZoom,
  onToggleSound,
}: {
  pageCount: number;
  pageInput: string;
  pageLabel: string;
  zoom: number;
  busy: boolean;
  canPrevious: boolean;
  canNext: boolean;
  soundEnabled: boolean;
  soundAvailable: boolean;
  sourceUrl: string;
  onPageInput: (value: string) => void;
  onPageInputSubmit: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onZoom: (zoom: number) => void;
  onResetZoom: () => void;
  onToggleSound: () => void;
}) {
  const handlePageInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onPageInputSubmit();
  };

  return (
    <Stack data-testid="book-reader-toolbar" component="nav" aria-label="Điều khiển đọc sách" direction={{ xs: "column", sm: "row" }} useFlexGap sx={{ position: "sticky", top: 0, zIndex: 20, gap: 0.75, alignItems: { sm: "center" }, justifyContent: "space-between", p: { xs: 0.75, sm: 1 }, background: "linear-gradient(135deg,rgba(226,248,244,.98) 0%,rgba(244,240,255,.98) 100%)", borderBottom: "1px solid #c8e5e1", boxShadow: "0 5px 16px rgba(23,34,56,.07)" }}>
      <Stack direction="row" spacing={0.375} sx={{ alignItems: "center", justifyContent: { xs: "space-between", sm: "flex-start" }, p: 0.375, border: "1px solid rgba(21,159,152,.14)", borderRadius: 2.5, bgcolor: "rgba(255,255,255,.72)" }}>
        <IconButton aria-label="Trang trước" disabled={busy || !canPrevious} onClick={onPrevious} sx={{ minWidth: 44, minHeight: 44, color: "#087a72", "&:hover": { bgcolor: "#dff5f0" } }}><NavigateBefore /></IconButton>
        <TextField value={pageInput} onChange={(event) => onPageInput(event.target.value)} onBlur={onPageInputSubmit} onKeyDown={handlePageInputKeyDown} slotProps={{ htmlInput: { min: 1, max: pageCount, inputMode: "numeric", "aria-label": "Số trang" } }} type="number" size="small" sx={{ width: 76, "& .MuiInputBase-root": { minHeight: 44, borderRadius: 2.25, bgcolor: "white" }, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#b9dcd7" }, "& .Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#159f98" } }} />
        <Typography aria-label={`Trang ${pageLabel}`} sx={{ minWidth: { xs: 72, md: 92 }, px: 1, py: 0.75, borderRadius: 2, bgcolor: "#e5f7f3", color: "#075f5a", textAlign: "center", fontSize: 13.5, fontWeight: 800 }}>{pageLabel}</Typography>
        <IconButton aria-label="Trang sau" disabled={busy || !canNext} onClick={onNext} sx={{ minWidth: 44, minHeight: 44, color: "#087a72", "&:hover": { bgcolor: "#dff5f0" } }}><NavigateNext /></IconButton>
      </Stack>
      <Stack direction="row" spacing={0.375} sx={{ alignItems: "center", justifyContent: { xs: "space-between", sm: "flex-end" }, p: 0.375, border: "1px solid rgba(113,65,161,.13)", borderRadius: 2.5, bgcolor: "rgba(255,255,255,.72)" }}>
        <IconButton aria-label="Thu nhỏ" disabled={zoom <= 1} onClick={() => onZoom(zoom - 0.25)} sx={{ minWidth: 44, minHeight: 44, color: "#087a72", "&:hover": { bgcolor: "#dff5f0" } }}><Remove /></IconButton>
        <Typography data-testid="official-page-zoom" sx={{ minWidth: 52, px: 0.75, py: 0.75, borderRadius: 2, bgcolor: "#e5f7f3", color: "#075f5a", textAlign: "center", fontSize: 13.5, fontWeight: 800 }}>{Math.round(zoom * 100)}%</Typography>
        <Button onClick={onResetZoom} variant="contained" sx={{ minHeight: 44, px: { xs: 1.5, sm: 2 }, whiteSpace: "nowrap", borderRadius: 2.25, bgcolor: "#7047eb", boxShadow: "0 4px 10px rgba(112,71,235,.18)", "&:hover": { bgcolor: "#5c35d5" } }}>Vừa trang</Button>
        <IconButton aria-label="Phóng to" disabled={zoom >= 2.5} onClick={() => onZoom(zoom + 0.25)} sx={{ minWidth: 44, minHeight: 44, color: "#087a72", "&:hover": { bgcolor: "#dff5f0" } }}><Add /></IconButton>
        <IconButton aria-label={soundEnabled ? "Tắt âm thanh lật trang" : "Bật âm thanh lật trang"} title={soundEnabled ? "Tắt âm thanh lật trang" : "Bật âm thanh lật trang"} disabled={!soundAvailable} onClick={onToggleSound} sx={{ minWidth: 44, minHeight: 44, color: soundEnabled ? "#7047eb" : "#667684", bgcolor: soundEnabled ? "#eee9ff" : "transparent", "&:hover": { bgcolor: soundEnabled ? "#e2d9ff" : "#eef2f4" } }}>
          {soundEnabled ? <VolumeUpOutlined /> : <VolumeOffOutlined />}
        </IconButton>
        <OfficialSourceLink href={sourceUrl} />
      </Stack>
    </Stack>
  );
}
