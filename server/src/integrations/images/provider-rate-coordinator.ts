import { AppError } from "../../errors/app-error";

export interface ProviderRateCoordinator {
  run<T>(provider: string, operation: () => Promise<T>): Promise<T>;
  cooldownUntil(provider: string): Date | null;
}

interface Bucket {
  nextAllowedAt: number;
  cooldownUntil: number;
  tail: Promise<void>;
}

export class InMemoryProviderRateCoordinator implements ProviderRateCoordinator {
  private readonly buckets = new Map<string, Bucket>();
  constructor(
    private readonly minimumIntervalMs = 350,
    private readonly now: () => number = Date.now,
    private readonly sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)),
  ) {}

  cooldownUntil(provider: string): Date | null {
    const value = this.buckets.get(provider)?.cooldownUntil ?? 0;
    return value > this.now() ? new Date(value) : null;
  }

  async run<T>(provider: string, operation: () => Promise<T>): Promise<T> {
    const bucket = this.buckets.get(provider) ?? {
      nextAllowedAt: 0, cooldownUntil: 0, tail: Promise.resolve(),
    };
    this.buckets.set(provider, bucket);
    const previous = bucket.tail;
    let release!: () => void;
    bucket.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      this.throwIfCoolingDown(provider, bucket);
      const waitMs = Math.max(0, bucket.nextAllowedAt - this.now());
      if (waitMs > 0) await this.sleep(waitMs);
      this.throwIfCoolingDown(provider, bucket);
      bucket.nextAllowedAt = this.now() + this.minimumIntervalMs;
      try {
        return await operation();
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 429) {
          const seconds = Math.max(1, error.retryAfterSeconds ?? 60);
          bucket.cooldownUntil = this.now() + seconds * 1_000;
          bucket.nextAllowedAt = bucket.cooldownUntil;
        }
        throw error;
      }
    } finally {
      release();
    }
  }

  private throwIfCoolingDown(provider: string, bucket: Bucket): void {
    const now = this.now();
    if (bucket.cooldownUntil <= now) return;
    const seconds = Math.max(1, Math.ceil((bucket.cooldownUntil - now) / 1_000));
    throw new AppError(429, "IMAGE_PROVIDER_RATE_LIMITED", "Nguồn ảnh đang tạm giới hạn tần suất.", {
      provider,
      cooldownUntil: new Date(bucket.cooldownUntil).toISOString(),
    }, seconds);
  }
}
