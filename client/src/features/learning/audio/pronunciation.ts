import type { VocabularyItem } from "../types.ts";

export const LEARNING_SPEECH_LOCALE = "en-US";
export const PRONUNCIATION_RATES = {
  NORMAL: 0.88,
  SLOW: 0.6,
} as const;
export type PronunciationRateMode = keyof typeof PRONUNCIATION_RATES;
export type AudioStrategy = "ASSET" | "SPEECH" | "UNAVAILABLE";

interface AudioLike { play(): Promise<void> | void; pause(): void; currentTime: number; playbackRate: number; preservesPitch?: boolean; }
interface SpeechLike { cancel(): void; speak(utterance: SpeechSynthesisUtterance): void; }
interface AudioEnvironment {
  Audio?: new (source: string) => AudioLike;
  speechSynthesis?: SpeechLike;
  SpeechSynthesisUtterance?: new (text: string) => SpeechSynthesisUtterance;
}

let activeAudio: AudioLike | null = null;
let activeSpeech: SpeechLike | null = null;

const browserEnvironment = (): AudioEnvironment => typeof window === "undefined" ? {} : {
  Audio: window.Audio,
  speechSynthesis: window.speechSynthesis,
  SpeechSynthesisUtterance: window.SpeechSynthesisUtterance,
};

export function audioStrategy(item: VocabularyItem, environment: AudioEnvironment = browserEnvironment()): AudioStrategy {
  if (item.audio && environment.Audio) return "ASSET";
  if (item.speechText && environment.speechSynthesis && environment.SpeechSynthesisUtterance) return "SPEECH";
  return "UNAVAILABLE";
}

export function stopPronunciation(): void {
  if (activeAudio) { activeAudio.pause(); activeAudio.currentTime = 0; activeAudio = null; }
  activeSpeech?.cancel();
  activeSpeech = null;
}

export function resolvePronunciationRate(rateMode: PronunciationRateMode): number {
  return PRONUNCIATION_RATES[rateMode];
}

export async function playPronunciation(item: VocabularyItem, rateMode: PronunciationRateMode, environment: AudioEnvironment = browserEnvironment()): Promise<boolean> {
  stopPronunciation();
  const resolvedRate = resolvePronunciationRate(rateMode);
  try {
    if (item.audio && environment.Audio) {
      const audio = new environment.Audio(item.audio);
      audio.playbackRate = resolvedRate;
      if ("preservesPitch" in audio) audio.preservesPitch = true;
      activeAudio = audio;
      await audio.play();
      return true;
    }
    if (item.speechText && environment.speechSynthesis && environment.SpeechSynthesisUtterance) {
      const utterance = new environment.SpeechSynthesisUtterance(item.speechText);
      utterance.lang = LEARNING_SPEECH_LOCALE;
      utterance.rate = resolvedRate;
      activeSpeech = environment.speechSynthesis;
      activeSpeech.cancel();
      activeSpeech.speak(utterance);
      return true;
    }
  } catch { stopPronunciation(); }
  return false;
}
