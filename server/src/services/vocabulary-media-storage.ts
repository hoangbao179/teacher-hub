import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface StoredRenditions {
  storagePath: string;
  thumbnailPath: string;
  absoluteStoragePath: string;
  absoluteThumbnailPath: string;
}

export class VocabularyMediaStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async initialize(): Promise<void> {
    await fs.mkdir(path.join(this.root, "game"), { recursive: true });
    await fs.mkdir(path.join(this.root, "thumbnail"), { recursive: true });
    await fs.access(this.root, constants.R_OK | constants.W_OK);
  }

  async backupLocked(): Promise<boolean> {
    return fs.access(path.join(this.root, ".backup.lock"))
      .then(() => true)
      .catch(() => false);
  }

  async write(game: Buffer, thumbnail: Buffer): Promise<StoredRenditions> {
    await this.initialize();
    const id = randomUUID();
    const storagePath = `game/${id}.webp`;
    const thumbnailPath = `thumbnail/${id}.webp`;
    const absoluteStoragePath = this.resolve(storagePath);
    const absoluteThumbnailPath = this.resolve(thumbnailPath);
    const tempGame = `${absoluteStoragePath}.tmp`;
    const tempThumbnail = `${absoluteThumbnailPath}.tmp`;
    try {
      await fs.writeFile(tempGame, game, { flag: "wx" });
      await fs.writeFile(tempThumbnail, thumbnail, { flag: "wx" });
      await fs.rename(tempGame, absoluteStoragePath);
      await fs.rename(tempThumbnail, absoluteThumbnailPath);
      return { storagePath, thumbnailPath, absoluteStoragePath, absoluteThumbnailPath };
    } catch (error) {
      await Promise.allSettled([
        fs.rm(tempGame, { force: true }),
        fs.rm(tempThumbnail, { force: true }),
        fs.rm(absoluteStoragePath, { force: true }),
        fs.rm(absoluteThumbnailPath, { force: true }),
      ]);
      throw error;
    }
  }

  resolve(relativePath: string): string {
    if (!/^(game|thumbnail)\/[a-f0-9-]+\.webp$/i.test(relativePath))
      throw new Error("Unsafe vocabulary media path");
    const absolute = path.resolve(this.root, relativePath);
    if (!absolute.startsWith(`${this.root}${path.sep}`))
      throw new Error("Vocabulary media path traversal rejected");
    return absolute;
  }

  async remove(...absolutePaths: string[]): Promise<void> {
    await Promise.all(absolutePaths.map((value) => fs.rm(value, { force: true })));
  }

  async exists(relativePath: string): Promise<boolean> {
    return fs.access(this.resolve(relativePath), constants.R_OK).then(() => true).catch(() => false);
  }

  async files(): Promise<string[]> {
    await this.initialize();
    const result: string[] = [];
    for (const folder of ["game", "thumbnail"] as const) {
      const names = await fs.readdir(path.join(this.root, folder));
      result.push(...names.filter((name) => /^[a-f0-9-]+\.webp$/i.test(name)).map((name) => `${folder}/${name}`));
    }
    return result;
  }

  async size(relativePath: string): Promise<number> {
    return (await fs.stat(this.resolve(relativePath))).size;
  }
}
