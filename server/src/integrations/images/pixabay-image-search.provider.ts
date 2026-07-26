import type {
  VocabularyImageMediaType,
  VocabularyImageOrientation,
} from "@teacher/shared";
import { AppError } from "../../errors/app-error";
import type {
  ImageSearchProvider,
  ProviderSearchInput,
  ProviderSearchResult,
} from "./image-search.provider";

interface PixabayHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
  user_id: number;
}

const mediaType = (value: VocabularyImageMediaType) => value.toLowerCase();
const orientation = (value: VocabularyImageOrientation) => value.toLowerCase();
const queryNoise = new Set([
  "isolated", "cartoon", "illustration", "white", "background", "child", "face", "emotion",
]);

function normalize(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

function relevanceScore(input: ProviderSearchInput, item: ProviderSearchResult["items"][number]): number {
  const queryWords = normalize(input.query).split(" ").filter((word) => word && !queryNoise.has(word));
  const exactWord = queryWords[0] ?? "";
  const tags = item.tags.map(normalize);
  const tagWords = new Set(tags.flatMap((tag) => tag.split(/[^a-z0-9]+/u).filter(Boolean)));
  const exactMatch = tags.includes(exactWord) ? 1 : 0;
  const wordMatch = tagWords.has(exactWord) ? 1 : 0;
  const allQueryWordsMatch = queryWords.length > 0 && queryWords.every((word) => tagWords.has(word)) ? 1 : 0;
  const preferredType = item.mediaType === "VECTOR" ? 2 : item.mediaType === "ILLUSTRATION" ? 1 : 0;
  const squareScore = item.width > 0 && item.height > 0
    ? Math.max(0, 100 - Math.abs(Math.log(item.width / item.height)) * 100)
    : 0;
  return exactMatch * 1_000 + allQueryWordsMatch * 500 + wordMatch * 250 + preferredType * 100 + squareScore;
}

function rankAndDeduplicate(
  input: ProviderSearchInput,
  items: ProviderSearchResult["items"],
): ProviderSearchResult["items"] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  return [...items]
    .sort((left, right) => relevanceScore(input, right) - relevanceScore(input, left))
    .filter((item) => {
      const url = normalize(item.downloadUrl || item.previewUrl);
      if (seenIds.has(item.providerAssetId) || seenUrls.has(url)) return false;
      seenIds.add(item.providerAssetId);
      seenUrls.add(url);
      return true;
    })
    .slice(0, input.pageSize);
}

export class PixabayImageSearchProvider implements ImageSearchProvider {
  readonly name = "PIXABAY" as const;
  readonly allowedDownloadHosts = ["cdn.pixabay.com", "pixabay.com"] as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async search(input: ProviderSearchInput): Promise<ProviderSearchResult> {
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("q", input.query);
    url.searchParams.set("page", String(input.page));
    url.searchParams.set("per_page", String(Math.min(200, Math.max(20, input.pageSize * 3))));
    url.searchParams.set("image_type", mediaType(input.mediaType));
    url.searchParams.set("orientation", orientation(input.orientation));
    url.searchParams.set("safesearch", "true");
    url.searchParams.set("lang", "en");

    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new AppError(
        503,
        "IMAGE_PROVIDER_UNAVAILABLE",
        "Nguồn ảnh đang tạm gián đoạn. Vui lòng thử lại.",
      );
    }
    if (!response.ok)
      throw new AppError(
        response.status === 429 ? 429 : 503,
        "IMAGE_PROVIDER_UNAVAILABLE",
        "Nguồn ảnh đang tạm gián đoạn. Vui lòng thử lại.",
      );
    const payload = await response.json() as { totalHits?: number; hits?: PixabayHit[] };
    const items: ProviderSearchResult["items"] = (payload.hits ?? []).map((hit) => ({
      provider: "PIXABAY",
      providerAssetId: String(hit.id),
      previewUrl: hit.webformatURL || hit.previewURL,
      thumbnailUrl: hit.previewURL,
      downloadUrl: hit.largeImageURL || hit.webformatURL,
      width: Number(hit.imageWidth),
      height: Number(hit.imageHeight),
      mediaType: hit.type === "illustration"
        ? "ILLUSTRATION"
        : hit.type === "vector" ? "VECTOR" : "PHOTO",
      tags: hit.tags.split(",").map(normalize).filter(Boolean),
      contributorName: hit.user || "Pixabay contributor",
      contributorUrl: `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/`,
      attributionText: `Ảnh của ${hit.user || "cộng tác viên"} trên Pixabay`,
      sourcePageUrl: hit.pageURL,
      licenseLabel: "Pixabay Content License",
    }));
    return {
      total: Number(payload.totalHits ?? 0),
      items: rankAndDeduplicate(input, items),
    };
  }
}
