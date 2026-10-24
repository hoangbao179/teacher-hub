CREATE TABLE IF NOT EXISTS pdf_batches (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  owner_id BIGINT UNSIGNED NOT NULL,
  idempotency_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  rights_confirmed_at DATETIME(3) NOT NULL,
  rights_version VARCHAR(32) NOT NULL DEFAULT 'authorized-download-v1',
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_pdf_batch_request (owner_id,idempotency_key),
  INDEX idx_pdf_batch_owner (owner_id,created_at),
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pdf_jobs (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  batch_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  file_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ENQUEUE_PENDING',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  enqueued_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  expires_at DATETIME(3) NOT NULL,
  error_code VARCHAR(64) NULL,
  cloud_error_code VARCHAR(64) NULL,
  object_name VARCHAR(100) CHARACTER SET ascii NULL,
  bytes INT UNSIGNED NULL,
  pages SMALLINT UNSIGNED NULL,
  sha256 CHAR(64) CHARACTER SET ascii NULL,
  retry_of CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  retry_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  retry_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  enqueue_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  next_action_at DATETIME(3) NOT NULL,
  lease_token CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  lease_until DATETIME(3) NULL,
  UNIQUE KEY uq_pdf_retry_request (owner_id,retry_key),
  INDEX idx_pdf_job_owner (owner_id,status,expires_at),
  INDEX idx_pdf_job_work (next_action_at,lease_until),
  INDEX idx_pdf_job_batch (batch_id,created_at),
  FOREIGN KEY (batch_id) REFERENCES pdf_batches(id),
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (retry_of) REFERENCES pdf_jobs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pdf_download_tickets (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  job_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  INDEX idx_pdf_ticket_expiry (expires_at),
  FOREIGN KEY (job_id) REFERENCES pdf_jobs(id),
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
