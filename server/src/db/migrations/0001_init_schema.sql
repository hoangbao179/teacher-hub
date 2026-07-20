CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role ENUM('TEACHER') NOT NULL DEFAULT 'TEACHER',
  status ENUM('ACTIVE','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  nickname VARCHAR(100) NULL,
  date_of_birth DATE NULL,
  parent_name VARCHAR(150) NULL,
  parent_phone VARCHAR(30) NULL,
  note TEXT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_students_name (full_name),
  INDEX idx_students_parent_phone (parent_phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS classes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  class_type ENUM('ONE_TO_ONE','GROUP') NOT NULL,
  subject VARCHAR(120) NULL,
  default_package_price BIGINT UNSIGNED NOT NULL,
  default_duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  start_date DATE NOT NULL,
  expected_end_date DATE NULL,
  status ENUM('ACTIVE','PAUSED','CLOSED') NOT NULL DEFAULT 'ACTIVE',
  closed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_classes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_enrollments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  joined_at DATE NOT NULL,
  ended_at DATE NULL,
  tuition_mode ENUM('CLASS_DEFAULT','CUSTOM','FREE') NOT NULL DEFAULT 'CLASS_DEFAULT',
  custom_package_price BIGINT UNSIGNED NULL,
  status ENUM('ACTIVE','PAUSED','ENDED') NOT NULL DEFAULT 'ACTIVE',
  end_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_enrollments_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id),
  INDEX idx_enrollments_class_status (class_id, status),
  INDEX idx_enrollments_student_status (student_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recurring_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL COMMENT '1=Monday..7=Sunday',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedules_class FOREIGN KEY (class_id) REFERENCES classes(id),
  INDEX idx_schedules_class_day (class_id, day_of_week),
  CONSTRAINT chk_day_of_week CHECK (day_of_week BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  original_date DATE NOT NULL,
  exception_type ENUM('SKIPPED','RESCHEDULED') NOT NULL,
  replacement_date DATE NULL,
  replacement_start_time TIME NULL,
  replacement_end_time TIME NULL,
  reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_exceptions_class FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE KEY uq_class_original_date (class_id, original_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_busy_slots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  recurrence_type ENUM('WEEKLY','ONCE') NOT NULL,
  day_of_week TINYINT UNSIGNED NULL,
  specific_date DATE NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  effective_from DATE NULL,
  effective_to DATE NULL,
  location VARCHAR(255) NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_busy_slots_weekday (day_of_week),
  INDEX idx_busy_slots_specific_date (specific_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  class_id BIGINT UNSIGNED NOT NULL,
  session_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  actual_start_time TIME NULL,
  actual_end_time TIME NULL,
  actual_duration_minutes SMALLINT UNSIGNED NULL,
  lesson_type ENUM('REGULAR','MAKEUP','EXTRA') NOT NULL DEFAULT 'REGULAR',
  status ENUM('DRAFT','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  content TEXT NULL,
  homework TEXT NULL,
  note TEXT NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lessons_class FOREIGN KEY (class_id) REFERENCES classes(id),
  INDEX idx_lessons_class_date (class_id, session_date),
  INDEX idx_lessons_status_date (status, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lesson_attendances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lesson_session_id BIGINT UNSIGNED NOT NULL,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  attendance_status ENUM('PRESENT','ABSENT','FREE') NOT NULL,
  counts_for_tuition BOOLEAN NOT NULL DEFAULT FALSE,
  student_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_lesson FOREIGN KEY (lesson_session_id) REFERENCES lesson_sessions(id),
  CONSTRAINT fk_attendance_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  UNIQUE KEY uq_lesson_enrollment (lesson_session_id, enrollment_id),
  INDEX idx_attendance_enrollment_billable (enrollment_id, counts_for_tuition)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tuition_cycles (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  cycle_number INT UNSIGNED NOT NULL,
  target_session_count TINYINT UNSIGNED NOT NULL DEFAULT 8,
  package_price_snapshot BIGINT UNSIGNED NOT NULL,
  status ENUM('ACCUMULATING','PAYMENT_DUE','PAID','INCOMPLETE','CANCELLED') NOT NULL DEFAULT 'ACCUMULATING',
  started_at DATE NULL,
  reached_target_at DATE NULL,
  paid_at DATETIME NULL,
  paid_amount BIGINT UNSIGNED NULL,
  payment_method ENUM('CASH','BANK_TRANSFER') NULL,
  payment_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cycles_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  UNIQUE KEY uq_enrollment_cycle_number (enrollment_id, cycle_number),
  INDEX idx_cycles_status (status),
  INDEX idx_cycles_enrollment_status (enrollment_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tuition_cycle_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tuition_cycle_id BIGINT UNSIGNED NOT NULL,
  attendance_id BIGINT UNSIGNED NOT NULL,
  sequence_number TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cycle_sessions_cycle FOREIGN KEY (tuition_cycle_id) REFERENCES tuition_cycles(id),
  CONSTRAINT fk_cycle_sessions_attendance FOREIGN KEY (attendance_id) REFERENCES lesson_attendances(id),
  UNIQUE KEY uq_attendance_cycle (attendance_id),
  UNIQUE KEY uq_cycle_sequence (tuition_cycle_id, sequence_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id BIGINT UNSIGNED NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  reason VARCHAR(255) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
