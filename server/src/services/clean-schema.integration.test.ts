import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

integration("clean schema removes legacy tuition/import tables and columns", async () => {
  const [tables] = await pool.query<RowDataPacket[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema=DATABASE() AND table_name IN (
       'tuition_cycles','tuition_cycle_sessions','tuition_receipts','tuition_receipt_allocations',
       'class_tuition_policies','enrollment_tuition_policies',
       'legacy_imports','legacy_import_row_audits','legacy_import_lesson_links'
     )`,
  );
  assert.deepEqual(tables, []);

  const [enrollmentColumns] = await pool.query<RowDataPacket[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name='class_enrollments'
       AND column_name IN ('tuition_mode','custom_package_price','tuition_effective_from','tuition_exempt')
     ORDER BY column_name`,
  );
  assert.deepEqual(enrollmentColumns.map((row) => row.COLUMN_NAME), ["tuition_exempt"]);

  const [classPriceColumns] = await pool.query<RowDataPacket[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name='classes'
       AND column_name='default_package_price'`,
  );
  assert.deepEqual(classPriceColumns, []);

  const [attendanceColumns] = await pool.query<RowDataPacket[]>(
    `SELECT column_name,column_type FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name='lesson_attendances'
       AND column_name IN ('attendance_status','counts_for_tuition','excluded_from_tuition')`,
  );
  assert.deepEqual(attendanceColumns.map((row) => row.COLUMN_NAME), ["attendance_status"]);
  assert.equal(attendanceColumns[0]?.COLUMN_TYPE, "enum('PRESENT','ABSENT')");

  const [paymentColumns] = await pool.query<RowDataPacket[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name='monthly_tuition_payments'
       AND column_name='status'`,
  );
  assert.deepEqual(paymentColumns, []);

  const [sheetColumns] = await pool.query<RowDataPacket[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=DATABASE() AND table_name='student_google_sheets'
       AND column_name IN ('legacy_import_id','source_import_sha256')`,
  );
  assert.deepEqual(sheetColumns, []);
});

test.after(async () => {
  if (enabled) await pool.end();
});
