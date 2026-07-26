import { Box, Button, Typography } from "@mui/material";
import { useRef, useState, type RefObject } from "react";
import { stopPronunciation, type PronunciationRateMode } from "../audio/pronunciation";
import { readLearningSettings, writeLearningSettings } from "../storage/learningSettingsStorage";

interface PronunciationRateControlProps {
  value: PronunciationRateMode;
  onChange: (value: PronunciationRateMode) => void;
}

export function usePronunciationRateMode(): [PronunciationRateMode, (value: PronunciationRateMode) => void, RefObject<PronunciationRateMode>] {
  const [rateMode, setRateMode] = useState<PronunciationRateMode>(() => readLearningSettings().pronunciationRateMode);
  const activeRateMode = useRef(rateMode);
  const changeRateMode = (value: PronunciationRateMode) => {
    if (value === activeRateMode.current) return;
    stopPronunciation();
    activeRateMode.current = value;
    writeLearningSettings({ schemaVersion: 1, pronunciationRateMode: value });
    setRateMode(value);
  };
  return [rateMode, changeRateMode, activeRateMode];
}

export function PronunciationRateControl({ value, onChange }: PronunciationRateControlProps) {
  return <Box role="group" aria-label="Tốc độ phát âm" sx={{ width: "100%", maxWidth: 330 }}>
    <Typography sx={{ mb: 0.5, color: "text.secondary", fontSize: 13, fontWeight: 700 }}>Tốc độ phát âm</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 0.75 }}>
      <Button
        type="button"
        aria-pressed={value === "SLOW"}
        onClick={() => onChange("SLOW")}
        variant={value === "SLOW" ? "contained" : "outlined"}
        sx={{ minWidth: 0, minHeight: "44px !important", px: 1, borderRadius: 2.5, whiteSpace: "nowrap", fontSize: { xs: 13, sm: 14 }, bgcolor: value === "SLOW" ? "#5d46b5" : undefined }}
      >Chậm 0.6x</Button>
      <Button
        type="button"
        aria-pressed={value === "NORMAL"}
        onClick={() => onChange("NORMAL")}
        variant={value === "NORMAL" ? "contained" : "outlined"}
        sx={{ minWidth: 0, minHeight: "44px !important", px: 1, borderRadius: 2.5, whiteSpace: "nowrap", fontSize: { xs: 13, sm: 14 }, bgcolor: value === "NORMAL" ? "#5d46b5" : undefined }}
      >Bình thường</Button>
    </Box>
  </Box>;
}
