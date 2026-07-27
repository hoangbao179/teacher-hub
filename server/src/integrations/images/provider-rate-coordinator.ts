import { AppError } from "../../errors/app-error";

export interface ProviderRateCoordinator {
  run<T>(provider: string, operation: () => Promise<T>): Promise<T>;
  cooldownUntil(provider: string): Date | null;
}

interface Bucket { nextAllowedAt: number; cooldownUntil: number }

export class InMemoryProviderRateCoordinator implements ProviderRateCoordinator {
  private readonly buckets = new Map<string, Bucket>();
  constructor(
    private readonly minimumIntervalMs = 350,
    private readonly now: () => number = Date.now,
  ) {}

  cooldownUntil(provider: string): Date | null {
    const value = this.buckets.get(provider)?.cooldownUntil ?? 0;
    return value > this.now() ? new Date(value) : null;
  }

  async run<T>(provider: string, operation: () => Promise<T>): Promise<T> {
    const bucket = this.buckets.get(provider) ?? { nextAllowedAt: 0, cooldownUntil: 0 };
    const now = this.now();
    if (bucket.cooldownUntil > now) {
      const seconds = Math.max(1, Math.ceil((bucket.cooldownUntil - now) / 1_000));
      throw new AppError(429, "IMAGE_PROVIDER_RATE_LIMITED", "Nguồn ảnh đang tạm giới hạn tần suất.", {
        cooldownUntil: new Date(bucket.cooldownUntil).toISOString(),
      }, seconds);
    }
    if (bucket.nextAllowedAt > now) {
      const seconds = Math.max(1, Math.ceil((bucket.nextAllowedAt - now) / 1_000));
      throw new AppError(429, "IMAGE_PROVIDER_RATE_LIMITED", "Nguồn ảnh đang được điều phối an toàn.", {
        cooldownUntil: new Date(bucket.nextAllowedAt).toISOString(),
      }, seconds);
    }
    bucket.nextAllowedAt = now + this.minimumIntervalMs;
    this.buckets.set(provider, bucket);
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
  }
}
