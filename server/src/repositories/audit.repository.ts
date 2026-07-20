import type { PoolConnection } from "mysql2/promise";

export type AuditAction =
  | "CLASS_CREATED" | "CLASS_UPDATED" | "CLASS_PAUSED" | "CLASS_RESUMED" | "CLASS_CLOSED"
  | "STUDENT_CREATED" | "STUDENT_UPDATED"
  | "ENROLLMENT_CREATED" | "ENROLLMENT_PAUSED" | "ENROLLMENT_RESUMED" | "ENROLLMENT_ENDED"
  | "TUITION_MODE_CHANGED"
  | "RECURRING_SCHEDULE_CREATED" | "RECURRING_SCHEDULE_UPDATED" | "RECURRING_SCHEDULE_DELETED";

export interface AuditEntry {
  actorUserId?: number;
  action: AuditAction;
  entityType: "CLASS" | "STUDENT" | "ENROLLMENT" | "RECURRING_SCHEDULE";
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
