import { AppError } from "../../errors/app-error";
import type {
  ImageSearchProvider,
  ProviderImageAsset,
  ProviderSearchInput,
  ProviderSearchResult,
} from "./image-search.provider";

interface ArasaacPictogram {
  _id?: unknown;
  violence?: unknown;
  keywords?: unknown;
  categories?: unknown;
  tags?: unknown;
}

const CONTRIBUTOR = "Sergio Palao / ARASAAC";
const ATTRIBUTION = "Pictogram của Sergio Palao, nguồn ARASAAC, thuộc Government of Aragón";

function retryAfterSeconds(response: Response, now = Date.now()): number {
  const value = response.headers.get("Retry-After");
  if (!value) return 60;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, Math.ceil(seconds));
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1, Math.ceil((date - now) / 1_000)) : 60;
}

function unavailable(): AppError {
  return new AppError(
    503,
    "IMAGE_PROVIDER_UNAVAILABLE",
    "Nguồn hình minh họa đang tạm gián đoạn. Vui lòng thử lại.",
  );
}

function positiveId(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return null;
  return String(value);
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function tagsOf(pictogram: ArasaacPictogram): string[] {
  const keywords = Array.isArray(pictogram.keywords)
    ? pictogram.keywords.flatMap((entry) => {
      if (!entry || typeof entry !== "object" || !("keyword" in entry)) return [];
      const keyword = (entry as { keyword?: unknown }).keyword;
      return typeof keyword === "string" ? [keyword] : [];
    })
    : [];
  return [...new Set([...keywords, ...stringValues(pictogram.categories), ...stringValues(pictogram.tags)]
    .map((value) => value.normalize("NFKC").trim())
    .filter(Boolean))];
}

function mapPictogram(pictogram: ArasaacPictogram): ProviderImageAsset | null {
  const id = positiveId(pictogram._id);
  if (!id || pictogram.violence === true) return null;
  const base = `https://static.arasaac.org/pictograms/${id}/${id}`;
  return {
    provider: "ARASAAC",
    providerAssetId: id,
    previewUrl: `${base}_300.png`,
    thumbnailUrl: `${base}_300.png`,
    downloadUrl: `${base}_500.png`,
    width: 500,
    height: 500,
    mediaType: "ILLUSTRATION",
    tags: tagsOf(pictogram),
    contributorName: CONTRIBUTOR,
    contributorUrl: "https://arasaac.org",
    attributionText: ATTRIBUTION,
    sourcePageUrl: `https://arasaac.org/pictograms/en/${id}`,
    licenseLabel: "CC BY-NC-SA",
  };
}

export class ArasaacImageSearchProvider implements ImageSearchProvider {
  readonly name = "ARASAAC" as const;
  readonly allowedDownloadHosts = ["static.arasaac.org"] as const;
  readonly supportedMediaTypes = ["ALL", "ILLUSTRATION"] as const;

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 5_000,
  ) {}

  async search(input: ProviderSearchInput): Promise<ProviderSearchResult> {
    const url = `https://api.arasaac.org/v1/pictograms/en/bestsearch/${encodeURIComponent(input.query)}`;
    const payload = await this.fetchJson(url, false);
    if (!Array.isArray(payload)) throw unavailable();
    const seen = new Set<string>();
    const allItems: ProviderImageAsset[] = [];
    for (const value of payload) {
      if (!value || typeof value !== "object") continue;
      const item = mapPictogram(value as ArasaacPictogram);
      if (!item || seen.has(item.providerAssetId)) continue;
      seen.add(item.providerAssetId);
      allItems.push(item);
    }
    const offset = (input.page - 1) * input.pageSize;
    return {
      total: allItems.length,
      items: allItems.slice(offset, offset + input.pageSize),
    };
  }

  async resolveAsset(providerAssetId: string): Promise<ProviderImageAsset | null> {
    if (!/^[1-9]\d*$/.test(providerAssetId)) return null;
    const payload = await this.fetchJson(
      `https://api.arasaac.org/v1/pictograms/en/${providerAssetId}`,
      true,
    );
    if (payload == null || Array.isArray(payload) || typeof payload !== "object") return null;
    const item = mapPictogram(payload as ArasaacPictogram);
    return item?.providerAssetId === providerAssetId ? item : null;
  }

  private async fetchJson(url: string, allowNotFound: boolean): Promise<unknown | null> {
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw unavailable();
    }
    if (allowNotFound && response.status === 404) return null;
    if (response.status === 429) {
      const seconds = retryAfterSeconds(response);
      throw new AppError(
        429,
        "IMAGE_PROVIDER_RATE_LIMITED",
        "Nguồn hình minh họa đang giới hạn tần suất. Vui lòng thử lại sau.",
        { cooldownUntil: new Date(Date.now() + seconds * 1_000).toISOString() },
        seconds,
      );
    }
    if (!response.ok) throw unavailable();
    try {
      return JSON.parse(await response.text()) as unknown;
    } catch {
      throw unavailable();
    }
  }
}
