ALTER TABLE vocabulary_media
  DROP CHECK chk_vocabulary_media_binary,
  MODIFY COLUMN status ENUM('TEMPORARY','ACTIVE','FAILED') NOT NULL DEFAULT 'TEMPORARY',
  ADD COLUMN thumbnail_byte_size BIGINT UNSIGNED NULL AFTER byte_size,
  ADD INDEX idx_vocabulary_media_cleanup (status,created_at);

UPDATE vocabulary_media
SET thumbnail_byte_size=0
WHERE status='ACTIVE' AND thumbnail_byte_size IS NULL;

ALTER TABLE vocabulary_media
  ADD CONSTRAINT chk_vocabulary_media_binary CHECK (
    (status IN ('TEMPORARY','ACTIVE') AND storage_path IS NOT NULL AND thumbnail_path IS NOT NULL
      AND mime_type='image/webp' AND byte_size IS NOT NULL
      AND width BETWEEN 256 AND 4096 AND height BETWEEN 256 AND 4096
      AND content_sha256 IS NOT NULL)
    OR status='FAILED'
  );
