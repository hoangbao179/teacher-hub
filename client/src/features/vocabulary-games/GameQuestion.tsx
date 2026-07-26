import type { PublicLearningQuestion } from "@teacher/shared";
import { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";
import { VolumeUpRounded } from "@mui/icons-material";
import { playGameSpeech } from "./gameAudio";

type Answer = Record<string, unknown>;

function Illustration({ value }: { value: NonNullable<PublicLearningQuestion["prompt"]["illustration"]> }) {
  if (value.kind === "EMOJI")
    return <Typography aria-label={value.altText ?? "Hình minh họa"} sx={{ fontSize: 72 }}>{value.value}</Typography>;
  if (value.kind === "STORED_MEDIA" && value.mediaUrl)
    return <Box component="img" src={value.mediaUrl} alt={value.altText ?? ""} sx={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 3 }} />;
  return null;
}

export function GameQuestion({
  question,
  disabled,
  onAnswer,
}: {
  question: PublicLearningQuestion;
  disabled: boolean;
  onAnswer: (answer: Answer) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pairs, setPairs] = useState<Array<{ leftId: string; rightId: string }>>([]);
  const [left, setLeft] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<string[]>([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    if (question.prompt.speechText) void playGameSpeech(question.prompt.speechText);
  }, [question.prompt.speechText]);

  const skin = question.presentation === "FEED_MONSTER"
    ? "👾" : question.presentation === "OPEN_TREASURE"
      ? "🧰" : question.presentation === "POP_BALLOON" ? "🎈" : "";
  const pairMode = question.mechanic === "MATCH_PAIRS" || question.mechanic === "MEMORY_PAIRS";
  const memoryMode = question.mechanic === "MEMORY_PAIRS";
  const builtWord = useMemo(
    () => selected.map((id) => question.options.find((option) => option.id === id)?.label ?? "").join(""),
    [question.options, selected],
  );

  const choosePairTarget = (rightId: string) => {
    if (!left) return;
    setPairs((current) => [...current.filter((pair) => pair.leftId !== left && pair.rightId !== rightId), { leftId: left, rightId }]);
    setLeft(null);
  };

  const flipMemoryCard = (id: string, side: "LEFT" | "RIGHT") => {
    if (pairs.some((pair) => pair.leftId === id || pair.rightId === id)) return;
    if (!flipped.length) {
      setFlipped([`${side}:${id}`]);
      return;
    }
    const [firstSide, firstId] = flipped[0].split(":");
    if (firstId === id) return;
    if (firstSide === side) {
      setFlipped([`${side}:${id}`]);
      return;
    }
    setPairs((current) => [...current, firstSide === "LEFT"
      ? { leftId: firstId, rightId: id }
      : { leftId: id, rightId: firstId }]);
    setFlipped([]);
  };

  const isRevealed = (side: "LEFT" | "RIGHT", id: string) =>
    flipped.includes(`${side}:${id}`);

  return (
    <Card data-testid="game-question" sx={{ borderRadius: 5, boxShadow: "0 16px 50px rgba(57,77,124,.14)" }}>
      <CardContent sx={{ p: { xs: 2.25, sm: 4 } }}>
        <Stack spacing={2.5} sx={{ alignItems: "stretch" }}>
          <Typography component="h1" variant="h5" sx={{ textAlign: "center", fontWeight: 800 }}>
            {question.prompt.instruction}
          </Typography>
          {question.prompt.speechText && (
            <Button
              onClick={() => void playGameSpeech(question.prompt.speechText!)}
              startIcon={<VolumeUpRounded />}
              sx={{ minHeight: 56, alignSelf: "center" }}
            >
              Nghe lại
            </Button>
          )}
          {question.prompt.illustration && <Illustration value={question.prompt.illustration} />}
          {question.prompt.word && (
            <Typography variant="h3" sx={{ textAlign: "center", fontWeight: 800 }}>{question.prompt.word}</Typography>
          )}
          {question.prompt.meaningVi && (
            <Typography variant="h5" sx={{ textAlign: "center" }}>{question.prompt.meaningVi}</Typography>
          )}
          {question.prompt.phonetic && (
            <Typography color="text.secondary" sx={{ textAlign: "center" }}>{question.prompt.phonetic}</Typography>
          )}

          {question.mechanic === "EXPLORE_CARD" ? (
            <Button
              variant="contained"
              disabled={disabled}
              onClick={() => onAnswer({ exposure: true })}
              sx={{ minHeight: 60, fontSize: 18 }}
            >
              Con đã khám phá xong
            </Button>
          ) : memoryMode ? (
            <>
              <Grid container spacing={1.25}>
                {[
                  ...(question.prompt.pairs ?? []).map((item) => ({ ...item, side: "LEFT" as const })),
                  ...question.options.map((item) => ({ ...item, side: "RIGHT" as const })),
                ].map((item) => {
                  const paired = pairs.some((pair) => pair.leftId === item.id || pair.rightId === item.id);
                  const revealed = isRevealed(item.side, item.id);
                  return (
                    <Grid size={4} key={`${item.side}-${item.id}`}>
                      <Button
                        fullWidth
                        variant={revealed ? "contained" : "outlined"}
                        disabled={paired}
                        aria-label={revealed ? item.label ?? "Hình đang mở" : "Thẻ úp"}
                        onClick={() => flipMemoryCard(item.id, item.side)}
                        sx={{ minHeight: 88, fontSize: 18 }}
                      >
                        {paired ? "✓" : revealed
                          ? item.illustration ? <Illustration value={item.illustration} /> : item.label
                          : "?"}
                      </Button>
                    </Grid>
                  );
                })}
              </Grid>
              <Typography color="text.secondary" sx={{ textAlign: "center" }}>
                Đã ghép {pairs.length}/{question.prompt.pairs?.length ?? 0} cặp
              </Typography>
              <Button
                variant="contained"
                disabled={disabled || pairs.length !== (question.prompt.pairs?.length ?? 0)}
                onClick={() => onAnswer({ pairs })}
                sx={{ minHeight: 60 }}
              >
                Kiểm tra trí nhớ
              </Button>
            </>
          ) : pairMode ? (
            <>
              <Grid container spacing={1.25}>
                {question.prompt.pairs?.map((item) => (
                  <Grid size={6} key={item.id}>
                    <Button
                      fullWidth
                      variant={left === item.id ? "contained" : "outlined"}
                      onClick={() => setLeft(item.id)}
                      sx={{ minHeight: 64 }}
                    >
                      {item.label}
                    </Button>
                  </Grid>
                ))}
                {question.options.map((option) => (
                  <Grid size={6} key={option.id}>
                    <Button
                      fullWidth
                      color="secondary"
                      variant={pairs.some((pair) => pair.rightId === option.id) ? "contained" : "outlined"}
                      onClick={() => choosePairTarget(option.id)}
                      sx={{ minHeight: 64 }}
                    >
                      {option.illustration ? <Illustration value={option.illustration} /> : option.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>
              <Button
                variant="contained"
                disabled={disabled || pairs.length !== (question.prompt.pairs?.length ?? 0)}
                onClick={() => onAnswer({ pairs })}
                sx={{ minHeight: 60 }}
              >
                Kiểm tra các cặp
              </Button>
            </>
          ) : question.mechanic === "BUILD_WORD" ? (
            <>
              <Box sx={{ minHeight: 64, p: 2, borderRadius: 3, bgcolor: "grey.100", textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>{builtWord || "…"}</Typography>
              </Box>
              <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                {question.options.map((option) => (
                  <Button
                    key={option.id}
                    variant="outlined"
                    disabled={selected.includes(option.id)}
                    onClick={() => setSelected((current) => [...current, option.id])}
                    sx={{ minWidth: 56, minHeight: 56, fontSize: 20 }}
                  >
                    {option.label}
                  </Button>
                ))}
              </Stack>
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button fullWidth onClick={() => setSelected([])} sx={{ minHeight: 56 }}>Làm lại</Button>
                <Button
                  fullWidth variant="contained"
                  disabled={disabled || selected.length !== question.options.length}
                  onClick={() => onAnswer({ tokenIds: selected })}
                  sx={{ minHeight: 56 }}
                >
                  Trả lời
                </Button>
              </Stack>
            </>
          ) : (
            <Grid container spacing={1.5}>
              {question.options.map((option) => (
                <Grid size={{ xs: 12, sm: 6 }} key={option.id}>
                  <Button
                    fullWidth
                    variant="outlined"
                    disabled={disabled}
                    onClick={() => onAnswer({ optionId: option.id })}
                    sx={{
                      minHeight: 72,
                      fontSize: 17,
                      borderRadius: 3,
                      position: "relative",
                      bgcolor: "white",
                    }}
                  >
                    {skin && <Chip label={skin} size="small" sx={{ mr: 1 }} />}
                    {option.illustration ? <Illustration value={option.illustration} /> : option.label}
                  </Button>
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
