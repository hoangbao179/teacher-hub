import type { PoolConnection } from "mysql2/promise";

export type AuditAction =
  | "CLASS_CREATED" | "CLASS_UPDATED" | "CLASS_PAUSED" | "CLASS_RESUMED" | "CLASS_CLOSED"
  | "STUDENT_CREATED" | "STUDENT_UPDATED"
  | "ENROLLMENT_CREATED" | "ENROLLMENT_PAUSED" | "ENROLLMENT_RESUMED" | "ENROLLMENT_ENDED"
  | "TUITION_MODE_CHANGED"
  | "RECURRING_SCHEDULE_CREATED" | "RECURRING_SCHEDULE_UPDATED" | "RECURRING_SCHEDULE_DELETED"
  | "RECURRING_SCHEDULE_VERSION_ENDED" | "RECURRING_SCHEDULE_ENDED"
  | "LESSON_DRAFT_CREATED" | "LESSON_UPDATED" | "LESSON_PARTICIPANTS_UPDATED"
  | "LESSON_ATTENDANCE_UPDATED" | "LESSON_COMPLETED" | "LESSON_CANCELLED"
  | "TUITION_ALLOCATION_RECALCULATED" | "TUITION_CYCLE_CREATED" | "TUITION_CYCLE_PAYMENT_DUE"
  | "TUITION_CYCLE_MARKED_PAID"
  | "ADMIN_PASSWORD_RESET"
  | "STUDENT_REPORT_EXPORTED"
  | "SCHEDULE_OCCURRENCE_SKIPPED" | "SCHEDULE_OCCURRENCE_RESCHEDULED"
  | "SCHEDULE_OCCURRENCE_TEMPORARILY_RESCHEDULED"
  | "TEACHER_BUSY_SLOT_CREATED" | "TEACHER_BUSY_SLOT_UPDATED" | "TEACHER_BUSY_SLOT_DELETED";

export interface AuditEntry {
  actorUserId?: number;
  action: AuditAction;
  entityType: "CLASS" | "STUDENT" | "ENROLLMENT" | "RECURRING_SCHEDULE" | "SCHEDULE_EXCEPTION" |
    "TEACHER_BUSY_SLOT" | "LESSON" | "TUITION_CYCLE" | "USER";
  entityId: number;
  previousValues?: unknown;
  newValues?: unknown;
  reason?: string;
}

export class AuditRepository {
  async record(connection: PoolConnection, entry: AuditEntry): Promise<void> {
    await connection.execute(
      `INSERT INTO audit_logs
        (actor_user_id,action,entity_type,entity_id,before_json,after_json,reason)
       VALUES (?,?,?,?,?,?,?)`,
      [
        entry.actorUserId ?? null,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.previousValues == null ? null : JSON.stringify(entry.previousValues),
        entry.newValues == null ? null : JSON.stringify(entry.newValues),
        entry.reason?.trim() || null,
      ],
    );
  }
}
