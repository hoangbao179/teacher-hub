import type {
  AttendanceStatus,
  CancelLessonRequest,
  CompleteLessonRequest,
  CompleteLessonResult,
  CreateLessonRequest,
  LessonDetail,
  LessonType,
  TuitionProgressImpact,
  UpdateLessonAttendancesRequest,
  UpdateLessonContentRequest,
  UpdateLessonParticipantsRequest,
  UpdateLessonRequest,
} from "@teacher/shared";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { AuditRepository } from "../repositories/audit.repository";
import { LessonRepository, type LessonRow, type ParticipantRow } from "../repositories/lesson.repository";
import { TuitionPolicyRepository } from "../repositories/tuition-policy.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { durationMinutes } from "../utils/date";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export class LessonService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly tuition: TuitionRepository,
    private readonly policies = new TuitionPolicyRepository(),
    private readonly audit = new AuditRepository(),
  ) {}

  async create(input: CreateLessonRequest, actorUserId?: number): Promise<LessonDetail> {
    return (await this.createDraft(input, undefined, actorUserId)).lesson;
  }

  async createFromOccurrence(
    input: CreateLessonRequest,
    sourceOccurrenceKey: string,
    actorUserId?: number,
  ): Promise<{ lesson: LessonDetail; idempotent: boolean }> {
    if (!sourceOccurrenceKey || sourceOccurrenceKey.length > 160)
      throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã occurrence không hợp lệ.");
    return this.createDraft(input, sourceOccurrenceKey, actorUserId);
  }

  private async createDraft(
    input: CreateLessonRequest,
    sourceOccurrenceKey?: string,
    actorUserId?: number,
  ): Promise<{ lesson: LessonDetail; idempotent: boolean }> {
    this.validateCreate(input);
    const connection = await pool.getConnection();
    let lessonId = 0;
    let idempotent = false;
    try {
      await connection.beginTransaction();
      if (!(await this.lessons.classExistsForUpdate(connection, input.classId)))
        throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
      const existing = sourceOccurrenceKey
        ? await this.lessons.findByOccurrenceKeyForUpdate(connection, sourceOccurrenceKey)
        : null;
      if (existing) {
        lessonId = Number(existing.id);
        idempotent = true;
      } else {
        lessonId = await this.lessons.create(connection, input, sourceOccurrenceKey);
        const selected = this.selectedForType(input.lessonType, input.selectedEnrollmentIds);
        const snapshotted = await this.lessons.snapshotParticipants(
          connection, lessonId, input.classId, input.sessionDate, selected, actorUserId,
        );
        this.assertSnapshot(input.lessonType, selected, snapshotted);
        await this.audit.record(connection, {
          actorUserId, action: "LESSON_DRAFT_CREATED", entityType: "LESSON",
          entityId: lessonId, newValues: { ...input, sourceOccurrenceKey, participantEnrollmentIds: snapshotted },
        });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw this.mapDatabaseError(error);
    } finally {
      connection.release();
    }
    return { lesson: await this.detail(lessonId), idempotent };
  }

  async detail(id: number): Promise<LessonDetail> {
    this.validateId(id);
    const item = await this.lessons.findDetail(id);
    if (!item) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
    return item;
  }

  listByClass(classId: number) {
    this.validateId(classId);
    return this.lessons.listByClass(classId);
  }

  async update(id: number, input: UpdateLessonRequest, actorUserId?: number): Promise<LessonDetail> {
    this.validateId(id);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const lesson = await this.lessons.findForUpdate(connection, id);
      if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
      if (lesson.status === "COMPLETED") {
        if (input.classId != null || input.lessonType != null)
          throw new AppError(409, "LESSON_NOT_DRAFT", "Buổi hoàn thành không thể đổi lớp hoặc loại buổi.");
        if (await this.tuition.lessonTouchesPaidCycle(connection, id))
          throw new AppError(409, "PAID_CYCLE_CONFLICT", "Buổi học thuộc chu kỳ đã thu và không thể sửa.");
        const sessionDate = input.sessionDate ?? this.dateOnly(lesson.session_date);
        const scheduledStart = input.scheduledStartTime ?? String(lesson.scheduled_start);
        const scheduledEnd = input.scheduledEndTime ?? String(lesson.scheduled_end);
        const actualStart = input.actualStartTime ?? String(lesson.actual_start);
        const actualEnd = input.actualEndTime ?? String(lesson.actual_end);
        this.validateLessonInfo({ sessionDate, scheduledStartTime: scheduledStart, scheduledEndTime: scheduledEnd,
          actualStartTime: actualStart, actualEndTime: actualEnd, lessonType: lesson.lesson_type });
        await this.lessons.updateCompletedInfo(connection, id, sessionDate, scheduledStart, scheduledEnd,
          actualStart, actualEnd, this.actualDuration(actualStart, actualEnd), input.note === undefined ? lesson.note : input.note?.trim() || null);
        const enrollmentIds = (await this.lessons.participantRowsForUpdate(connection, id)).map((row) => Number(row.enrollment_id));
        for (const enrollmentId of enrollmentIds) await this.recalculateWithAudit(connection, enrollmentId, id, actorUserId);
        await this.audit.record(connection, { actorUserId, action: "LESSON_UPDATED", entityType: "LESSON",
          entityId: id, previousValues: lesson, newValues: input });
        await connection.commit();
        return await this.detail(id);
      }
      if (lesson.status !== "DRAFT")
        throw new AppError(409, "LESSON_NOT_DRAFT", "Chỉ buổi nháp hoặc completed mutable mới được chỉnh sửa.");
      const merged = {
        classId: input.classId ?? Number(lesson.class_id),
        sessionDate: input.sessionDate ?? this.dateOnly(lesson.session_date),
        scheduledStartTime: input.scheduledStartTime ?? String(lesson.scheduled_start),
        scheduledEndTime: input.scheduledEndTime ?? String(lesson.scheduled_end),
        actualStartTime: input.actualStartTime ?? (lesson.actual_start == null ? undefined : String(lesson.actual_start)),
        actualEndTime: input.actualEndTime ?? (lesson.actual_end == null ? undefined : String(lesson.actual_end)),
        lessonType: input.lessonType ?? lesson.lesson_type,
        note: input.note === undefined ? (lesson.note ?? undefined) : input.note,
      };
      this.validateLessonInfo(merged);
      if (!(await this.lessons.classExistsForUpdate(connection, merged.classId)))
        throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
      const participantBasisChanged = merged.classId !== Number(lesson.class_id) ||
        merged.sessionDate !== this.dateOnly(lesson.session_date) || merged.lessonType !== lesson.lesson_type;
      if (participantBasisChanged && !input.refreshParticipants)
        throw new AppError(409, "PARTICIPANT_REFRESH_REQUIRED", "Thay đổi lớp, ngày hoặc loại buổi cần làm mới danh sách học sinh rõ ràng.");
      await this.lessons.updateInfo(connection, id, merged);
      if (participantBasisChanged) {
        const existingIds = (await this.lessons.participantRowsForUpdate(connection, id)).map((row) => Number(row.enrollment_id));
        const selected = this.selectedForType(merged.lessonType, input.selectedEnrollmentIds ?? existingIds);
        const snapshotted = await this.lessons.replaceParticipants(
          connection, id, merged.classId, merged.sessionDate, selected, actorUserId,
        );
        this.assertSnapshot(merged.lessonType, selected, snapshotted);
        await this.audit.record(connection, {
          actorUserId, action: "LESSON_PARTICIPANTS_UPDATED", entityType: "LESSON",
          entityId: id, newValues: { enrollmentIds: snapshotted },
        });
      }
      await this.audit.record(connection, {
        actorUserId, action: "LESSON_UPDATED", entityType: "LESSON", entityId: id,
        previousValues: lesson, newValues: input,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw this.mapDatabaseError(error);
    } finally {
      connection.release();
    }
    return this.detail(id);
  }

  async updateParticipants(id: number, input: UpdateLessonParticipantsRequest, actorUserId?: number): Promise<LessonDetail> {
    this.validateId(id);
    this.assertUniqueIds(input.enrollmentIds, "DUPLICATE_PARTICIPANT");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const lesson = await this.lessons.findForUpdate(connection, id);
      if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
      if (!["DRAFT", "COMPLETED"].includes(lesson.status))
        throw new AppError(409, "LESSON_NOT_DRAFT", "Buổi đã hủy không thể đổi participant.");
      const previousParticipants = await this.lessons.participantRowsForUpdate(connection, id);
      const previousIds = previousParticipants.map((row) => Number(row.enrollment_id));
      if (lesson.status === "COMPLETED") {
        if (await this.tuition.lessonTouchesPaidCycle(connection, id))
          throw new AppError(409, "PAID_CYCLE_CONFLICT", "Participant thuộc chu kỳ đã thu và không thể sửa.");
        if (!input.attendances)
          throw new AppError(400, "MISSING_ATTENDANCE", "Sửa participant của buổi hoàn thành phải gửi lại đủ attendance.");
        await this.tuition.detachMutableLessonAttendances(connection, id);
      }
      const selected = this.selectedForType(lesson.lesson_type, input.enrollmentIds);
      const snapshotted = await this.lessons.replaceParticipants(
        connection, id, Number(lesson.class_id), this.dateOnly(lesson.session_date), selected, actorUserId,
      );
      this.assertSnapshot(lesson.lesson_type, selected, snapshotted);
      if (lesson.status === "COMPLETED") {
        const participants = await this.lessons.participantRowsForUpdate(connection, id);
        await this.saveAttendances(connection, lesson, participants, input.attendances!, true);
        for (const enrollmentId of new Set([...previousIds, ...snapshotted]))
          await this.recalculateWithAudit(connection, enrollmentId, id, actorUserId);
      }
      await this.audit.record(connection, {
        actorUserId, action: "LESSON_PARTICIPANTS_UPDATED", entityType: "LESSON",
        entityId: id, newValues: { enrollmentIds: snapshotted },
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw this.mapDatabaseError(error);
    } finally { connection.release(); }
    return this.detail(id);
  }

  async updateAttendances(id: number, input: UpdateLessonAttendancesRequest, actorUserId?: number): Promise<LessonDetail> {
    this.validateId(id);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const lesson = await this.lessons.findForUpdate(connection, id);
      if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
      if (!["DRAFT", "COMPLETED"].includes(lesson.status))
        throw new AppError(409, "LESSON_NOT_DRAFT", "Buổi đã hủy không thể sửa điểm danh.");
      const participants = await this.lessons.participantRowsForUpdate(connection, id);
      const affectedIds = input.attendances.map((item) => item.enrollmentId);
      if (lesson.status === "COMPLETED" && await this.tuition.attendanceTouchesPaidCycle(connection, id, affectedIds))
        throw new AppError(409, "PAID_CYCLE_CONFLICT", "Attendance thuộc chu kỳ đã thu và không thể sửa.");
      await this.saveAttendances(connection, lesson, participants, input.attendances, false);
      if (lesson.status === "COMPLETED")
        for (const enrollmentId of new Set(affectedIds))
          await this.recalculateWithAudit(connection, enrollmentId, id, actorUserId);
      await this.audit.record(connection, {
        actorUserId, action: "LESSON_ATTENDANCE_UPDATED", entityType: "LESSON",
        entityId: id, newValues: input,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw this.mapDatabaseError(error);
    } finally { connection.release(); }
    return this.detail(id);
  }

  async updateContent(id: number, input: UpdateLessonContentRequest, actorUserId?: number): Promise<LessonDetail> {
    this.validateId(id);
    this.validateTextLengths(input);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const lesson = await this.lessons.findForUpdate(connection, id);
      if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
      if (!["DRAFT", "COMPLETED"].includes(lesson.status))
        throw new AppError(409, "LESSON_NOT_DRAFT", "Buổi đã hủy không thể sửa nội dung.");
      await this.lessons.updateContent(connection, id,
        input.content?.trim() || null, input.homework?.trim() || null, input.note?.trim() || null);
      await this.audit.record(connection, {
        actorUserId, action: "LESSON_UPDATED", entityType: "LESSON", entityId: id, newValues: input,
      });
      await connection.commit();
    } catch (error) { await connection.rollback(); throw this.mapDatabaseError(error); }
    finally { connection.release(); }
    return this.detail(id);
  }

  async complete(lessonId: number, input: CompleteLessonRequest, actorUserId?: number): Promise<CompleteLessonResult> {
    this.validateId(lessonId);
    this.validateTextLengths(input);
    const duration = this.actualDuration(input.actualStartTime, input.actualEndTime);
    const connection = await pool.getConnection();
    const impacts: TuitionProgressImpact[] = [];
    let duplicate = false;
    try {
      await connection.beginTransaction();
      const lesson = await this.lessons.findForUpdate(connection, lessonId);
      if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
      if (lesson.status === "COMPLETED") {
        duplicate = true;
        await connection.commit();
      } else {
        if (lesson.status !== "DRAFT")
          throw new AppError(409, "LESSON_NOT_DRAFT", "Chỉ buổi nháp mới được hoàn thành.");
        const participants = await this.lessons.participantRowsForUpdate(connection, lessonId);
        if (!participants.length)
          throw new AppError(400, "INVALID_PARTICIPANT", "Buổi học phải có ít nhất một học sinh tham gia.");
        const saved = await this.saveAttendances(connection, lesson, participants, input.attendances, true);
        await this.lessons.markCompleted(
          connection, lessonId, input.actualStartTime, input.actualEndTime, duration,
          input.content?.trim() || lesson.content || null,
          input.homework?.trim() || lesson.homework || null,
          input.note?.trim() || lesson.note || null,
        );
        for (const enrollmentId of new Set(saved.map((item) => item.enrollmentId)))
          impacts.push(await this.recalculateWithAudit(connection, enrollmentId, lessonId, actorUserId));
        await this.audit.record(connection, {
          actorUserId, action: "LESSON_COMPLETED", entityType: "LESSON", entityId: lessonId,
          newValues: { duration, attendanceCount: saved.length },
        });
        await this.audit.record(connection, {
          actorUserId, action: "TUITION_ALLOCATION_RECALCULATED", entityType: "LESSON", entityId: lessonId,
          newValues: { mode: "M3_CHRONOLOGICAL", enrollmentIds: impacts.map((item) => item.enrollmentId) },
        });
        await connection.commit();
      }
    } catch (error) {
      await connection.rollback();
      throw this.mapDatabaseError(error);
    } finally { connection.release(); }
    const detail = await this.detail(lessonId);
    return this.completionResult(detail, duplicate ? [] : impacts);
  }

  async cancel(id: number, input: CancelLessonRequest = {}, actorUserId?: number): Promise<void> {
    this.validateId(id);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.requireDraft(connection, id);
      await this.lessons.cancel(connection, id);
      await this.audit.record(connection, {
        actorUserId, action: "LESSON_CANCELLED", entityType: "LESSON", entityId: id, reason: input.reason,
      });
      await connection.commit();
    } catch (error) { await connection.rollback(); throw this.mapDatabaseError(error); }
    finally { connection.release(); }
  }

  private async saveAttendances(
    connection: PoolConnection,
    lesson: LessonRow,
    participants: ParticipantRow[],
    inputs: CompleteLessonRequest["attendances"],
    requireAll: boolean,
  ) {
    if (!Array.isArray(inputs))
      throw new AppError(400, "MISSING_ATTENDANCE", "Danh sách điểm danh là bắt buộc.");
    const ids = inputs.map((item) => item.enrollmentId);
    this.assertUniqueIds(ids, "DUPLICATE_ATTENDANCE");
    const byEnrollment = new Map(participants.map((row) => [Number(row.enrollment_id), row]));
    for (const id of ids)
      if (!byEnrollment.has(id))
        throw new AppError(400, "INVALID_PARTICIPANT", "Điểm danh chứa học sinh ngoài participant snapshot.");
    if (requireAll && participants.some((row) => !ids.includes(Number(row.enrollment_id))))
      throw new AppError(400, "MISSING_ATTENDANCE", "Phải điểm danh đúng một trạng thái cho mọi học sinh tham gia.");
    const result: Array<{
      enrollmentId: number; studentId: number; studentName: string; attendanceId: number;
      policyMode: "CLASS_DEFAULT" | "CUSTOM" | "FREE"; packagePrice: number | null; billable: boolean;
    }> = [];
    for (const input of inputs) {
      this.validateAttendanceStatus(input.status);
      const participant = byEnrollment.get(input.enrollmentId)!;
      const policy = await this.policies.resolve(connection, input.enrollmentId, this.dateOnly(lesson.session_date), true);
      if (policy.mode === "FREE" && input.status === "PRESENT")
        throw new AppError(400, "FREE_ENROLLMENT_BILLABLE", "Học sinh miễn phí toàn phần phải dùng trạng thái Miễn phí hoặc Nghỉ.");
      const billable = input.status === "PRESENT" && policy.mode !== "FREE";
      const attendanceId = await this.lessons.upsertAttendance(
        connection, Number(lesson.id), Number(participant.participant_id), input.enrollmentId,
        input.status, billable, input.studentNote?.trim() || null,
      );
      result.push({
        enrollmentId: input.enrollmentId,
        studentId: Number(participant.student_id),
        studentName: String(participant.student_name),
        attendanceId, policyMode: policy.mode, packagePrice: policy.packagePrice, billable,
      });
    }
    return result;
  }

  private completionResult(detail: LessonDetail, impacts: TuitionProgressImpact[]): CompleteLessonResult {
    if (!detail.completedAt)
      throw new AppError(500, "LESSON_COMPLETION_TIMESTAMP_MISSING", "Buổi học đã hoàn thành nhưng thiếu thời điểm hoàn thành.");
    const presentCount = detail.participants.filter((item) => item.attendance?.status === "PRESENT").length;
    const absentCount = detail.participants.filter((item) => item.attendance?.status === "ABSENT").length;
    const freeCount = detail.participants.filter((item) => item.attendance?.status === "FREE").length;
    return {
      lessonId: detail.id,
      completedAt: detail.completedAt,
      attendanceCount: detail.participants.length,
      newlyDueCycles: impacts.filter((item) => item.becamePaymentDue && item.cycleId != null).map((item) => ({
        cycleId: item.cycleId!, studentId: item.studentId, studentName: item.studentName,
      })),
      lesson: detail,
      actualDurationMinutes: detail.actualDurationMinutes ?? 0,
      presentCount, absentCount, freeCount,
      tuitionImpacts: impacts,
      recalculationConflict: null,
    };
  }

  private async recalculateWithAudit(
    connection: PoolConnection,
    enrollmentId: number,
    lessonId: number,
    actorUserId?: number,
  ): Promise<TuitionProgressImpact> {
    const result = await this.tuition.recalculateEnrollment(connection, enrollmentId);
    for (const cycleId of result.createdCycleIds)
      await this.audit.record(connection, {
        actorUserId, action: "TUITION_CYCLE_CREATED", entityType: "TUITION_CYCLE",
        entityId: cycleId, newValues: { enrollmentId, sourceLessonId: lessonId },
      });
    for (const cycleId of result.paymentDueCycleIds)
      await this.audit.record(connection, {
        actorUserId, action: "TUITION_CYCLE_PAYMENT_DUE", entityType: "TUITION_CYCLE",
        entityId: cycleId, newValues: { enrollmentId, sourceLessonId: lessonId },
      });
    await this.audit.record(connection, {
      actorUserId, action: "TUITION_ALLOCATION_RECALCULATED", entityType: "LESSON",
      entityId: lessonId, newValues: { enrollmentId, createdCycleIds: result.createdCycleIds },
    });
    const dueCycleId = result.paymentDueCycleIds.at(-1) ?? null;
    return {
      enrollmentId,
      studentId: result.studentId,
      studentName: result.studentName,
      previousProgress: result.previousProgress,
      newProgress: result.newProgress,
      becamePaymentDue: dueCycleId != null,
      cycleId: dueCycleId ?? result.createdCycleIds.at(-1) ?? null,
    };
  }

  private async requireDraft(connection: PoolConnection, id: number): Promise<LessonRow> {
    const lesson = await this.lessons.findForUpdate(connection, id);
    if (!lesson) throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
    if (lesson.status !== "DRAFT")
      throw new AppError(409, "LESSON_NOT_DRAFT", "Chỉ buổi nháp mới được chỉnh sửa.");
    return lesson;
  }

  private validateCreate(input: CreateLessonRequest): void {
    this.validateId(input.classId);
    this.validateLessonInfo(input);
    this.assertUniqueIds(input.selectedEnrollmentIds ?? [], "DUPLICATE_PARTICIPANT");
    this.selectedForType(input.lessonType, input.selectedEnrollmentIds);
  }

  private validateLessonInfo(input: {
    sessionDate: string; scheduledStartTime: string; scheduledEndTime: string; lessonType: LessonType;
    actualStartTime?: string; actualEndTime?: string;
  }): void {
    if (!datePattern.test(input.sessionDate) || !timePattern.test(input.scheduledStartTime) ||
        !timePattern.test(input.scheduledEndTime) || input.scheduledEndTime <= input.scheduledStartTime ||
        !(["REGULAR", "MAKEUP", "EXTRA"] as LessonType[]).includes(input.lessonType))
      throw new AppError(400, "VALIDATION_ERROR", "Thông tin ngày, giờ hoặc loại buổi không hợp lệ.");
    if ((input.actualStartTime && !timePattern.test(input.actualStartTime)) ||
        (input.actualEndTime && !timePattern.test(input.actualEndTime)))
      throw new AppError(400, "INVALID_LESSON_TIME", "Giờ thực tế không hợp lệ.");
    if (input.actualStartTime && input.actualEndTime) this.actualDuration(input.actualStartTime, input.actualEndTime);
  }

  private actualDuration(start: string, end: string): number {
    if (!timePattern.test(start) || !timePattern.test(end))
      throw new AppError(400, "INVALID_LESSON_TIME", "Giờ thực tế không hợp lệ.");
    try { return durationMinutes(start, end); }
    catch { throw new AppError(400, "INVALID_LESSON_TIME", "Giờ kết thúc thực tế phải sau giờ bắt đầu và cùng ngày."); }
  }

  private selectedForType(type: LessonType, ids?: number[]): number[] | null {
    if (type === "REGULAR") return null;
    if (!ids?.length)
      throw new AppError(400, "INVALID_PARTICIPANT", `${type} cần chọn ít nhất một học sinh đủ điều kiện.`);
    return ids;
  }

  private assertSnapshot(type: LessonType, selected: number[] | null, snapshotted: number[]): void {
    if (type !== "REGULAR" && snapshotted.length !== selected?.length)
      throw new AppError(400, "PARTICIPANT_NOT_ELIGIBLE", "Có học sinh không thuộc lớp hoặc không đủ điều kiện vào ngày học.");
  }

  private assertUniqueIds(ids: number[], code: "DUPLICATE_PARTICIPANT" | "DUPLICATE_ATTENDANCE"): void {
    if (ids.some((id) => !Number.isInteger(id) || id < 1))
      throw new AppError(400, "INVALID_PARTICIPANT", "Mã ghi danh không hợp lệ.");
    if (new Set(ids).size !== ids.length)
      throw new AppError(400, code, "Danh sách học sinh bị trùng.");
  }

  private validateAttendanceStatus(status: AttendanceStatus): void {
    if (!(["PRESENT", "ABSENT", "FREE"] as AttendanceStatus[]).includes(status))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái điểm danh không hợp lệ.");
  }

  private validateTextLengths(input: { content?: string; homework?: string; note?: string }): void {
    if ((input.content?.length ?? 0) > 2000 || (input.homework?.length ?? 0) > 2000 || (input.note?.length ?? 0) > 1000)
      throw new AppError(400, "VALIDATION_ERROR", "Nội dung, bài tập hoặc ghi chú vượt giới hạn.");
  }

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }

  private dateOnly(value: Date | string): string {
    return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  }

  private mapDatabaseError(error: unknown): unknown {
    const code = (error as { code?: string }).code;
    if (code === "ER_DUP_ENTRY")
      return new AppError(409, "DUPLICATE_PARTICIPANT", "Participant hoặc attendance bị trùng.");
    if (code === "ER_NO_REFERENCED_ROW_2")
      return new AppError(400, "INVALID_PARTICIPANT", "Học sinh không thuộc participant snapshot.");
    return error;
  }
}
