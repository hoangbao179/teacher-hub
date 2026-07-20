import type {
  CompleteLessonRequest,
  CompleteLessonResult,
  CreateLessonRequest,
} from "@teacher/shared";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { LessonRepository } from "../repositories/lesson.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { durationMinutes } from "../utils/date";

export class LessonService {
  constructor(
    private readonly lessons: LessonRepository,
    private readonly tuition: TuitionRepository,
  ) {}
  create(input: CreateLessonRequest) {
    return this.lessons.create(input);
  }
  listByClass(classId: number) {
    return this.lessons.listByClass(classId);
  }

  async complete(
    lessonId: number,
    input: CompleteLessonRequest,
  ): Promise<CompleteLessonResult> {
    const duration = durationMinutes(
      input.actualStartTime,
      input.actualEndTime,
    );
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const lesson = await this.lessons.findForUpdate(connection, lessonId);
      if (!lesson)
        throw new AppError(404, "LESSON_NOT_FOUND", "Không tìm thấy buổi học.");
      if (lesson.status !== "DRAFT")
        throw new AppError(
          409,
          "LESSON_NOT_DRAFT",
          "Chỉ buổi nháp mới được hoàn thành.",
        );
      const contexts = await this.lessons.getActiveEnrollmentContexts(
        connection,
        Number(lesson.class_id),
      );
      const inputs = new Map(
        input.attendances.map((item) => [item.enrollmentId, item]),
      );
      const expectedIds = new Set(
        contexts.map((item) => Number(item.enrollment_id)),
      );
      for (const id of inputs.keys())
        if (!expectedIds.has(id))
          throw new AppError(
            400,
            "INVALID_ENROLLMENT",
            "Danh sách điểm danh chứa học sinh không thuộc lớp.",
          );
      if (contexts.some((item) => !inputs.has(Number(item.enrollment_id))))
        throw new AppError(
          400,
          "MISSING_ATTENDANCE",
          "Phải chọn trạng thái cho mọi học sinh đang học trong lớp.",
        );

      await this.lessons.complete(
        connection,
        lessonId,
        input.actualStartTime,
        input.actualEndTime,
        duration,
        input.content?.trim() || null,
        input.homework?.trim() || null,
        input.note?.trim() || null,
      );
      const newlyDueCycles: CompleteLessonResult["newlyDueCycles"] = [];
      for (const context of contexts) {
        const attendance = inputs.get(Number(context.enrollment_id))!;
        const billable =
          attendance.status === "PRESENT" && context.tuition_mode !== "FREE";
        const attendanceId = await this.lessons.insertAttendance(
          connection,
          lessonId,
          Number(context.enrollment_id),
          attendance.status,
          billable,
          attendance.studentNote?.trim() || null,
        );
        if (billable) {
          const cycle = await this.tuition.addBillableAttendance(
            connection,
            Number(context.enrollment_id),
            attendanceId,
            String(lesson.session_date).slice(0, 10),
            Number(context.effective_price),
          );
          if (cycle.becameDue)
            newlyDueCycles.push({
              cycleId: cycle.cycleId,
              studentId: Number(context.student_id),
              studentName: String(context.student_name),
            });
        }
      }
      await connection.commit();
      return {
        lessonId,
        completedAt: new Date().toISOString(),
        attendanceCount: contexts.length,
        newlyDueCycles,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
