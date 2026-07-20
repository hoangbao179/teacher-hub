import type {
  CreateStudentRequest,
  UpdateStudentRequest,
} from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { StudentRepository } from "../repositories/student.repository";

export class StudentService {
  constructor(private readonly repository: StudentRepository) {}
  list() {
    return this.repository.list();
  }
  async detail(id: number) {
    const item = await this.repository.findDetail(id);
    if (!item)
      throw new AppError(404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh.");
    return item;
  }
  async create(input: CreateStudentRequest, actorUserId?: number) {
    if (!input.fullName?.trim())
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Họ tên học sinh là bắt buộc.",
      );
    return this.repository.create({
      ...input,
      fullName: input.fullName.trim(),
    }, actorUserId);
  }
  async update(id: number, input: UpdateStudentRequest, actorUserId?: number) {
    if (!input.fullName?.trim())
      throw new AppError(400, "VALIDATION_ERROR", "Họ tên học sinh là bắt buộc.");
    if (!(input.status === "ACTIVE" || input.status === "INACTIVE"))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái học sinh không hợp lệ.");
    if (!(await this.repository.update(id, { ...input, fullName: input.fullName.trim() }, actorUserId)))
      throw new AppError(404, "STUDENT_NOT_FOUND", "Không tìm thấy học sinh.");
  }
}
