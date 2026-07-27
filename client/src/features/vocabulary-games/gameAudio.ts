import { playPronunciation } from "../learning/audio/pronunciation";

export function canPlayGameSpeech(): boolean {
  return typeof window !== "undefined"
    && Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
}

export function playGameSpeech(speechText: string, slow = false) {
  return playPronunciation({
    id: "assignment-game",
    word: speechText,
    phonetic: "",
    vietnameseMeaning: "",
    image: "",
    speechText,
  }, slow ? "SLOW" : "NORMAL");
}
