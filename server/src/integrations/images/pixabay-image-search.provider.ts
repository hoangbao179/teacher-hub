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
    url.searchParams.set("per_page", String(input.pageSize));
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
    return {
      total: Number(payload.totalHits ?? 0),
      items: (payload.hits ?? []).map((hit) => ({
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
        contributorName: hit.user || "Pixabay contributor",
        contributorUrl: `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/`,
        attributionText: `Ảnh của ${hit.user || "cộng tác viên"} trên Pixabay`,
        sourcePageUrl: hit.pageURL,
        licenseLabel: "Pixabay Content License",
      })),
    };
  }
}
