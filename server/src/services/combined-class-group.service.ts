import type {
  CombinedClassGroupMutationRequest,
  CombinedTeachingOccurrenceDetail,
  CompleteCombinedTeachingOccurrenceRequest,
  CompleteCombinedTeachingOccurrenceResult,
  EndCombinedClassGroupRequest,
  RescheduleOccurrenceRequest,
  SkipOccurrenceRequest,
  TuitionProgressImpact,
} from "@teacher/shared";
import { pool } from "../db/pool";
import {
  combinedOccurrenceKey,
  parseCombinedOccurrenceKey,
} from "../domain/combined-class-group-projection";
import { AppError } from "../errors/app-error";
import { CombinedClassGroupRepository } from "../repositories/combined-class-group.repository";
import { LessonService } from "./lesson.service";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CombinedClassGroupService {
  constructor(
    private readonly repository: CombinedClassGroupRepository,
    private readonly lessons: LessonService,
  ) {}

  list() {
    return this.repository.list();
  }

  async detail(id: number) {
    this.validateId(id);
    const item = await this.repository.find(id);
    if (!item)
      throw new AppError(404, "COMBINED_CLASS_GROUP_NOT_FOUND", "Không tìm thấy nhóm học ghép.");
    return item;
  }

  async create(input: CombinedClassGroupMutationRequest, actorUserId?: number) {
    this.validateMutation(input);
    const result = await this.repository.create(this.normalize(input), actorUserId);
    if (result.kind !== "OK") this.throwMutationError(result.kind);
    return this.detail(result.id);
  }

  async update(id: number, input: CombinedClassGroupMutationRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateMutation(input);
    const result = await this.repository.update(id, this.normalize(input), actorUserId);
    if (result.kind !== "OK") this.throwMutationError(result.kind);
    return this.detail(id);
  }

  async end(id: number, input: EndCombinedClassGroupRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateDate(input.effectiveTo, "Ngày kết thúc");
    if ((input.reason?.length ?? 0) > 255)
      throw new AppError(400, "VALIDATION_ERROR", "Lý do kết thúc tối đa 255 ký tự.");
    const result = await this.repository.end(id, {
      effectiveTo: input.effectiveTo,
      reason: input.reason?.trim() || undefined,
    }, actorUserId);
    if (result.kind !== "OK") this.throwMutationError(result.kind);
    return this.detail(id);
  }

  async createOccurrenceDraft(key: string, actorUserId?: number) {
    if (!parseCombinedOccurrenceKey(key))
      throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã ca học ghép không hợp lệ.");
    const connection = await pool.getConnection();
    let occurrenceId = 0;
    let idempotent = true;
    let primaryLessonId = 0;
    try {
      await connection.beginTransaction();
      const occurrence = await this.repository.ensureOccurrence(connection, key, actorUserId);
      occurrenceId = occurrence.occurrenceId;
      if (occurrence.status === "COMPLETED") {
        await connection.commit();
        return {
          occurrenceKey: key,
          occurrenceId,
          primaryLessonId: (await this.repository.childLessons(occurrenceId))[0]?.lessonId ?? 0,
          wizardPath: `/admin/combined-class-groups/occurrences/${occurrenceId}`,
          idempotent: true,
        };
      }
      for (const member of occurrence.memberClasses) {
        const child = await this.lessons.createDraftInTransaction(
          connection,
          {
            classId: member.id,
            sessionDate: occurrence.sessionDate,
            scheduledStartTime: occurrence.startTime,
            scheduledEndTime: occurrence.endTime,
            lessonType: "REGULAR",
          },
          `${key}:class:${member.id}`,
          actorUserId,
          occurrenceId,
        );
        if (!primaryLessonId) primaryLessonId = child.lessonId;
        idempotent = idempotent && child.idempotent;
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return {
      occurrenceKey: key,
      occurrenceId,
      primaryLessonId,
      wizardPath: `/admin/combined-class-groups/occurrences/${occurrenceId}`,
      idempotent,
    };
  }

  async occurrenceDetail(id: number): Promise<CombinedTeachingOccurrenceDetail> {
    this.validateId(id);
    const header = await this.repository.occurrenceHeader(id);
    if (!header)
      throw new AppError(404, "COMBINED_OCCURRENCE_NOT_FOUND", "Không tìm thấy ca học ghép.");
    const children = await this.repository.childLessons(id);
    const classes = await Promise.all(children.map(async (child) => ({
      classId: child.classId,
      className: child.className,
      lessonId: child.lessonId,
      participants: (await this.lessons.detail(child.lessonId)).participants,
    })));
    const replacement = header.status === "RESCHEDULED" && children.length > 0;
    return {
      id,
      key: combinedOccurrenceKey(
        Number(header.group_id),
        Number(header.group_schedule_id),
        String(header.occurrence_date),
        replacement,
      ),
      groupId: Number(header.group_id),
      groupName: String(header.group_name),
      date: replacement ? String(header.replacement_date) : String(header.occurrence_date),
      startTime: replacement ? String(header.replacement_start_time) : String(header.scheduled_start_time),
      endTime: replacement ? String(header.replacement_end_time) : String(header.scheduled_end_time),
      status: children.length && header.status !== "COMPLETED" ? "DRAFT" : header.status,
      classes,
    };
  }

  async completeOccurrence(
    id: number,
    input: CompleteCombinedTeachingOccurrenceRequest,
    actorUserId?: number,
  ): Promise<CompleteCombinedTeachingOccurrenceResult> {
    this.validateId(id);
    const enrollmentIds = input.attendances.map((item) => item.enrollmentId);
    if (new Set(enrollmentIds).size !== enrollmentIds.length)
      throw new AppError(400, "DUPLICATE_ATTENDANCE", "Danh sách điểm danh bị trùng học sinh.");
    const connection = await pool.getConnection();
    const results: Array<{
      lessonId: number;
      duplicate: boolean;
      impacts: TuitionProgressImpact[];
    }> = [];
    try {
      await connection.beginTransaction();
      const lessonIds = await this.repository.childLessonIdsForUpdate(connection, id);
      if (lessonIds.length < 2)
        throw new AppError(409, "COMBINED_OCCURRENCE_INCOMPLETE", "Ca học ghép chưa có đủ buổi con.");
      const participants = await this.repository.childLessonParticipantsForUpdate(connection, id);
      const expected = participants.map((item) => item.enrollmentId);
      if (expected.length !== enrollmentIds.length ||
          expected.some((enrollmentId) => !enrollmentIds.includes(enrollmentId)))
        throw new AppError(400, "MISSING_ATTENDANCE", "Phải điểm danh đúng một trạng thái cho mọi học sinh trong nhóm.");
      for (const lessonId of lessonIds) {
        const allowed = new Set(
          participants.filter((item) => item.lessonId === lessonId).map((item) => item.enrollmentId),
        );
        const result = await this.lessons.completeInTransaction(connection, lessonId, {
          ...input,
          attendances: input.attendances.filter((item) => allowed.has(item.enrollmentId)),
        }, actorUserId);
        results.push({ lessonId, ...result });
      }
      await this.repository.markOccurrenceCompleted(connection, id);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return {
      occurrenceId: id,
      lessons: await Promise.all(results.map((item) =>
        this.lessons.completedResult(item.lessonId, item.impacts, item.duplicate))),
    };
  }

  skipOccurrence(key: string, input: SkipOccurrenceRequest, actorUserId?: number) {
    this.validateReason(input.reason, input.note);
    return this.repository.writeOccurrenceAction(key, "SKIPPED", input, actorUserId);
  }

  rescheduleOccurrence(key: string, input: RescheduleOccurrenceRequest, actorUserId?: number) {
    this.validateReason(input.reason, input.note);
    this.validateDate(input.replacementDate, "Ngày học thay thế");
    this.validateTime(input.replacementStartTime, input.replacementEndTime);
    return this.repository.writeOccurrenceAction(key, "RESCHEDULED", input, actorUserId);
  }

  private normalize(input: CombinedClassGroupMutationRequest): CombinedClassGroupMutationRequest {
    return {
      name: input.name.trim(),
      classIds: [...input.classIds].sort((a, b) => a - b),
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo || undefined,
      schedules: input.schedules.map((item) => ({
        id: item.id,
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
      })),
    };
  }

  private validateMutation(input: CombinedClassGroupMutationRequest): void {
    if (!input?.name?.trim() || input.name.trim().length > 160)
      throw new AppError(400, "VALIDATION_ERROR", "Tên nhóm là bắt buộc và tối đa 160 ký tự.");
    if (!Array.isArray(input.classIds) || input.classIds.length < 2 ||
        new Set(input.classIds).size !== input.classIds.length)
      throw new AppError(400, "VALIDATION_ERROR", "Nhóm học ghép cần ít nhất hai lớp không trùng nhau.");
    input.classIds.forEach((id) => this.validateId(id));
    this.validateDate(input.effectiveFrom, "Ngày bắt đầu");
    if (input.effectiveTo) {
      this.validateDate(input.effectiveTo, "Ngày kết thúc");
      if (input.effectiveTo < input.effectiveFrom)
        throw new AppError(400, "VALIDATION_ERROR", "Ngày kết thúc không được trước ngày bắt đầu.");
    }
    if (!Array.isArray(input.schedules) || input.schedules.length < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Nhóm học ghép cần ít nhất một lịch hằng tuần.");
    const scheduleKeys = new Set<string>();
    for (const schedule of input.schedules) {
      if (!Number.isInteger(schedule.dayOfWeek) || schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7)
        throw new AppError(400, "VALIDATION_ERROR", "Thứ trong tuần không hợp lệ.");
      this.validateTime(schedule.startTime, schedule.endTime);
      const key = `${schedule.dayOfWeek}:${schedule.startTime}`;
      if (scheduleKeys.has(key))
        throw new AppError(400, "VALIDATION_ERROR", "Không thể có hai lịch nhóm cùng thứ và giờ bắt đầu.");
      scheduleKeys.add(key);
    }
  }

  private throwMutationError(kind: string): never {
    if (kind === "NOT_FOUND")
      throw new AppError(404, "COMBINED_CLASS_GROUP_NOT_FOUND", "Không tìm thấy nhóm học ghép.");
    if (kind === "CLASS_NOT_ACTIVE")
      throw new AppError(409, "COMBINED_GROUP_CLASS_NOT_ACTIVE", "Chỉ có thể chọn các lớp đang hoạt động.");
    if (kind === "MEMBERSHIP_CONFLICT")
      throw new AppError(409, "COMBINED_GROUP_MEMBERSHIP_CONFLICT", "Có lớp đang thuộc một nhóm học ghép khác trong thời gian này.");
    if (kind === "SCHEDULE_CONFLICT")
      throw new AppError(409, "COMBINED_GROUP_SCHEDULE_CONFLICT", "Lịch nhóm bị trùng với một nhóm học ghép khác.");
    if (kind === "HISTORY_CONFLICT")
      throw new AppError(409, "COMBINED_GROUP_HISTORY_CONFLICT", "Không thể thay đổi vì phạm vi bị ảnh hưởng đã có ca được xử lý.");
    throw new AppError(500, "COMBINED_GROUP_WRITE_FAILED", "Không thể lưu nhóm học ghép.");
  }

  private validateReason(reason: string, note?: string): void {
    if (!reason?.trim() || reason.trim().length > 255 || (note?.length ?? 0) > 2000)
      throw new AppError(400, "VALIDATION_ERROR", "Lý do là bắt buộc; ghi chú tối đa 2.000 ký tự.");
  }

  private validateTime(start: string, end: string): void {
    if (!timePattern.test(start) || !timePattern.test(end) || end <= start)
      throw new AppError(400, "VALIDATION_ERROR", "Giờ kết thúc phải sau giờ bắt đầu.");
  }

  private validateDate(value: string, label: string): void {
    const parsed = datePattern.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
      throw new AppError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  }

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }
}
