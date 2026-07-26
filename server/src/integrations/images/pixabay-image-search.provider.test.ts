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
  assert.equal(requested?.searchParams.get("per_page"), "60");
  assert.equal(result.items[0].downloadUrl, "https://cdn.pixabay.com/photo/large.jpg");
  assert.deepEqual(result.items[0].tags, ["apple"]);
  assert.equal(JSON.stringify(result.items).includes("secret"), false);
});

test("Pixabay results are ranked by word, media type and square shape then deduplicated", async () => {
  const hit = (id: number, type: string, tags: string, width: number, height: number, suffix = String(id)) => ({
    id, pageURL: `https://pixabay.com/images/${id}/`, type, tags,
    previewURL: `https://cdn.pixabay.com/${suffix}-preview.jpg`,
    webformatURL: `https://cdn.pixabay.com/${suffix}-web.jpg`,
    largeImageURL: `https://cdn.pixabay.com/${suffix}-large.jpg`,
    imageWidth: width, imageHeight: height, user: "Teacher", user_id: 7,
  });
  const fetcher: typeof fetch = async () => Response.json({
    totalHits: 5,
    hits: [
      hit(1, "photo", "apple, fruit", 800, 500),
      hit(2, "illustration", "apple, fruit", 800, 500),
      hit(3, "illustration", "apple, fruit", 700, 700),
      hit(4, "vector", "pear, fruit", 700, 700),
      hit(5, "illustration", "apple, fruit", 700, 700, "3"),
    ],
  });
  const result = await new PixabayImageSearchProvider("secret", fetcher).search({
    query: "apple isolated cartoon illustration white background",
    page: 1, pageSize: 3, mediaType: "ILLUSTRATION", orientation: "ALL", safeSearch: true,
  });
  assert.deepEqual(result.items.map((item) => item.providerAssetId), ["3", "2", "1"]);
  assert.equal(new Set(result.items.map((item) => item.downloadUrl)).size, result.items.length);
});
