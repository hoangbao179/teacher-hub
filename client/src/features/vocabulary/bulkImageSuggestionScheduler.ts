export interface BatchRun {
  runId: number;
  cancel: () => void;
  done: Promise<void>;
}

interface BatchOptions<T> {
  items: readonly T[];
  beforeRun?: (signal: AbortSignal, runId: number) => Promise<boolean>;
  runItem: (item: T, signal: AbortSignal, runId: number) => Promise<void>;
  rateLimitSeconds: (error: unknown) => number | undefined;
  onCooldown: (seconds: number, runId: number) => void;
  onError: (error: unknown, item: T | undefined, runId: number) => void;
  stopOnError?: (error: unknown) => boolean;
  onFinish?: (runId: number) => void;
  delayMs?: number;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

let nextRunId = 0;

function abortableSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      globalThis.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export function startSingleWorkerBatch<T>(options: BatchOptions<T>): BatchRun {
  const runId = ++nextRunId;
  const controller = new AbortController();
  const sleep = options.sleep ?? abortableSleep;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finish!: () => void;
  let finished = false;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  const complete = () => {
    if (finished) return;
    finished = true;
    options.onFinish?.(runId);
    finish();
  };

  const execute = async () => {
    let cursor = 0;
    let resumed = false;
    try {
      if (options.beforeRun && !await options.beforeRun(controller.signal, runId)) return;
      while (!controller.signal.aborted && cursor < options.items.length) {
        const item = options.items[cursor];
        try {
          await options.runItem(item, controller.signal, runId);
          cursor += 1;
        } catch (error) {
          if (controller.signal.aborted) return;
          const seconds = options.rateLimitSeconds(error);
          if (seconds !== undefined && !resumed) {
            resumed = true;
            for (let remaining = Math.max(1, seconds); remaining > 0; remaining -= 1) {
              options.onCooldown(remaining, runId);
              await sleep(1_000, controller.signal);
              if (controller.signal.aborted) return;
            }
            options.onCooldown(0, runId);
            continue;
          }
          options.onError(error, item, runId);
          if (seconds !== undefined || options.stopOnError?.(error)) return;
          cursor += 1;
        }
        if (!controller.signal.aborted && cursor < options.items.length)
          await sleep(options.delayMs ?? 800, controller.signal);
      }
    } catch (error) {
      if (!controller.signal.aborted) options.onError(error, undefined, runId);
    } finally {
      complete();
    }
  };

  timer = globalThis.setTimeout(() => { void execute(); }, 0);
  return {
    runId,
    done,
    cancel: () => {
      if (timer !== undefined) globalThis.clearTimeout(timer);
      controller.abort();
      complete();
    },
  };
}
