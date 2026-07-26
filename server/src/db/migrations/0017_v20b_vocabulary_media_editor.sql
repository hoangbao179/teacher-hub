CREATE TABLE vocabulary_image_search_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  cache_key CHAR(64) NOT NULL,
  normalized_query VARCHAR(100) NOT NULL,
  media_type ENUM('ALL','PHOTO','ILLUSTRATION','VECTOR') NOT NULL,
  orientation ENUM('ALL','HORIZONTAL','VERTICAL') NOT NULL,
  page INT UNSIGNED NOT NULL,
  page_size SMALLINT UNSIGNED NOT NULL,
  result_json JSON NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vocabulary_search_page CHECK (page BETWEEN 1 AND 1000),
  CONSTRAINT chk_vocabulary_search_page_size CHECK (page_size BETWEEN 3 AND 50),
  UNIQUE KEY uq_vocabulary_search_cache_key (provider,cache_key),
  INDEX idx_vocabulary_search_cache_expiry (expires_at),
  INDEX idx_vocabulary_search_cache_query (provider,normalized_query,media_type,orientation,page)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE vocabulary_media
  ADD COLUMN license_label VARCHAR(100) NULL AFTER attribution_url,
  ADD COLUMN status ENUM('ACTIVE','FAILED') NOT NULL DEFAULT 'ACTIVE' AFTER content_sha256,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
  ADD CONSTRAINT chk_vocabulary_media_binary CHECK (
    (status='ACTIVE' AND storage_path IS NOT NULL AND thumbnail_path IS NOT NULL
      AND mime_type='image/webp' AND byte_size IS NOT NULL
      AND width BETWEEN 256 AND 4096 AND height BETWEEN 256 AND 4096
      AND content_sha256 IS NOT NULL)
    OR status='FAILED'
  ),
  ADD INDEX idx_vocabulary_media_status (status,created_at);
