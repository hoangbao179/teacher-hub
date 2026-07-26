import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { VocabularyMediaStorage } from "./vocabulary-media-storage";
import { PublicAssetMaterializer } from "./public-asset-materializer";

test("public assets are allowlisted, materialized as WebP and never keep release paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "public-assets-"));
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "assignment-media-"));
  try {
    await fs.mkdir(path.join(root, "learning", "animals"), { recursive: true });
    await fs.writeFile(
      path.join(root, "learning", "animals", "cat.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="orange"/></svg>',
    );
    let createdInput: { provider?: string; storagePath?: string } = {};
    const repository = {
      findMedia: async () => null,
      findMediaBySha: async () => null,
      createMedia: async (input: { provider: string; storagePath: string }) => {
        createdInput = input;
        return {
          created: true,
          media: {
            id: 7,
            provider: "LOCAL_ASSET",
            providerAssetId: "local",
            url: "/api/public/vocabulary-media/7?variant=GAME",
            thumbnailUrl: "/api/public/vocabulary-media/7?variant=THUMBNAIL",
            width: 300,
            height: 300,
            mimeType: "image/webp",
            byteSize: 100,
            altText: "cat",
            contributorName: "Lớp học cô Vy",
            attributionText: "Nội dung nội bộ",
            sourcePageUrl: "/learning/animals/cat.svg",
            licenseLabel: "Nội dung nội bộ",
          },
        };
      },
    };
    const materializer = new PublicAssetMaterializer(
      root,
      repository as never,
      new VocabularyMediaStorage(storageRoot),
    );
    const items = await materializer.materializeItems([{
      displayOrder: 1,
      word: "cat",
      meaningVi: "con mèo",
      tier: "CORE",
      illustration: { kind: "PUBLIC_ASSET", value: "/learning/animals/cat.svg" },
      supportsImageGame: true,
    }], 1);
    assert.deepEqual(items[0].illustration, { kind: "STORED_MEDIA", mediaId: 7 });
    assert.equal(createdInput.provider, "LOCAL_ASSET");
    assert.match(createdInput.storagePath ?? "", /^game\/.*\.webp$/);
    await assert.rejects(
      materializer.materialize("../secret.svg", "secret", 1),
      (error: unknown) => (error as { code?: string }).code === "VALIDATION_ERROR",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
});
