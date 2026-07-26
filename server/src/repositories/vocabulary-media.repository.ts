import type {
  VocabularyImageProvider,
  VocabularyStoredMedia,
} from "@teacher/shared";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import type { ProviderImageAsset } from "../integrations/images/image-search.provider";
import { AuditRepository } from "./audit.repository";

interface CacheRow extends RowDataPacket {
  result_json: unknown;
  expires_at: Date | string;
}

interface MediaRow extends RowDataPacket {
  id: number;
  provider: VocabularyImageProvider;
  provider_asset_id: string;
  source_page_url: string;
  contributor_name: string;
  attribution_text: string;
  license_label: string;
  storage_path: string;
  thumbnail_path: string;
  alt_text: string;
  mime_type: "image/webp";
  byte_size: number;
  width: number;
  height: number;
}

export interface CachedSearchPayload {
  total: number;
  items: ProviderImageAsset[];
}

export interface CreateMediaRecord {
  provider: VocabularyImageProvider;
  asset: ProviderImageAsset;
  storagePath: string;
  thumbnailPath: string;
  altText: string;
  byteSize: number;
  width: number;
  height: number;
  contentSha256: string;
}

function json<T>(value: unknown): T {
  return typeof value === "string" ? JSON.parse(value) as T : value as T;
}

function mapMedia(row: MediaRow): VocabularyStoredMedia {
  return {
    id: Number(row.id),
    provider: row.provider,
    providerAssetId: row.provider_asset_id,
    url: `/api/public/vocabulary-media/${row.id}?variant=GAME`,
    thumbnailUrl: `/api/public/vocabulary-media/${row.id}?variant=THUMBNAIL`,
    width: Number(row.width),
    height: Number(row.height),
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    altText: row.alt_text,
    contributorName: row.contributor_name,
    attributionText: row.attribution_text,
    sourcePageUrl: row.source_page_url,
    licenseLabel: row.license_label,
  };
}

export class VocabularyMediaRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async findCache(provider: VocabularyImageProvider, cacheKey: string, now: Date) {
    const [rows] = await pool.execute<CacheRow[]>(
      `SELECT result_json,expires_at
       FROM vocabulary_image_search_cache
       WHERE provider=? AND cache_key=? AND expires_at>? LIMIT 1`,
      [provider, cacheKey, now],
    );
    const row = rows[0];
    return row ? {
      payload: json<CachedSearchPayload>(row.result_json),
      expiresAt: new Date(row.expires_at),
    } : null;
  }

  async saveCache(input: {
    provider: VocabularyImageProvider;
    cacheKey: string;
    normalizedQuery: string;
    mediaType: string;
    orientation: string;
    page: number;
    pageSize: number;
    payload: CachedSearchPayload;
    expiresAt: Date;
  }): Promise<void> {
    await pool.execute(
      `INSERT INTO vocabulary_image_search_cache
        (provider,cache_key,normalized_query,media_type,orientation,page,page_size,result_json,expires_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE result_json=VALUES(result_json),
         expires_at=VALUES(expires_at),created_at=CURRENT_TIMESTAMP`,
      [
        input.provider,
        input.cacheKey,
        input.normalizedQuery,
        input.mediaType,
        input.orientation,
        input.page,
        input.pageSize,
        JSON.stringify(input.payload),
        input.expiresAt,
      ],
    );
    await pool.execute(
      `DELETE FROM vocabulary_image_search_cache
       WHERE expires_at<=CURRENT_TIMESTAMP
       ORDER BY expires_at
       LIMIT 500`,
    );
  }

  async findCachedAsset(
    provider: VocabularyImageProvider,
    providerAssetId: string,
    now: Date,
  ): Promise<ProviderImageAsset | null> {
    const [rows] = await pool.execute<CacheRow[]>(
      `SELECT result_json,expires_at
       FROM vocabulary_image_search_cache
       WHERE provider=? AND expires_at>?
       ORDER BY created_at DESC LIMIT 100`,
      [provider, now],
    );
    for (const row of rows) {
      const found = json<CachedSearchPayload>(row.result_json).items.find(
        (item) => item.providerAssetId === providerAssetId,
      );
      if (found) return found;
    }
    return null;
  }

  async findMedia(
    provider: VocabularyImageProvider,
    providerAssetId: string,
  ): Promise<VocabularyStoredMedia | null> {
    const [rows] = await pool.execute<MediaRow[]>(
      `SELECT * FROM vocabulary_media
       WHERE provider=? AND provider_asset_id=? AND status='ACTIVE' LIMIT 1`,
      [provider, providerAssetId],
    );
    return rows[0] ? mapMedia(rows[0]) : null;
  }

  async findMediaRecord(id: number): Promise<{
    media: VocabularyStoredMedia;
    storagePath: string;
    thumbnailPath: string;
  } | null> {
    const [rows] = await pool.execute<MediaRow[]>(
      "SELECT * FROM vocabulary_media WHERE id=? AND status='ACTIVE' LIMIT 1",
      [id],
    );
    return rows[0] ? {
      media: mapMedia(rows[0]),
      storagePath: rows[0].storage_path,
      thumbnailPath: rows[0].thumbnail_path,
    } : null;
  }

  async createMedia(
    input: CreateMediaRecord,
    actorUserId: number,
  ): Promise<{ media: VocabularyStoredMedia; created: boolean }> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO vocabulary_media
          (provider,provider_asset_id,source_url,source_page_url,contributor_name,
           contributor_url,attribution_text,attribution_url,license_label,
           storage_path,thumbnail_path,alt_text,mime_type,byte_size,width,height,
           content_sha256,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE')`,
        [
          input.provider,
          input.asset.providerAssetId,
          input.asset.downloadUrl,
          input.asset.sourcePageUrl,
          input.asset.contributorName,
          input.asset.contributorUrl,
          input.asset.attributionText,
          input.asset.sourcePageUrl,
          input.asset.licenseLabel,
          input.storagePath,
          input.thumbnailPath,
          input.altText,
          "image/webp",
          input.byteSize,
          input.width,
          input.height,
          input.contentSha256,
        ],
      );
      if (!result.affectedRows) {
        await connection.rollback();
        const existing = await this.findMedia(input.provider, input.asset.providerAssetId);
        if (!existing) throw new Error("Vocabulary media duplicate could not be resolved");
        return { media: existing, created: false };
      }
      const id = Number(result.insertId);
      await this.audit.record(connection, {
        actorUserId,
        action: "VOCABULARY_MEDIA_IMPORTED",
        entityType: "VOCABULARY_MEDIA",
        entityId: id,
        newValues: {
          provider: input.provider,
          providerAssetId: input.asset.providerAssetId,
          contentSha256: input.contentSha256,
        },
      });
      await connection.commit();
      const media = await this.findMedia(input.provider, input.asset.providerAssetId);
      if (!media) throw new Error("Created vocabulary media not found");
      return { media, created: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
