import type {
  ImageSearchProvider,
  ProviderSearchInput,
  ProviderSearchResult,
} from "./image-search.provider";

export class FakeImageSearchProvider implements ImageSearchProvider {
  readonly name = "PIXABAY" as const;
  readonly allowedDownloadHosts = ["images.test"] as const;
  calls: ProviderSearchInput[] = [];
  result: ProviderSearchResult = { total: 0, items: [] };
  failure: Error | null = null;

  async search(input: ProviderSearchInput): Promise<ProviderSearchResult> {
    this.calls.push(input);
    if (this.failure) throw this.failure;
    return structuredClone(this.result);
  }
}
