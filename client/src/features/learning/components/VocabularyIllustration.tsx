import { Box, type SxProps, type Theme } from "@mui/material";
import { useState } from "react";

export function VocabularyIllustration({ image, word, sx }: { image: string; word: string; sx?: SxProps<Theme> }) {
  const [failed, setFailed] = useState(false);
  const isAsset = image.startsWith("/") || /^https:\/\//.test(image);
  if (!isAsset || failed) return <Box aria-hidden="true" data-testid={failed ? "image-fallback" : "emoji-illustration"} sx={sx}>{failed ? "✨" : image}</Box>;
  return <Box component="img" src={image} alt={`Minh họa từ ${word}`} onError={() => setFailed(true)} sx={{ objectFit: "contain", ...sx }} />;
}
