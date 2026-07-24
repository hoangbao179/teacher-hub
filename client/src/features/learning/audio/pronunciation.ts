import type { VocabularyItem } from "../types.ts";

export const LEARNING_SPEECH_LOCALE = "en-US";
export type AudioStrategy = "ASSET" | "SPEECH" | "UNAVAILABLE";

interface AudioLike { play(): Promise<void> | void; pause(): void; currentTime: number; }
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

export async function playPronunciation(item: VocabularyItem, environment: AudioEnvironment = browserEnvironment()): Promise<boolean> {
  stopPronunciation();
  try {
    if (item.audio && environment.Audio) {
      const audio = new environment.Audio(item.audio);
      activeAudio = audio;
      await audio.play();
      return true;
    }
    if (item.speechText && environment.speechSynthesis && environment.SpeechSynthesisUtterance) {
      const utterance = new environment.SpeechSynthesisUtterance(item.speechText);
      utterance.lang = LEARNING_SPEECH_LOCALE;
      utterance.rate = 0.88;
      activeSpeech = environment.speechSynthesis;
      activeSpeech.cancel();
      activeSpeech.speak(utterance);
      return true;
    }
  } catch { stopPronunciation(); }
  return false;
}
