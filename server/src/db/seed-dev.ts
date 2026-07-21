import "dotenv/config";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "./pool";

async function ensureClassActivePeriod(connection: PoolConnection, classId: number, status: "ACTIVE" | "PAUSED" | "CLOSED"): Promise<void> {
  await connection.execute(
    `INSERT INTO class_active_periods(class_id,active_from,active_to)
     SELECT id,start_date,CASE WHEN ?='ACTIVE' THEN NULL ELSE GREATEST(start_date,DATE_SUB(CURDATE(),INTERVAL 1 DAY)) END
     FROM classes WHERE id=? AND NOT EXISTS (SELECT 1 FROM class_active_periods WHERE class_id=?)`,
    [status, classId, classId],
  );
}

async function ensureClass(connection: PoolConnection, name: string, type: "GROUP" | "ONE_TO_ONE", status: "ACTIVE" | "PAUSED" | "CLOSED", price: number): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM classes WHERE name=? LIMIT 1 FOR UPDATE", [name]);
  if (rows[0]) {
    const classId = Number(rows[0].id);
    await ensureClassActivePeriod(connection, classId, status);
    return classId;
  }
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO classes(name,class_type,subject,default_package_price,default_duration_minutes,start_date,status,closed_at,note)
     VALUES (?,?,?, ?,90,CURDATE(),?,IF(?='CLOSED',NOW(),NULL),'DEV_SEED')`,
    [name, type, "Tiếng Anh", price, status, status],
  );
  await connection.execute(
    "INSERT INTO class_tuition_policies(class_id,package_price,effective_from) VALUES (?,?,CURDATE())",
    [result.insertId, price],
  );
  await ensureClassActivePeriod(connection, result.insertId, status);
  return result.insertId;
}

async function ensureStudent(connection: PoolConnection, fullName: string): Promise<number> {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM students WHERE full_name=? AND note='DEV_SEED' LIMIT 1 FOR UPDATE", [fullName]);
  if (rows[0]) return Number(rows[0].id);
  const [result] = await connection.execute<ResultSetHeader>(
    "INSERT INTO students(full_name,nickname,parent_name,parent_phone,note) VALUES (?,?,?,?,?)",
    [fullName, fullName.split(" ").at(-1) ?? fullName, "Phụ huynh mẫu", "0900000000", "DEV_SEED"],
  );
  return result.insertId;
}

async function ensureEnrollment(connection: PoolConnection, classId: number, studentId: number, mode: "CLASS_DEFAULT" | "CUSTOM" | "FREE", price?: number): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT id FROM class_enrollments WHERE class_id=? AND student_id=? LIMIT 1 FOR UPDATE", [classId, studentId]);
  if (rows[0]) {
    const enrollmentId = Number(rows[0].id);
    await connection.execute(
      `INSERT INTO enrollment_active_periods(enrollment_id,active_from)
       SELECT id,joined_at FROM class_enrollments WHERE id=? AND status='ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM enrollment_active_periods WHERE enrollment_id=?)`,
      [enrollmentId, enrollmentId],
    );
    return;
  }
  const [result] = await connection.execute<ResultSetHeader>(
    `INSERT INTO class_enrollments(class_id,student_id,joined_at,tuition_mode,custom_package_price,tuition_effective_from,note)
     VALUES (?,?,CURDATE(),?,?,CURDATE(),'DEV_SEED')`,
    [classId, studentId, mode, mode === "CUSTOM" ? (price ?? null) : null],
  );
  await connection.execute(
    `INSERT INTO enrollment_tuition_policies
      (enrollment_id,tuition_mode,custom_package_price,effective_from)
     VALUES (?,?,?,CURDATE())`,
    [result.insertId, mode, mode === "CUSTOM" ? (price ?? null) : null],
  );
  await connection.execute(
    "INSERT INTO enrollment_active_periods(enrollment_id,active_from) VALUES (?,CURDATE())",
    [result.insertId],
  );
}

async function ensureSchedule(connection: PoolConnection, classId: number, day: number, start: string, end: string): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT id FROM recurring_schedules WHERE class_id=? AND day_of_week=? AND start_time=? AND effective_to IS NULL LIMIT 1",
    [classId, day, start],
  );
  if (!rows[0]) await connection.execute(
    "INSERT INTO recurring_schedules(class_id,day_of_week,start_time,end_time,effective_from) VALUES (?,?,?,?,CURDATE())",
    [classId, day, start, end],
  );
}

async function upgradeLegacyDevClasses(connection: PoolConnection): Promise<void> {
  const renames = [
    ["DEV - Lớp nhóm A", "DEV - Tiếng Anh lớp 6 nhóm nhỏ"],
    ["DEV - Lớp 1 kèm 1", "DEV - Tiếng Anh 1 kèm 1"],
    ["DEV - Lớp tạm dừng", "DEV - Ôn ngữ pháp tạm dừng"],
    ["DEV - Lớp đã đóng", "DEV - Phonics đã đóng"],
  ] as const;
  for (const [oldName, newName] of renames) {
    await connection.execute(
      "UPDATE classes SET name=?, subject='Tiếng Anh' WHERE name=? AND note='DEV_SEED'",
      [newName, oldName],
    );
  }
}

async function seed(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("Không được seed dữ liệu dev trong production.");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await upgradeLegacyDevClasses(connection);
    const groupId = await ensureClass(connection, "DEV - Tiếng Anh lớp 6 nhóm nhỏ", "GROUP", "ACTIVE", 2400000);
    const oneToOneId = await ensureClass(connection, "DEV - Tiếng Anh 1 kèm 1", "ONE_TO_ONE", "ACTIVE", 2800000);
    await ensureClass(connection, "DEV - Ôn ngữ pháp tạm dừng", "GROUP", "PAUSED", 2200000);
    await ensureClass(connection, "DEV - Phonics đã đóng", "GROUP", "CLOSED", 2200000);
    const students = await Promise.all(["Học sinh Mẫu Một", "Học sinh Mẫu Hai", "Học sinh Mẫu Ba", "Học sinh Mẫu Bốn", "Học sinh Mẫu Năm"].map((name) => ensureStudent(connection, name)));
    await ensureEnrollment(connection, groupId, students[0], "CLASS_DEFAULT");
    await ensureEnrollment(connection, groupId, students[1], "CUSTOM", 2000000);
    await ensureEnrollment(connection, groupId, students[2], "FREE");
    await ensureEnrollment(connection, oneToOneId, students[3], "CLASS_DEFAULT");
    await ensureSchedule(connection, groupId, 2, "18:00", "19:30");
    await ensureSchedule(connection, groupId, 5, "18:00", "19:30");
    await ensureSchedule(connection, oneToOneId, 3, "20:00", "21:30");
    await connection.commit();
    console.log("Development seed is ready (idempotent DEV_* records).");
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); await pool.end(); }
}

void seed().catch((error) => { console.error(error); process.exit(1); });
