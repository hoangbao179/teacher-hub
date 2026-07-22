ALTER TABLE teacher_busy_slots
  ADD COLUMN slot_type ENUM('EXTERNAL_CLASS','PERSONAL','OTHER') NOT NULL DEFAULT 'OTHER' AFTER id,
  ADD COLUMN organization_type ENUM('SCHOOL','CENTER') NULL AFTER slot_type,
  ADD COLUMN organization_name VARCHAR(160) NULL AFTER organization_type;

UPDATE teacher_busy_slots SET slot_type='OTHER' WHERE slot_type IS NULL;
