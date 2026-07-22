import type {
  BulkOccurrenceItemResult,
  BulkOccurrenceRequest,
  BulkSkipOccurrenceRequest,
  CreateOccurrenceDraftResult,
  CreateRecurringScheduleRequest,
  EndRecurringScheduleRequest,
  ReconciliationState,
  RescheduleOccurrenceRequest,
  ScheduleExceptionResult,
  ScheduleConflictCheckRequest,
  ScheduleOccurrenceQuery,
  SkipOccurrenceRequest,
  TeacherBusySlotInput,
  TeacherBusySlotMutationResult,
  TemporaryReschedulePreview,
  TemporaryRescheduleRequest,
  BulkTemporaryRescheduleRequest,
} from "@teacher/shared";
import { parseOccurrenceKey } from "../domain/schedule-projection";
import { AppError } from "../errors/app-error";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { addDays, todayInHoChiMinh, weekdayIso } from "../utils/date";
import { LessonService } from "./lesson.service";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const states = new Set<ReconciliationState>(["UNRECORDED", "RECORDED", "SKIPPED", "RESCHEDULED"]);

export class ScheduleService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly lessons: LessonService,
  ) {}

  async occurrences(input: ScheduleOccurrenceQuery) {
    const query = this.normalizeOccurrenceQuery(input);
    const items = await this.repository.listOccurrences(query.from, query.to, query.classId);
    return query.state ? items.filter((item) => item.state === query.state) : items;
  }

  async unrecorded(days = 14) {
    const to = todayInHoChiMinh();
    const from = addDays(to, -Math.max(1, Math.min(Number.isFinite(days) ? days : 14, 60)));
    return this.repository.listUnrecorded(from, to);
  }

  week(from?: string) {
    const start = from ?? todayInHoChiMinh();
    this.validateDate(start, "Ngày bắt đầu");
    return this.repository.week(start, addDays(start, 6));
  }

  async createDraft(key: string, actorUserId?: number): Promise<CreateOccurrenceDraftResult> {
    const occurrence = await this.requireOccurrence(key);
    if (occurrence.state === "RECORDED" && occurrence.linkedLessonId)
      return { occurrenceKey: key, lessonId: occurrence.linkedLessonId,
        wizardPath: `/admin/lessons/${occurrence.linkedLessonId}/edit`, idempotent: true, conflicts: occurrence.conflicts };
    if (occurrence.state !== "UNRECORDED")
      throw new AppError(409, "OCCURRENCE_ALREADY_RESOLVED", "Occurrence đã được nghỉ hoặc đổi lịch.");
    const conflicts = await this.repository.detectConflicts(
      occurrence.occurrenceDate, occurrence.scheduledStartTime, occurrence.scheduledEndTime, occurrence.originalKey,
    );
    const created = await this.lessons.createFromOccurrence({
      classId: occurrence.classId,
      sessionDate: occurrence.occurrenceDate,
      scheduledStartTime: occurrence.scheduledStartTime,
      scheduledEndTime: occurrence.scheduledEndTime,
      lessonType: "REGULAR",
    }, occurrence.key, actorUserId);
    return { occurrenceKey: key, lessonId: created.lesson.id,
      wizardPath: `/admin/lessons/${created.lesson.id}/edit`, idempotent: created.idempotent, conflicts };
  }

  makeupOptions(key: string) {
    return this.lessons.makeupOptions(key);
  }

  async checkConflicts(input: ScheduleConflictCheckRequest) {
    this.validateDate(input.date, "Ngày kiểm tra");
    this.validateTimeRange(input.startTime, input.endTime);
    if (input.excludedOccurrenceKey && !parseOccurrenceKey(input.excludedOccurrenceKey))
      throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã occurrence loại trừ không hợp lệ.");
    if (input.excludedLessonId != null) this.validateId(input.excludedLessonId);
    return this.repository.detectConflicts(
      input.date, input.startTime, input.endTime,
      input.excludedOccurrenceKey, input.excludedLessonId,
    );
  }

  async previewTemporary(input: TemporaryRescheduleRequest | BulkTemporaryRescheduleRequest): Promise<TemporaryReschedulePreview> {
    const bulk = this.normalizeTemporary(input);
    this.validateTemporary(bulk);
    const mappingBySchedule = new Map(bulk.mappings.map((mapping) => [mapping.recurringScheduleId, mapping]));
    const occurrences = (await this.repository.listOccurrences(bulk.fromDate, bulk.toDate, bulk.classId))
      .filter((item) => mappingBySchedule.has(item.recurringScheduleId) && item.projectionSource === "RECURRING");
    if (!occurrences.length)
      throw new AppError(404, "TEMPORARY_RESCHEDULE_EMPTY", "Không có occurrence nguồn trong khoảng đã chọn.");
    if (occurrences.length > 30)
      throw new AppError(400, "TEMPORARY_RESCHEDULE_LIMIT", "Chỉ được đổi tối đa 30 occurrence mỗi lần.");
    const items = await Promise.all(occurrences.map(async (occurrence) => {
      const mapping = mappingBySchedule.get(occurrence.recurringScheduleId)!;
      const replacementDate = addDays(
        occurrence.occurrenceDate,
        mapping.replacementDayOfWeek - weekdayIso(occurrence.occurrenceDate),
      );
      const conflicts = await this.repository.detectConflicts(
        replacementDate, mapping.replacementStartTime, mapping.replacementEndTime, occurrence.originalKey,
      );
      return {
        recurringScheduleId: occurrence.recurringScheduleId,
        originalOccurrenceKey: occurrence.originalKey,
        originalDate: occurrence.originalOccurrenceDate,
        originalStartTime: occurrence.scheduledStartTime,
        originalEndTime: occurrence.scheduledEndTime,
        replacementDate,
        replacementStartTime: mapping.replacementStartTime,
        replacementEndTime: mapping.replacementEndTime,
        currentState: occurrence.state,
        eligible: occurrence.state === "UNRECORDED",
        conflicts,
      };
    }));
    for (const item of items) for (const other of items) {
      if (item.originalOccurrenceKey === other.originalOccurrenceKey) continue;
      if (item.replacementDate === other.replacementDate && item.replacementStartTime < other.replacementEndTime &&
          other.replacementStartTime < item.replacementEndTime)
        item.conflicts.push({ kind: "PROJECTED_OCCURRENCE", id: null,
          occurrenceKey: other.originalOccurrenceKey, title: "Lịch thay thế trong cùng đợt",
          date: other.replacementDate, startTime: other.replacementStartTime, endTime: other.replacementEndTime });
    }
    return {
      items,
      canApply: items.every((item) => item.eligible),
      conflictCount: items.reduce((count, item) => count + item.conflicts.length, 0),
    };
  }

  async applyTemporary(input: TemporaryRescheduleRequest | BulkTemporaryRescheduleRequest, actorUserId?: number): Promise<TemporaryReschedulePreview> {
    const bulk = this.normalizeTemporary(input);
    const preview = await this.previewTemporary(bulk);
    if (!preview.canApply)
      throw new AppError(409, "TEMPORARY_RESCHEDULE_INELIGIBLE", "Có occurrence đã ghi nhận, nghỉ hoặc đổi lịch.");
    if (preview.conflictCount > 0 && !bulk.confirmConflicts)
      throw new AppError(409, "SCHEDULE_CONFLICT_CONFIRMATION_REQUIRED", "Cần xác nhận các cảnh báo trùng lịch trước khi áp dụng.");
    await this.repository.applyTemporaryReschedules(bulk, preview.items, actorUserId);
    return preview;
  }

  async skip(key: string, input: SkipOccurrenceRequest, actorUserId?: number): Promise<ScheduleExceptionResult> {
    this.validateReason(input.reason, input.note);
    const occurrence = await this.requireOccurrence(key);
    if (occurrence.state === "RECORDED")
      throw new AppError(409, "OCCURRENCE_RECORDED", "Occurrence đã có lesson và không thể đánh dấu nghỉ.");
    const result = await this.repository.createException(key, "SKIPPED", input, actorUserId);
    return { occurrenceKey: key, exceptionId: result.id, type: "SKIPPED", idempotent: result.idempotent, conflicts: [] };
  }

  async reschedule(key: string, input: RescheduleOccurrenceRequest, actorUserId?: number): Promise<ScheduleExceptionResult> {
    this.validateReason(input.reason, input.note);
    this.validateDate(input.replacementDate, "Ngày thay thế");
    this.validateTimeRange(input.replacementStartTime, input.replacementEndTime);
    const occurrence = await this.requireOriginalOccurrence(key);
    if (occurrence.state === "RECORDED")
      throw new AppError(409, "OCCURRENCE_RECORDED", "Occurrence đã có lesson và không thể đổi lịch.");
    const conflicts = await this.repository.detectConflicts(
      input.replacementDate, input.replacementStartTime, input.replacementEndTime, occurrence.originalKey,
    );
    const result = await this.repository.createException(key, "RESCHEDULED", input, actorUserId);
    return { occurrenceKey: key, exceptionId: result.id, type: "RESCHEDULED", idempotent: result.idempotent, conflicts };
  }

  async bulkCreateDrafts(input: BulkOccurrenceRequest, actorUserId?: number): Promise<BulkOccurrenceItemResult[]> {
    const keys = this.validateKeys(input.keys);
    const results: BulkOccurrenceItemResult[] = [];
    for (const key of keys) {
      try {
        const result = await this.createDraft(key, actorUserId);
        results.push({ key, success: true, lessonId: result.lessonId, wizardPath: result.wizardPath, idempotent: result.idempotent, conflicts: result.conflicts });
      } catch (error) { results.push(this.bulkError(key, error)); }
    }
    return results;
  }

  async bulkSkip(input: BulkSkipOccurrenceRequest, actorUserId?: number): Promise<BulkOccurrenceItemResult[]> {
    this.validateReason(input.reason, input.note);
    const keys = this.validateKeys(input.keys);
    const results: BulkOccurrenceItemResult[] = [];
    for (const key of keys) {
      try {
        const result = await this.skip(key, { reason: input.reason, note: input.note, makeupRequired: input.makeupRequired }, actorUserId);
        results.push({ key, success: true, exceptionId: result.exceptionId, idempotent: result.idempotent });
      } catch (error) { results.push(this.bulkError(key, error)); }
    }
    return results;
  }

  async listBusySlots(from?: string, to?: string) {
    if (!from && !to) return this.repository.listAllBusySlots();
    const start = from ?? todayInHoChiMinh();
    const end = to ?? addDays(start, 60);
    this.validateDateRange(start, end, 730);
    return this.repository.listBusySlots(start, end);
  }

  outstandingMakeups() {
    return this.repository.listOutstandingMakeups();
  }

  async getBusySlot(id: number) {
    this.validateId(id);
    const slot = await this.repository.findBusySlot(id);
    if (!slot) throw new AppError(404, "BUSY_SLOT_NOT_FOUND", "Không tìm thấy lịch bận.");
    return slot;
  }

  async createBusySlot(input: TeacherBusySlotInput, actorUserId?: number): Promise<TeacherBusySlotMutationResult> {
    this.validateBusySlot(input);
    const conflicts = await this.busyConflicts(input);
    const id = await this.repository.createBusySlot(input, actorUserId);
    const slot = await this.repository.findBusySlot(id);
    return { slot: { ...slot!, conflicts }, conflicts };
  }

  async updateBusySlot(id: number, input: TeacherBusySlotInput, actorUserId?: number): Promise<TeacherBusySlotMutationResult> {
    this.validateId(id);
    this.validateBusySlot(input);
    const conflicts = (await this.busyConflicts(input)).filter((warning) => warning.kind !== "BUSY_SLOT" || warning.id !== id);
    if (!(await this.repository.updateBusySlot(id, input, actorUserId)))
      throw new AppError(404, "BUSY_SLOT_NOT_FOUND", "Không tìm thấy lịch bận.");
    const slot = await this.repository.findBusySlot(id);
    return { slot: { ...slot!, conflicts }, conflicts };
  }

  async deleteBusySlot(id: number, actorUserId?: number): Promise<void> {
    this.validateId(id);
    if (!(await this.repository.deleteBusySlot(id, actorUserId)))
      throw new AppError(404, "BUSY_SLOT_NOT_FOUND", "Không tìm thấy lịch bận.");
  }

  async create(classId: number, input: CreateRecurringScheduleRequest, actorUserId?: number) {
    this.validateRecurring(input);
    const result = await this.repository.create(classId, input, actorUserId);
    if (result === "CLASS_NOT_FOUND") throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp.");
    if (result === "CLASS_CLOSED") throw new AppError(409, "CLASS_CLOSED", "Không thể thêm lịch cho lớp đã đóng.");
    return result;
  }

  async update(id: number, input: CreateRecurringScheduleRequest, actorUserId?: number) {
    this.validateRecurring(input);
    const result = await this.repository.update(id, input, actorUserId);
    if (result === "NOT_FOUND") throw new AppError(404, "SCHEDULE_NOT_FOUND", "Không tìm thấy lịch lặp.");
    if (result === "INVALID_EFFECTIVE_DATE") throw new AppError(409, "INVALID_SCHEDULE_EFFECTIVE_DATE", "Ngày hiệu lực version mới phải sau ngày bắt đầu version hiện tại.");
  }

  async remove(id: number, input: EndRecurringScheduleRequest, actorUserId?: number) {
    this.validateId(id);
    this.validateDate(input.effectiveDate, "Ngày kết thúc lịch");
    const result = await this.repository.remove(id, input, actorUserId);
    if (result === "NOT_FOUND") throw new AppError(404, "SCHEDULE_NOT_FOUND", "Không tìm thấy lịch lặp.");
    if (result === "INVALID_EFFECTIVE_DATE") throw new AppError(409, "INVALID_SCHEDULE_EFFECTIVE_DATE", "Ngày kết thúc phải sau ngày bắt đầu version hiện tại.");
  }

  private normalizeOccurrenceQuery(input: ScheduleOccurrenceQuery): ScheduleOccurrenceQuery {
    this.validateDateRange(input.from, input.to, 120);
    if (input.classId != null) this.validateId(input.classId);
    if (input.state && !states.has(input.state))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái đối soát không hợp lệ.");
    if (input.lookbackDays != null && (!Number.isInteger(input.lookbackDays) || input.lookbackDays < 1 || input.lookbackDays > 60))
      throw new AppError(400, "VALIDATION_ERROR", "Lookback phải là số nguyên từ 1 đến 60 ngày.");
    const lookbackDays = input.lookbackDays ?? 14;
    const minimum = addDays(todayInHoChiMinh(), -lookbackDays);
    return { ...input, from: input.from < minimum ? minimum : input.from, lookbackDays };
  }

  private async requireOccurrence(key: string) {
    if (!parseOccurrenceKey(key)) throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã occurrence không hợp lệ.");
    const occurrence = await this.repository.resolveOccurrence(key);
    if (!occurrence) throw new AppError(404, "OCCURRENCE_NOT_FOUND", "Không tìm thấy occurrence dự kiến.");
    return occurrence;
  }

  private async requireOriginalOccurrence(key: string) {
    const parsed = parseOccurrenceKey(key);
    if (!parsed || parsed.replacement) throw new AppError(400, "INVALID_OCCURRENCE_KEY", "Mã occurrence gốc không hợp lệ.");
    return this.requireOccurrence(key);
  }

  private validateKeys(keys: string[]): string[] {
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 50 || new Set(keys).size !== keys.length || keys.some((key) => !parseOccurrenceKey(key)))
      throw new AppError(400, "VALIDATION_ERROR", "Danh sách occurrence phải có 1–50 khóa hợp lệ và không trùng.");
    return keys;
  }

  private bulkError(key: string, error: unknown): BulkOccurrenceItemResult {
    return error instanceof AppError
      ? { key, success: false, error: { code: error.code, message: error.message } }
      : { key, success: false, error: { code: "INTERNAL_ERROR", message: "Không thể xử lý occurrence." } };
  }

  private validateRecurring(input: CreateRecurringScheduleRequest) {
    if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 1 || input.dayOfWeek > 7)
      throw new AppError(400, "VALIDATION_ERROR", "Thứ trong tuần không hợp lệ.");
    this.validateTimeRange(input.startTime, input.endTime);
    this.validateDate(input.effectiveFrom, "Ngày hiệu lực");
    if (input.effectiveTo) {
      this.validateDate(input.effectiveTo, "Ngày kết thúc");
      if (input.effectiveTo < input.effectiveFrom) throw new AppError(400, "VALIDATION_ERROR", "Khoảng hiệu lực không hợp lệ.");
    }
  }

  private validateBusySlot(input: TeacherBusySlotInput): void {
    const raw = input as TeacherBusySlotInput & Record<string, unknown>;
    if (!(["EXTERNAL_CLASS", "PERSONAL", "OTHER"] as const).includes(input.slotType))
      throw new AppError(400, "VALIDATION_ERROR", "Loại lịch không hợp lệ.");
    if (input.slotType === "EXTERNAL_CLASS") {
      if (!input.organizationType || !(["SCHOOL", "CENTER"] as const).includes(input.organizationType))
        throw new AppError(400, "VALIDATION_ERROR", "Lịch dạy ngoài cần chọn trường hoặc trung tâm.");
      if (!input.organizationName?.trim() || input.organizationName.trim().length > 160)
        throw new AppError(400, "VALIDATION_ERROR", "Tên đơn vị là bắt buộc và tối đa 160 ký tự.");
    } else if (input.organizationType != null || input.organizationName != null) {
      throw new AppError(400, "VALIDATION_ERROR", "Chỉ lịch dạy ngoài mới có thông tin đơn vị.");
    }
    if (!input.title?.trim() || input.title.trim().length > 160)
      throw new AppError(400, "VALIDATION_ERROR", "Tiêu đề lịch bận là bắt buộc và tối đa 160 ký tự.");
    if (input.recurrenceType === "ONCE") {
      if (!input.specificDate || raw.dayOfWeek != null || raw.schedules != null || raw.effectiveFrom != null || raw.effectiveTo != null)
        throw new AppError(400, "VALIDATION_ERROR", "Lịch bận một lần cần ngày cụ thể và không có hiệu lực tuần.");
      this.validateDate(input.specificDate, "Ngày lịch bận");
      this.validateTimeRange(input.startTime, input.endTime);
    } else if (input.recurrenceType === "WEEKLY") {
      if (raw.dayOfWeek != null || raw.startTime != null || raw.endTime != null || raw.specificDate != null || !input.effectiveFrom || !Array.isArray(input.schedules) || !input.schedules.length)
        throw new AppError(400, "VALIDATION_ERROR", "Lịch bận tuần cần ít nhất một buổi và ngày bắt đầu hiệu lực.");
      this.validateDate(input.effectiveFrom, "Ngày hiệu lực");
      if (input.effectiveTo) {
        this.validateDate(input.effectiveTo, "Ngày kết thúc");
        if (input.effectiveTo < input.effectiveFrom) throw new AppError(400, "VALIDATION_ERROR", "Khoảng hiệu lực không hợp lệ.");
      }
      const starts = new Set<string>();
      for (const schedule of input.schedules) {
        if (!Number.isInteger(schedule.dayOfWeek) || schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7)
          throw new AppError(400, "VALIDATION_ERROR", "Thứ trong tuần không hợp lệ.");
        this.validateTimeRange(schedule.startTime, schedule.endTime);
        const key = `${schedule.dayOfWeek}:${schedule.startTime}`;
        if (starts.has(key)) throw new AppError(400, "VALIDATION_ERROR", "Không thể có hai buổi cùng thứ và giờ bắt đầu.");
        starts.add(key);
      }
    } else throw new AppError(400, "VALIDATION_ERROR", "Kiểu lịch bận không hợp lệ.");
    if ((input.location?.length ?? 0) > 255 || (input.note?.length ?? 0) > 2000)
      throw new AppError(400, "VALIDATION_ERROR", "Địa điểm hoặc ghi chú quá dài.");
  }

  private async busyConflicts(input: TeacherBusySlotInput) {
    const ranges: Array<{ date: string; startTime: string; endTime: string }> = [];
    if (input.recurrenceType === "ONCE") ranges.push({ date: input.specificDate, startTime: input.startTime, endTime: input.endTime });
    else {
      const end = input.effectiveTo && input.effectiveTo < addDays(input.effectiveFrom!, 60)
        ? input.effectiveTo : addDays(input.effectiveFrom!, 60);
      for (let date = input.effectiveFrom!; date <= end; date = addDays(date, 1))
        for (const schedule of input.schedules)
          if (weekdayIso(date) === schedule.dayOfWeek) ranges.push({ date, startTime: schedule.startTime, endTime: schedule.endTime });
    }
    const warnings = (await Promise.all(ranges.map((range) => this.repository.detectConflicts(range.date, range.startTime, range.endTime)))).flat();
    return [...new Map(warnings.map((item) => [`${item.kind}:${item.id ?? item.occurrenceKey}:${item.date}:${item.startTime}`, item])).values()];
  }

  private validateReason(reason: string, note?: string): void {
    if (!reason?.trim() || reason.trim().length > 255 || (note?.length ?? 0) > 2000)
      throw new AppError(400, "VALIDATION_ERROR", "Lý do là bắt buộc (tối đa 255 ký tự) và ghi chú tối đa 2000 ký tự.");
  }

  private normalizeTemporary(input: TemporaryRescheduleRequest | BulkTemporaryRescheduleRequest): BulkTemporaryRescheduleRequest {
    if ("mappings" in input) return input;
    return { classId: input.classId, fromDate: input.fromDate, toDate: input.toDate,
      mappings: [{ recurringScheduleId: input.recurringScheduleId,
        replacementDayOfWeek: input.replacementDayOfWeek,
        replacementStartTime: input.replacementStartTime, replacementEndTime: input.replacementEndTime }],
      reason: input.reason, note: input.note, confirmConflicts: input.confirmConflicts };
  }

  private validateTemporary(input: BulkTemporaryRescheduleRequest): void {
    this.validateId(input.classId);
    this.validateDateRange(input.fromDate, input.toDate, 45);
    if (!Array.isArray(input.mappings) || input.mappings.length < 1 || input.mappings.length > 7 ||
        new Set(input.mappings.map((item) => item.recurringScheduleId)).size !== input.mappings.length)
      throw new AppError(400, "VALIDATION_ERROR", "Cần chọn 1–7 lịch tuần không trùng nhau.");
    for (const mapping of input.mappings) {
      this.validateId(mapping.recurringScheduleId);
      if (!Number.isInteger(mapping.replacementDayOfWeek) || mapping.replacementDayOfWeek < 1 || mapping.replacementDayOfWeek > 7)
        throw new AppError(400, "VALIDATION_ERROR", "Thứ thay thế không hợp lệ.");
      this.validateTimeRange(mapping.replacementStartTime, mapping.replacementEndTime);
    }
    this.validateReason(input.reason, input.note);
  }

  private validateTimeRange(start: string, end: string): void {
    if (!timePattern.test(start) || !timePattern.test(end) || end <= start)
      throw new AppError(400, "VALIDATION_ERROR", "Khoảng giờ không hợp lệ.");
  }

  private validateDateRange(from: string, to: string, maxDays: number): void {
    this.validateDate(from, "Ngày bắt đầu"); this.validateDate(to, "Ngày kết thúc");
    if (to < from || to > addDays(from, maxDays))
      throw new AppError(400, "VALIDATION_ERROR", `Khoảng ngày phải tăng dần và tối đa ${maxDays} ngày.`);
  }

  private validateDate(value: string, label: string): void {
    const parsed = datePattern.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
      throw new AppError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  }

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 1) throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }
}
