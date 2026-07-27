import type {
  VocabularyImageMediaType,
  VocabularyImageOrientation,
  VocabularyImageProvider,
} from "@teacher/shared";

export interface ProviderSearchInput {
  query: string;
  page: number;
  pageSize: number;
  mediaType: VocabularyImageMediaType;
  orientation: VocabularyImageOrientation;
  safeSearch: true;
}

export interface ProviderImageAsset {
  provider: VocabularyImageProvider;
  providerAssetId: string;
  previewUrl: string;
  thumbnailUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  mediaType: Exclude<VocabularyImageMediaType, "ALL">;
  tags: string[];
  contributorName: string;
  contributorUrl: string;
  attributionText: string;
  sourcePageUrl: string;
  licenseLabel: string;
}

export interface ProviderSearchResult {
  total: number;
  items: ProviderImageAsset[];
  rateLimit?: {
    remaining?: number;
    reset?: number;
    retryAfterSeconds?: number;
  };
}

export interface ImageSearchProvider {
  readonly name: VocabularyImageProvider;
  readonly allowedDownloadHosts: readonly string[];
  readonly supportedMediaTypes?: readonly VocabularyImageMediaType[];
  search(input: ProviderSearchInput): Promise<ProviderSearchResult>;
  resolveAsset?(providerAssetId: string): Promise<ProviderImageAsset | null>;
}

export interface ImageProviderRegistry {
  get(name: VocabularyImageProvider): ImageSearchProvider | null;
  primary(mediaType: VocabularyImageMediaType): ImageSearchProvider | null;
  status(): Array<{ provider: VocabularyImageProvider; enabled: boolean }>;
}

export class StaticImageProviderRegistry implements ImageProviderRegistry {
  private readonly providers = new Map<VocabularyImageProvider, ImageSearchProvider>();
  constructor(providers: readonly ImageSearchProvider[]) {
    providers.forEach((provider) => this.providers.set(provider.name, provider));
  }
  get(name: VocabularyImageProvider) { return this.providers.get(name) ?? null; }
  primary(mediaType: VocabularyImageMediaType) {
    return [...this.providers.values()].find((provider) =>
      !provider.supportedMediaTypes || provider.supportedMediaTypes.includes(mediaType) || mediaType === "ALL") ?? null;
  }
  status() {
    return (["PIXABAY"] as VocabularyImageProvider[]).map((provider) => ({
      provider,
      enabled: this.providers.has(provider),
    }));
  }
}
