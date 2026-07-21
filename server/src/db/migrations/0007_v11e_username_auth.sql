ALTER TABLE users
  ADD COLUMN username VARCHAR(190) NULL AFTER id;

UPDATE users
SET username = LOWER(email)
WHERE username IS NULL;

ALTER TABLE users
  MODIFY COLUMN username VARCHAR(190) NOT NULL,
  MODIFY COLUMN email VARCHAR(190) NULL,
  ADD UNIQUE KEY uq_users_username (username);
