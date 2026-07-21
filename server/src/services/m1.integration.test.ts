import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { AuditRepository } from "../repositories/audit.repository";
import { ClassRepository } from "../repositories/class.repository";
import { EnrollmentRepository } from "../repositories/enrollment.repository";
import { StudentRepository } from "../repositories/student.repository";
import { ClassService } from "./class.service";
import { EnrollmentService } from "./enrollment.service";
import { StudentService } from "./student.service";

const enabled = process.env.RUN_MYSQL_INTEGRATION === "1";
const integration = enabled ? test : test.skip;

integration("M1 class, student, enrollment transitions and audit persist", async () => {
  const connection = await pool.getConnection();
  await connection.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of ["tuition_receipt_allocations", "tuition_receipts", "tuition_cycle_sessions", "tuition_cycles", "lesson_attendances", "lesson_makeup_replacements", "lesson_session_participants", "lesson_sessions", "recurring_schedules", "enrollment_active_periods", "class_active_periods", "enrollment_tuition_policies", "class_tuition_policies", "class_enrollments", "audit_logs", "students", "classes"]) await connection.query(`TRUNCATE TABLE ${table}`);
  await connection.query("SET FOREIGN_KEY_CHECKS=1");
  connection.release();

  const classes = new ClassService(new ClassRepository());
  const students = new StudentService(new StudentRepository());
  const enrollments = new EnrollmentService(new EnrollmentRepository());
  const classInput = { name: "Integration Group", type: "GROUP" as const, defaultPackagePrice: 2400000, defaultDurationMinutes: 90, startDate: "2026-07-20", schedules: [{ dayOfWeek: 2 as const, startTime: "18:00", endTime: "19:30" }] };
  const groupId = await classes.create(classInput);
  const firstStudent = await students.create({ fullName: "Integration Student One" });
  const enrollmentId = await enrollments.create(groupId, { studentId: firstStudent, joinedAt: "2026-07-20", tuitionMode: "CLASS_DEFAULT" });
  await assert.rejects(() => enrollments.create(groupId, { studentId: firstStudent, joinedAt: "2026-07-20", tuitionMode: "CLASS_DEFAULT" }), (error: unknown) => error instanceof AppError && error.code === "STUDENT_ACTIVE_ENROLLMENT");
  await enrollments.changeTuitionMode(enrollmentId, { tuitionMode: "CUSTOM", customPackagePrice: 1900000, effectiveFrom: "2026-08-01", reason: "Integration" });
  await enrollments.pause(enrollmentId, { effectiveDate: "2026-08-10" });
  await enrollments.resume(enrollmentId, { effectiveDate: "2026-08-11" });
  await enrollments.end(enrollmentId, { endedAt: "2026-08-31", reason: "Integration end" });

  const oneId = await classes.create({ ...classInput, name: "Integration 1-1", type: "ONE_TO_ONE" });
  const second = await students.create({ fullName: "Integration Student Two" });
  const third = await students.create({ fullName: "Integration Student Three" });
  await enrollments.create(oneId, { studentId: second, joinedAt: "2026-07-20", tuitionMode: "FREE" });
  await assert.rejects(() => enrollments.create(oneId, { studentId: third, joinedAt: "2026-07-20", tuitionMode: "CLASS_DEFAULT" }), (error: unknown) => error instanceof AppError && error.code === "ONE_TO_ONE_LIMIT");

  const [auditRows] = await pool.query<Array<{ action: string } & import("mysql2/promise").RowDataPacket>>("SELECT action FROM audit_logs");
  for (const action of ["CLASS_CREATED", "STUDENT_CREATED", "ENROLLMENT_CREATED", "TUITION_MODE_CHANGED", "ENROLLMENT_PAUSED", "ENROLLMENT_RESUMED", "ENROLLMENT_ENDED", "RECURRING_SCHEDULE_CREATED"]) assert.ok(auditRows.some((row) => row.action === action), `missing audit ${action}`);
});

integration("database unique key is the final active-enrollment boundary", async () => {
  const [classes] = await pool.query<Array<{ id: number } & import("mysql2/promise").RowDataPacket>>("SELECT id FROM classes WHERE name='Integration Group'");
  const [students] = await pool.query<Array<{ id: number } & import("mysql2/promise").RowDataPacket>>("SELECT id FROM students WHERE full_name='Integration Student Three'");
  await pool.execute("INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,tuition_effective_from) VALUES (?,?,CURDATE(),'CLASS_DEFAULT',CURDATE())", [classes[0].id, students[0].id]);
  await assert.rejects(() => pool.execute("INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,tuition_effective_from) VALUES (?,?,CURDATE(),'CLASS_DEFAULT',CURDATE())", [classes[0].id, students[0].id]), (error: unknown) => (error as { code?: string }).code === "ER_DUP_ENTRY");
});

integration("audit failure rolls the business transaction back", async () => {
  class FailingAudit extends AuditRepository { override async record(_connection: PoolConnection): Promise<void> { throw new Error("audit failure"); } }
  const repository = new ClassRepository(new FailingAudit());
  await assert.rejects(() => repository.create({ name: "Must Roll Back", type: "GROUP", defaultPackagePrice: 2000000, defaultDurationMinutes: 90, startDate: "2026-07-20", schedules: [] }));
  const [rows] = await pool.query<Array<{ count: number } & import("mysql2/promise").RowDataPacket>>("SELECT COUNT(*) count FROM classes WHERE name='Must Roll Back'");
  assert.equal(Number(rows[0].count), 0);
});

test.after(async () => { if (enabled) await pool.end(); });
