import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type {
  CreateStudentRequest,
  StudentDetail,
  StudentListItem,
  TuitionMode,
  UpdateStudentRequest,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { AuditRepository } from "./audit.repository";

interface StudentJoinedRow extends RowDataPacket {
  id: number;
  full_name: string;
  nickname: string | null;
  status: StudentListItem["status"];
  date_of_birth: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  note: string | null;
  class_id: number | null;
  class_name: string | null;
  enrollment_id: number | null;
  enrollment_status: StudentListItem["enrollmentStatus"];
  tuition_mode: TuitionMode | null;
  custom_package_price: number | null;
  default_package_price: number | null;
  joined_at: string | null;
  current_progress: number | null;
  has_payment_due: number;
}

function map(row: StudentJoinedRow): StudentDetail {
  const effective =
    row.tuition_mode === "FREE"
      ? null
      : row.tuition_mode === "CUSTOM"
        ? row.custom_package_price
        : row.default_package_price;
  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    status: row.status,
    dateOfBirth: row.date_of_birth
      ? String(row.date_of_birth).slice(0, 10)
      : null,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    note: row.note,
    classId: row.class_id,
    className: row.class_name,
    enrollmentId: row.enrollment_id,
    enrollmentStatus: row.enrollment_status,
    tuitionMode: row.tuition_mode,
    customPackagePrice:
      row.custom_package_price == null
        ? null
        : Number(row.custom_package_price),
    joinedAt: row.joined_at ? String(row.joined_at).slice(0, 10) : null,
    currentProgress:
      row.current_progress == null ? null : Number(row.current_progress),
    hasPaymentDue: Boolean(row.has_payment_due),
    effectivePackagePrice: effective == null ? null : Number(effective),
  };
}

const baseQuery = `
  SELECT s.*, e.id enrollment_id, e.class_id, c.name class_name, e.status enrollment_status,
    e.tuition_mode, e.custom_package_price, c.default_package_price, e.joined_at,
    (SELECT COUNT(*) FROM tuition_cycle_sessions tcs JOIN tuition_cycles tc ON tc.id=tcs.tuition_cycle_id WHERE tc.enrollment_id=e.id AND tc.status='ACCUMULATING') current_progress,
    EXISTS(SELECT 1 FROM tuition_cycles due WHERE due.enrollment_id=e.id AND due.status='PAYMENT_DUE') has_payment_due
  FROM students s
  LEFT JOIN class_enrollments e ON e.student_id=s.id AND e.status IN ('ACTIVE','PAUSED')
  LEFT JOIN classes c ON c.id=e.class_id
`;

export class StudentRepository {
  constructor(private readonly audit = new AuditRepository()) {}
  async list(): Promise<StudentListItem[]> {
    const [rows] = await pool.query<StudentJoinedRow[]>(
      `${baseQuery} ORDER BY s.full_name`,
    );
    return rows.map(map);
  }

  async findDetail(id: number): Promise<StudentDetail | null> {
    const [rows] = await pool.query<StudentJoinedRow[]>(
      `${baseQuery} WHERE s.id=? LIMIT 1`,
      [id],
    );
    return rows[0] ? map(rows[0]) : null;
  }

  async create(input: CreateStudentRequest, actorUserId?: number): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [studentResult] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO students(full_name,nickname,date_of_birth,parent_name,parent_phone,note)
        VALUES (?,?,?,?,?,?)
      `,
        [
          input.fullName,
          input.nickname ?? null,
          input.dateOfBirth ?? null,
          input.parentName ?? null,
          input.parentPhone ?? null,
          input.note ?? null,
        ],
      );
      await this.audit.record(connection, {
        actorUserId, action: "STUDENT_CREATED", entityType: "STUDENT",
        entityId: studentResult.insertId, newValues: input,
      });
      await connection.commit();
      return studentResult.insertId;
    } catch (error) {
      await connection.rollback(); throw error;
    } finally { connection.release(); }
  }

  async update(id: number, input: UpdateStudentRequest, actorUserId?: number): Promise<boolean> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>("SELECT * FROM students WHERE id=? FOR UPDATE", [id]);
      if (!rows[0]) { await connection.rollback(); return false; }
      const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE students SET full_name=?,nickname=?,date_of_birth=?,parent_name=?,parent_phone=?,note=?,status=? WHERE id=?`,
      [input.fullName, input.nickname ?? null, input.dateOfBirth ?? null,
        input.parentName ?? null, input.parentPhone ?? null, input.note ?? null,
        input.status, id],
    );
    await this.audit.record(connection, {
      actorUserId, action: "STUDENT_UPDATED", entityType: "STUDENT", entityId: id,
      previousValues: rows[0], newValues: input,
    });
    await connection.commit();
    return result.affectedRows > 0;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

}
