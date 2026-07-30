import { AppError } from "../../errors/app-error";

export interface ProviderRateCoordinator {
  run<T>(provider: string, operation: () => Promise<T>): Promise<T>;
  cooldownUntil(provider: string): Date | null;
}

interface Bucket {
  nextAllowedAt: number;
  rateLimitUntil: number;
  circuitUntil: number;
  unavailableFailures: number;
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
    const bucket = this.buckets.get(provider);
    const value = Math.max(bucket?.rateLimitUntil ?? 0, bucket?.circuitUntil ?? 0);
    return value > this.now() ? new Date(value) : null;
  }

  async run<T>(provider: string, operation: () => Promise<T>): Promise<T> {
    const bucket = this.buckets.get(provider) ?? {
      nextAllowedAt: 0,
      rateLimitUntil: 0,
      circuitUntil: 0,
      unavailableFailures: 0,
      tail: Promise.resolve(),
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
        const result = await operation();
        bucket.unavailableFailures = 0;
        bucket.circuitUntil = 0;
        return result;
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 429) {
          const seconds = Math.max(1, error.retryAfterSeconds ?? 60);
          bucket.rateLimitUntil = this.now() + seconds * 1_000;
          bucket.nextAllowedAt = bucket.rateLimitUntil;
          bucket.unavailableFailures = 0;
        } else if (error instanceof AppError && error.code === "IMAGE_PROVIDER_UNAVAILABLE") {
          bucket.unavailableFailures += 1;
          if (bucket.unavailableFailures >= 2) {
            bucket.circuitUntil = this.now() + 30_000;
            bucket.nextAllowedAt = bucket.circuitUntil;
            const details = typeof error.details === "object" && error.details ? error.details : {};
            throw new AppError(
              503,
              "IMAGE_PROVIDER_UNAVAILABLE",
              error.message,
              {
                ...details,
                provider,
                circuitOpenUntil: new Date(bucket.circuitUntil).toISOString(),
              },
              30,
            );
          }
        } else {
          bucket.unavailableFailures = 0;
        }
        throw error;
      }
    } finally {
      release();
    }
  }

  private throwIfCoolingDown(provider: string, bucket: Bucket): void {
    const now = this.now();
    if (bucket.circuitUntil > now) {
      const seconds = Math.max(1, Math.ceil((bucket.circuitUntil - now) / 1_000));
      throw new AppError(503, "IMAGE_PROVIDER_UNAVAILABLE", "Nguồn ảnh đang tạm gián đoạn.", {
        provider,
        reason: "CIRCUIT_OPEN",
        circuitOpenUntil: new Date(bucket.circuitUntil).toISOString(),
      }, seconds);
    }
    if (bucket.rateLimitUntil <= now) return;
    const seconds = Math.max(1, Math.ceil((bucket.rateLimitUntil - now) / 1_000));
    throw new AppError(429, "IMAGE_PROVIDER_RATE_LIMITED", "Nguồn ảnh đang tạm giới hạn tần suất.", {
      provider,
      cooldownUntil: new Date(bucket.rateLimitUntil).toISOString(),
    }, seconds);
  }
}
