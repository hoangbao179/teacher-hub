import assert from "node:assert/strict";
import test from "node:test";
import { PixabayImageSearchProvider } from "./pixabay-image-search.provider";

test("Pixabay search always enables safe search and hides its download URL", async () => {
  let requested: URL | undefined;
  const fetcher: typeof fetch = async (input) => {
    requested = new URL(String(input));
    return Response.json({
      totalHits: 1,
      hits: [{
        id: 42,
        pageURL: "https://pixabay.com/photos/example-42/",
        type: "photo",
        tags: "apple",
        previewURL: "https://cdn.pixabay.com/photo/preview.jpg",
        webformatURL: "https://cdn.pixabay.com/photo/web.jpg",
        largeImageURL: "https://cdn.pixabay.com/photo/large.jpg",
        imageWidth: 800,
        imageHeight: 600,
        user: "Teacher",
        user_id: 7,
      }],
    });
  };
  const result = await new PixabayImageSearchProvider("secret", fetcher).search({
    query: "red apple",
    page: 1,
    pageSize: 20,
    mediaType: "ALL",
    orientation: "ALL",
    safeSearch: true,
  });
  assert.equal(requested?.searchParams.get("safesearch"), "true");
  assert.equal(requested?.searchParams.get("key"), "secret");
  assert.equal(result.items[0].downloadUrl, "https://cdn.pixabay.com/photo/large.jpg");
  assert.equal(JSON.stringify(result.items).includes("secret"), false);
});
