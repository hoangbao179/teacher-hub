import "dotenv/config";
import { pool } from "./pool";

const businessTables = [
  "google_sheet_sync_outbox", "student_google_sheets", "monthly_tuition_payments",
  "lesson_attendances", "lesson_makeup_replacements", "lesson_session_participants", "lesson_sessions",
  "combined_teaching_occurrences", "combined_class_group_schedules", "combined_class_group_classes", "combined_class_groups",
  "schedule_exceptions", "recurring_schedules", "teacher_busy_slots", "class_enrollments",
  "enrollment_active_periods", "class_active_periods",
  "audit_logs", "students", "classes",
];

async function reset(): Promise<void> {
  const host = process.env.DB_HOST ?? "127.0.0.1";
  if (process.env.NODE_ENV === "production" || !["127.0.0.1", "localhost", "mysql", "mysql-test"].includes(host)) {
    throw new Error("db:reset:dev chỉ được phép với database development cục bộ.");
  }
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of businessTables) await connection.query(`TRUNCATE TABLE \`${table}\``);
  } finally {
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
    connection.release();
    await pool.end();
  }
  console.log("Development business data reset; users and schema_migrations were preserved.");
}

void reset().catch((error) => { console.error(error); process.exit(1); });
