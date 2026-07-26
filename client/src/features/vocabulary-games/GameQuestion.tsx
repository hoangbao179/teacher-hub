import type { PublicLearningQuestion } from "@teacher/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Card, CardContent, Grid, Stack, Typography, useMediaQuery } from "@mui/material";
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
  const [memoryLocked, setMemoryLocked] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState("");
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const [playfulChoice, setPlayfulChoice] = useState<string | null>(null);
  const memoryTimer = useRef<number | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      if (memoryTimer.current != null) window.clearTimeout(memoryTimer.current);
    };
  }, [question.id]);

  const skin = question.presentation === "FEED_MONSTER"
    ? playfulChoice ? "😋" : "👾" : question.presentation === "OPEN_TREASURE"
      ? playfulChoice ? "✨🪙✨" : "🧰" : question.presentation === "POP_BALLOON"
        ? "🎈" : question.presentation === "CHOOSE_TRAIN_CARRIAGE" ? "🚂" : "";
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
    if (memoryLocked || disabled) return;
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
    const secondKey = `${side}:${id}`;
    setFlipped([flipped[0], secondKey]);
    setMemoryLocked(true);
    const allCards = [
      ...(question.prompt.pairs ?? []).map((item) => ({ ...item, side: "LEFT" as const })),
      ...question.options.map((item) => ({ ...item, side: "RIGHT" as const })),
    ];
    const first = allCards.find((item) => item.id === firstId && item.side === firstSide);
    const second = allCards.find((item) => item.id === id && item.side === side);
    const matched = Boolean(first?.matchKey && first.matchKey === second?.matchKey);
    memoryTimer.current = window.setTimeout(() => {
      if (matched) {
        setPairs((current) => [...current, firstSide === "LEFT"
          ? { leftId: firstId, rightId: id }
          : { leftId: id, rightId: firstId }]);
        setMemoryMessage("Đúng một cặp rồi! Tuyệt lắm!");
      } else {
        setMemoryMessage("Chưa cùng một cặp, mình nhớ vị trí rồi thử tiếp nhé!");
      }
      setFlipped([]);
      setMemoryLocked(false);
    }, reducedMotion ? 120 : 800);
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
          {question.prompt.meaningVi
            && (question.mechanic !== "EXPLORE_CARD" || flashcardRevealed) && (
            <Typography variant="h5" sx={{ textAlign: "center" }}>{question.prompt.meaningVi}</Typography>
          )}
          {question.prompt.phonetic
            && (question.mechanic !== "EXPLORE_CARD" || flashcardRevealed) && (
            <Typography color="text.secondary" sx={{ textAlign: "center" }}>{question.prompt.phonetic}</Typography>
          )}
          {question.prompt.exampleEn
            && (question.mechanic !== "EXPLORE_CARD" || flashcardRevealed) && (
            <Typography sx={{ textAlign: "center", fontStyle: "italic" }}>
              “{question.prompt.exampleEn}”
            </Typography>
          )}

          {question.mechanic === "EXPLORE_CARD" ? (
            flashcardRevealed ? <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}>
              <Button
                fullWidth
                variant="contained"
                disabled={disabled}
                onClick={() => onAnswer({ exposure: true, selfAssessment: "REMEMBERED" })}
                sx={{ minHeight: 60, fontSize: 18 }}
              >
                Con nhớ rồi
              </Button>
              <Button
                fullWidth
                variant="outlined"
                disabled={disabled}
                onClick={() => onAnswer({ exposure: true, selfAssessment: "REVIEW" })}
                sx={{ minHeight: 60, fontSize: 18 }}
              >
                Học lại nhé
              </Button>
            </Stack> : <Button
              variant="contained"
              disabled={disabled}
              onClick={() => setFlashcardRevealed(true)}
              sx={{ minHeight: 60, fontSize: 18 }}
            >
              Lật thẻ xem nghĩa
            </Button>
          ) : memoryMode ? (
            <>
              <Grid container spacing={1.25}>
                {[
                  ...(question.prompt.pairs ?? []).map((item) => ({ ...item, side: "LEFT" as const })),
                  ...question.options.map((item) => ({ ...item, side: "RIGHT" as const })),
                ].map((item) => {
                  const paired = pairs.some((pair) => pair.leftId === item.id || pair.rightId === item.id);
                  const revealed = paired || isRevealed(item.side, item.id);
                  return (
                    <Grid size={4} key={`${item.side}-${item.id}`}>
                      <Button
                        data-memory-card={`${item.side}:${item.id}`}
                        fullWidth
                        variant={revealed ? "contained" : "outlined"}
                        disabled={paired || memoryLocked || disabled}
                        aria-label={revealed ? item.label ?? "Hình đang mở" : "Thẻ úp"}
                        onClick={() => flipMemoryCard(item.id, item.side)}
                        sx={{ minHeight: 88, fontSize: 18 }}
                      >
                        {revealed
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
              {memoryMessage && <Typography role="status" aria-live="polite" sx={{ textAlign: "center", fontWeight: 700 }}>
                {memoryMessage}
              </Typography>}
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
                      data-pair-left-id={item.id}
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
                      data-pair-right-id={option.id}
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
          ) : question.presentation === "MISSING_LETTER" ? (
            <Stack spacing={2}>
              <Typography variant="h3" sx={{ textAlign: "center", fontWeight: 800, letterSpacing: 4 }}>
                {question.prompt.maskedWord}
              </Typography>
              <Stack direction="row" sx={{ gap: 1.25, justifyContent: "center", flexWrap: "wrap" }}>
                {question.options.map((option) => <Button
                  key={option.id}
                  data-option-id={option.id}
                  variant="outlined"
                  disabled={disabled}
                  onClick={() => onAnswer({ optionId: option.id })}
                  sx={{ minWidth: 64, minHeight: 64, fontSize: 24, borderRadius: 3 }}
                >
                  {option.label}
                </Button>)}
              </Stack>
            </Stack>
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
                    {option.label === " " ? "␠" : option.label}
                  </Button>
                ))}
              </Stack>
              <Stack direction="row" sx={{ gap: 1 }}>
                <Button fullWidth disabled={!selected.length} onClick={() => setSelected((current) => current.slice(0, -1))} sx={{ minHeight: 56 }}>Xóa chữ cuối</Button>
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
            <Stack spacing={2}>
              {skin && <Typography aria-hidden sx={{
                fontSize: 76,
                textAlign: "center",
                transform: question.presentation === "POP_BALLOON" ? "translateY(4px)" : "none",
              }}>{skin}</Typography>}
              <Grid container spacing={1.5}>
                {question.options.map((option) => {
                  const chosen = playfulChoice === option.id;
                  return (
                <Grid size={{ xs: 12, sm: 6 }} key={option.id}>
                  <Button
                    fullWidth
                    variant="outlined"
                    data-option-id={option.id}
                    disabled={disabled}
                    onClick={() => {
                      setPlayfulChoice(option.id);
                      onAnswer({ optionId: option.id });
                    }}
                    aria-pressed={chosen}
                    sx={{
                      minHeight: 72,
                      fontSize: 17,
                      position: "relative",
                      bgcolor: question.presentation === "POP_BALLOON"
                        ? "rgba(255,255,255,.9)"
                        : question.presentation === "OPEN_TREASURE"
                          ? "#fff8e1"
                          : question.presentation === "FEED_MONSTER"
                            ? "#f3e5f5"
                            : question.presentation === "CHOOSE_TRAIN_CARRIAGE"
                              ? "#e3f2fd" : "white",
                      borderRadius: question.presentation === "POP_BALLOON" ? "50%" : 3,
                      boxShadow: question.presentation === "OPEN_TREASURE"
                        ? "inset 0 -5px 0 rgba(121,85,72,.18)" : undefined,
                      transform: chosen && question.presentation === "POP_BALLOON"
                        ? "scale(.15)" : chosen && question.presentation === "CHOOSE_TRAIN_CARRIAGE"
                          ? "translateX(-10px)" : "none",
                      transition: reducedMotion ? "none" : "transform 320ms ease, opacity 320ms ease",
                      opacity: chosen && question.presentation === "POP_BALLOON" ? 0.2 : 1,
                    }}
                  >
                    {chosen && question.presentation === "FEED_MONSTER" && "🍽️ "}
                    {chosen && question.presentation === "OPEN_TREASURE" && "🔓 "}
                    {chosen && question.presentation === "CHOOSE_TRAIN_CARRIAGE" && "🚃—"}
                    {option.illustration ? <Illustration value={option.illustration} /> : option.label}
                  </Button>
                </Grid>
                  );
                })}
              </Grid>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
