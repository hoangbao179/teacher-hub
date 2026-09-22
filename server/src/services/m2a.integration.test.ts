import assert from "node:assert/strict";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool";
import { LessonRepository } from "../repositories/lesson.repository";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

async function clean(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of [
      "tuition_receipt_allocations", "tuition_receipts", "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances",
      "lesson_makeup_replacements", "lesson_session_participants", "lesson_sessions", "enrollment_active_periods",
      "class_active_periods", "enrollment_tuition_policies", "class_tuition_policies", "class_enrollments", "audit_logs", "students", "classes",
    ]) await connection.query(`TRUNCATE TABLE ${table}`);
    await connection.query("SET FOREIGN_KEY_CHECKS=1");
  } finally {
    connection.release();
  }
}

integration("M2A migration backfill tables and constraints are valid", async () => {
  const [migrations] = await pool.query<RowDataPacket[]>(
    "SELECT version FROM schema_migrations WHERE version='0004_m2a_lesson_domain.sql'",
  );
  assert.equal(migrations.length, 1);
  const [constraints] = await pool.query<RowDataPacket[]>(
    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='fk_attendance_participant_identity'`,
  );
  assert.equal(constraints.length, 1);
});

integration("historical regular and selected makeup participant snapshots are correct", async () => {
  await clean();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [classResult] = await connection.execute<import("mysql2/promise").ResultSetHeader>(
      "INSERT INTO classes(name,class_type,default_package_price,default_duration_minutes,start_date) VALUES ('M2A','GROUP',2400000,90,'2026-07-01')",
    );
    await connection.execute("INSERT INTO class_active_periods(class_id,active_from) VALUES (?,'2026-07-01')", [classResult.insertId]);
    const enrollmentIds: number[] = [];
    for (const [index, joinedAt, endedAt] of [
      [1, "2026-07-01", null],
      [2, "2026-07-11", null],
      [3, "2026-07-01", "2026-07-10"],
      [4, "2026-07-01", "2026-07-09"],
    ] as const) {
      const [student] = await connection.execute<import("mysql2/promise").ResultSetHeader>(
        "INSERT INTO students(full_name) VALUES (?)", [`M2A Student ${index}`],
      );
      const [enrollment] = await connection.execute<import("mysql2/promise").ResultSetHeader>(
        `INSERT INTO class_enrollments(class_id,student_id,joined_at,ended_at,status,tuition_mode,tuition_effective_from)
         VALUES (?,?,?,?,?,'CLASS_DEFAULT',?)`,
        [classResult.insertId, student.insertId, joinedAt, endedAt, endedAt ? "ENDED" : "ACTIVE", joinedAt],
      );
      enrollmentIds.push(enrollment.insertId);
      await connection.execute(
        "INSERT INTO enrollment_active_periods(enrollment_id,active_from,active_to) VALUES (?,?,?)",
        [enrollment.insertId, joinedAt, endedAt],
      );
    }
    const [regular] = await connection.execute<import("mysql2/promise").ResultSetHeader>(
      `INSERT INTO lesson_sessions(class_id,session_date,scheduled_start_time,scheduled_end_time,lesson_type)
       VALUES (?,'2026-07-10','18:00','19:30','REGULAR')`, [classResult.insertId],
    );
    const lessons = new LessonRepository();
    assert.deepEqual(
      await lessons.snapshotParticipants(connection, regular.insertId, classResult.insertId, "2026-07-10", null),
      [enrollmentIds[0], enrollmentIds[2]],
    );
    await assert.rejects(
      () => lessons.snapshotParticipants(connection, regular.insertId, classResult.insertId, "2026-07-10", null),
      (error: unknown) => (error as { code?: string }).code === "ER_DUP_ENTRY",
    );
    const [makeup] = await connection.execute<import("mysql2/promise").ResultSetHeader>(
      `INSERT INTO lesson_sessions(class_id,session_date,scheduled_start_time,scheduled_end_time,lesson_type)
       VALUES (?,'2026-07-10','20:00','21:00','MAKEUP')`, [classResult.insertId],
    );
    assert.deepEqual(
      await lessons.snapshotParticipants(connection, makeup.insertId, classResult.insertId, "2026-07-10", [enrollmentIds[2]]),
      [enrollmentIds[2]],
    );
    const [participants] = await connection.query<RowDataPacket[]>(
      "SELECT id,enrollment_id FROM lesson_session_participants WHERE lesson_session_id=?", [makeup.insertId],
    );
    await assert.rejects(
      () => connection.execute(
        `INSERT INTO lesson_attendances
          (lesson_session_id,participant_id,enrollment_id,attendance_status,counts_for_tuition)
         VALUES (?,?,?,'PRESENT',1)`,
        [makeup.insertId, participants[0].id, enrollmentIds[0]],
      ),
      (error: unknown) => (error as { code?: string }).code === "ER_NO_REFERENCED_ROW_2",
    );
    await connection.rollback();
  } finally {
    connection.release();
  }
});

test.after(async () => { if (enabled) await pool.end(); });
