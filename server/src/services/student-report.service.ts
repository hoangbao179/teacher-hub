import type { StudentReportExportQuery } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { buildStudentWorkbook, safeStudentReportFilename } from "../domain/student-report";
import { StudentReportRepository } from "../repositories/student-report.repository";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export class StudentReportService {
  constructor(private readonly repository: StudentReportRepository) {}

  async export(studentId: number, query: StudentReportExportQuery, actorUserId: number) {
    if (!Number.isInteger(studentId) || studentId <= 0)
      throw new AppError(400, "VALIDATION_ERROR", "Mã học sinh không hợp lệ.");
    if (query.fromDate && !validDate(query.fromDate))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày bắt đầu không hợp lệ.");
    if (query.toDate && !validDate(query.toDate))
      throw new AppError(400, "VALIDATION_ERROR", "Ngày kết thúc không hợp lệ.");
    if (query.fromDate && query.toDate && query.fromDate > query.toDate)
      throw new AppError(400, "VALIDATION_ERROR", "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    if (query.classId != null && (!Number.isInteger(query.classId) || query.classId <= 0))
      throw new AppError(400, "VALIDATION_ERROR", "Mã lớp không hợp lệ.");

    const student = await this.repository.findStudent(studentId);
    if (!student) throw new AppError(404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh.");
    if (query.classId != null && !(await this.repository.studentHasClass(studentId, query.classId)))
      throw new AppError(400, "STUDENT_CLASS_MISMATCH", "Học sinh không có lịch sử ghi danh tại lớp đã chọn.");

    const [learningRows, tuitionRows] = await Promise.all([
      this.repository.learningRows(studentId, query),
      this.repository.tuitionRows(studentId, query),
    ]);
    if (learningRows.length > 5000 || tuitionRows.length > 5000)
      throw new AppError(413, "REPORT_TOO_LARGE", "Báo cáo vượt quá 5.000 dòng; vui lòng chọn khoảng ngày ngắn hơn.");

    const generatedAt = new Date().toISOString();
    const buffer = await buildStudentWorkbook({ student, learningRows, tuitionRows, query, generatedAt });
    await this.repository.recordExport(studentId, actorUserId, query);
    return {
      buffer,
      filename: safeStudentReportFilename(student.fullName, generatedAt.slice(0, 10)),
    };
  }
}

