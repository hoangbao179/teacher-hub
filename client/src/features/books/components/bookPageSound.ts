export const BOOK_PAGE_SOUND_STORAGE_KEY = "teacher-hub.book-page-sound.enabled";

interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

type PageTurnEffect = () => Promise<void>;

export interface PageTurnSoundController {
  readonly enabled: boolean;
  readonly supported: boolean;
  prime: () => boolean;
  setEnabled: (enabled: boolean) => void;
  playAfterFlip: (userInitiated: boolean) => Promise<boolean>;
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readPageTurnSoundPreference(storage: StorageLike | undefined = browserStorage()): boolean {
  try {
    return storage?.getItem(BOOK_PAGE_SOUND_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function writePageTurnSoundPreference(enabled: boolean, storage: StorageLike | undefined = browserStorage()) {
  try {
    storage?.setItem(BOOK_PAGE_SOUND_STORAGE_KEY, String(enabled));
  } catch {
    // Storage can be unavailable in private browsing; sound remains session-only.
  }
}

let pageTurnAudioContext: AudioContext | undefined;

function pageTurnAudioContextConstructor() {
  const AudioContextConstructor = globalThis.AudioContext
    ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Web Audio API unavailable");
  return AudioContextConstructor;
}

function primeWebAudioPageTurn() {
  pageTurnAudioContext ??= new (pageTurnAudioContextConstructor())();
  if (pageTurnAudioContext.state === "suspended") void pageTurnAudioContext.resume().catch(() => undefined);
}

async function playWebAudioPageTurn() {
  primeWebAudioPageTurn();
  const context = pageTurnAudioContext;
  if (!context) throw new Error("Web Audio API unavailable");
  if (context.state === "suspended") await context.resume();
  const duration = 0.14;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    const progress = index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * Math.sin(Math.PI * progress) * (1 - progress);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(650, context.currentTime + duration);
  filter.Q.value = 0.7;
  gain.gain.setValueAtTime(0.18, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  await new Promise<void>((resolve) => {
    source.onended = () => resolve();
    source.start();
  });
}

export function createPageTurnSoundController({
  enabled = readPageTurnSoundPreference(),
  storage = browserStorage(),
  primeEffect = primeWebAudioPageTurn,
  playEffect = playWebAudioPageTurn,
  now = () => Date.now(),
  debounceMs = 200,
}: {
  enabled?: boolean;
  storage?: StorageLike;
  primeEffect?: () => void;
  playEffect?: PageTurnEffect;
  now?: () => number;
  debounceMs?: number;
} = {}): PageTurnSoundController {
  let soundEnabled = enabled;
  let soundSupported = true;
  let lastPlayedAt = Number.NEGATIVE_INFINITY;

  return {
    get enabled() { return soundEnabled; },
    get supported() { return soundSupported; },
    prime() {
      if (!soundEnabled || !soundSupported) return false;
      try {
        primeEffect();
        return true;
      } catch {
        soundSupported = false;
        soundEnabled = false;
        writePageTurnSoundPreference(false, storage);
        return false;
      }
    },
    setEnabled(nextEnabled) {
      soundEnabled = nextEnabled && soundSupported;
      writePageTurnSoundPreference(soundEnabled, storage);
    },
    async playAfterFlip(userInitiated) {
      if (!userInitiated || !soundEnabled || !soundSupported) return false;
      const timestamp = now();
      if (timestamp - lastPlayedAt < debounceMs) return false;
      lastPlayedAt = timestamp;
      try {
        await playEffect();
        return true;
      } catch {
        soundSupported = false;
        soundEnabled = false;
        writePageTurnSoundPreference(false, storage);
        return false;
      }
    },
  };
}
