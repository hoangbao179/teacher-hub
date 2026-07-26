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
  search(input: ProviderSearchInput): Promise<ProviderSearchResult>;
}
