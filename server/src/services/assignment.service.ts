import {
  answerFeedbackModes,
  assignmentActivitiesForTemplate,
  assignmentAudienceTypes,
  assignmentStatuses,
  assignmentTemplateCodes,
  gameMechanics,
  gamePresentations,
  learningAgeBands,
  type AssignmentDetail,
  type AssignmentListQuery,
  type AssignmentPreviewPayload,
  type AssignmentShare,
  type CreateAssignmentDraftRequest,
  type UpdateAssignmentDraftRequest,
} from "@teacher/shared";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { AppError } from "../errors/app-error";
import { AssignmentRepository } from "../repositories/assignment.repository";
import { PublicAssetMaterializer } from "./public-asset-materializer";

const imagePresentations = new Set([
  "LISTEN_PICK_IMAGE",
  "IMAGE_PICK_WORD",
  "MATCH_WORD_IMAGE",
  "MEMORY_WORD_IMAGE",
]);

export function assignmentToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: createHash("sha256").update(rawToken).digest("hex"),
  };
}

export function verifyAssignmentToken(rawToken: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = createHash("sha256").update(rawToken).digest();
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function assignmentPublicCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export class AssignmentService {
  constructor(
    private readonly repository: AssignmentRepository,
    private readonly publicOrigin: string,
    private readonly publicAssets: PublicAssetMaterializer,
  ) {}

  async list(raw: AssignmentListQuery, teacherUserId: number) {
    const page = this.integer(raw.page, 1, 1, 1000, "Trang");
    const pageSize = this.integer(raw.pageSize, 20, 1, 50, "Số bài mỗi trang");
    const search = this.text(raw.search, 0, 100, "Tìm kiếm") || undefined;
    if (raw.status && !assignmentStatuses.includes(raw.status))
      throw this.validation("Trạng thái bài không hợp lệ.");
    if (raw.audienceType && !assignmentAudienceTypes.includes(raw.audienceType))
      throw this.validation("Kiểu người nhận không hợp lệ.");
    if (raw.ageBand && !learningAgeBands.includes(raw.ageBand))
      throw new AppError(400, "INVALID_AGE_BAND", "Nhóm tuổi không hợp lệ.");
    return this.repository.list({
      page,
      pageSize,
      search,
      status: raw.status,
      audienceType: raw.audienceType,
      ageBand: raw.ageBand,
    }, teacherUserId);
  }

  async detail(id: number, teacherUserId: number): Promise<AssignmentDetail> {
    const assignment = await this.repository.detail(
      this.id(id),
      teacherUserId,
    );
    if (!assignment)
      throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Không tìm thấy bài từ vựng.");
    return assignment;
  }

  async create(raw: CreateAssignmentDraftRequest, teacherUserId: number) {
    const input = this.prepare(raw, true);
    input.items = await this.publicAssets.materializeItems(input.items, teacherUserId);
    const id = await this.repository.create(input, teacherUserId);
    return this.detail(id, teacherUserId);
  }

  async update(
    id: number,
    raw: UpdateAssignmentDraftRequest,
    teacherUserId: number,
  ) {
    const version = this.integer(raw.version, 0, 1, 2_147_483_647, "Phiên bản");
    const input = this.prepare(raw, true);
    input.items = await this.publicAssets.materializeItems(input.items, teacherUserId);
    await this.repository.update(this.id(id), input, version, teacherUserId);
    return this.detail(id, teacherUserId);
  }

  async preview(id: number, teacherUserId: number): Promise<AssignmentPreviewPayload> {
    const assignment = await this.detail(id, teacherUserId);
    const warnings = this.publishWarnings(assignment);
    return {
      banner: "XEM_TRUOC",
      assignment,
      estimatedMinutes: Math.max(
        3,
        Math.min(15, Math.ceil(assignment.items.length * assignment.activities.length / 5)),
      ),
      warnings,
    };
  }

  async publish(id: number, version: number, teacherUserId: number) {
    const assignment = await this.detail(id, teacherUserId);
    if (assignment.status !== "DRAFT")
      throw new AppError(
        409,
        "ASSIGNMENT_ALREADY_PUBLISHED",
        "Bài này không còn là bản nháp.",
      );
    const warnings = this.publishWarnings(assignment);
    if (warnings.length)
      throw new AppError(422, warnings[0].startsWith("Hoạt động cần hình")
        ? "ACTIVITY_REQUIRES_IMAGES"
        : "VALIDATION_ERROR", warnings[0], { warnings });
    const publicCode = assignmentPublicCode();
    const openToken = assignment.audienceType === "OPEN_LINK"
      ? assignmentToken()
      : undefined;
    const tokens = await this.repository.publish({
      id: this.id(id),
      teacherUserId,
      expectedVersion: this.integer(version, 0, 1, 2_147_483_647, "Phiên bản"),
      publicCode,
      openToken,
      createToken: (studentId) => ({ studentId, ...assignmentToken() }),
    });
    const published = await this.detail(id, teacherUserId);
    const shares: AssignmentShare[] = [];
    if (openToken)
      shares.push(await this.share(publicCode, openToken.rawToken));
    for (const token of tokens)
      shares.push(await this.share(publicCode, token.rawToken, {
        recipientId: token.recipientId,
        studentId: token.studentId,
        studentName: token.studentName,
      }));
    console.info(JSON.stringify({
      level: "info",
      event: "vocabulary_assignment_published",
      assignmentId: id,
      audienceType: published.audienceType,
      recipientCount: published.recipientCount,
      itemCount: published.itemCount,
    }));
    return { assignment: published, shares };
  }

  async duplicate(id: number, title: string | undefined, teacherUserId: number) {
    const source = await this.detail(id, teacherUserId);
    const input = this.prepare({
      title: this.text(title, 1, 160, "Tiêu đề") || `${source.title} — bản sao`,
      instruction: source.instruction ?? undefined,
      vocabularySetId: source.vocabularySetId ?? undefined,
      ageBand: source.ageBand,
      audienceType: source.audienceType ?? undefined,
      classId: source.classId ?? undefined,
      selectedStudentIds: source.selectedStudentIds,
      templateCode: source.templateCode,
      availableFrom: source.availableFrom ?? undefined,
      dueAt: undefined,
      maxAttempts: source.maxAttempts ?? undefined,
      passScore: source.passScore ?? undefined,
      answerFeedbackMode: source.answerFeedbackMode,
      shuffleQuestions: source.shuffleQuestions,
      items: source.items.map((item) => ({
        sourceVocabularyItemId: item.sourceVocabularyItemId,
        displayOrder: item.displayOrder,
        word: item.word,
        meaningVi: item.meaningVi,
        phonetic: item.phonetic,
        partOfSpeech: item.partOfSpeech,
        exampleEn: item.exampleEn,
        speechText: item.speechText,
        tier: item.tier,
        illustration: item.illustrationSnapshot,
        supportsImageGame: item.supportsImageGame,
      })),
      activities: source.activities.map(({ id: _id, ...activity }) => activity),
    }, true);
    const duplicateId = await this.repository.create(
      input,
      teacherUserId,
      "LEARNING_ASSIGNMENT_DUPLICATED",
    );
    return this.detail(duplicateId, teacherUserId);
  }

  async close(id: number, teacherUserId: number): Promise<void> {
    await this.repository.close(this.id(id), teacherUserId);
  }

  async changeDueDate(
    id: number,
    dueAt: string | null,
    teacherUserId: number,
  ) {
    const value = dueAt == null ? null : this.dateTime(dueAt, "Hạn hoàn thành");
    if (value && new Date(value).getTime() <= Date.now())
      throw new AppError(400, "INVALID_DUE_DATE", "Hạn mới phải ở tương lai.");
    await this.repository.changeDueDate(this.id(id), value, teacherUserId);
    return this.detail(id, teacherUserId);
  }

  recipients(id: number, teacherUserId: number) {
    return this.repository.recipients(this.id(id), teacherUserId);
  }

  async regenerateAccess(
    id: number,
    recipientId: number | undefined,
    teacherUserId: number,
  ) {
    const assignment = await this.detail(id, teacherUserId);
    if (!assignment.publicCode)
      throw new AppError(409, "ASSIGNMENT_NOT_EDITABLE", "Bài chưa được publish.");
    const token = assignmentToken();
    const recipient = await this.repository.rotateAccess({
      assignmentId: id,
      recipientId,
      teacherUserId,
      tokenHash: token.tokenHash,
    });
    return this.share(assignment.publicCode, token.rawToken, recipient);
  }

  revokeAccess(id: number, recipientId: number | undefined, teacherUserId: number) {
    return this.repository.revokeAccess(id, recipientId, teacherUserId);
  }

  private prepare(
    raw: CreateAssignmentDraftRequest,
    draft: boolean,
  ): CreateAssignmentDraftRequest {
    const title = this.text(raw.title, 1, 160, "Tiêu đề");
    const instruction = this.text(raw.instruction, 0, 1000, "Hướng dẫn") || undefined;
    if (!learningAgeBands.includes(raw.ageBand))
      throw new AppError(400, "INVALID_AGE_BAND", "Hãy xác nhận nhóm tuổi.");
    if (raw.audienceType && !assignmentAudienceTypes.includes(raw.audienceType))
      throw new AppError(400, "INVALID_ASSIGNMENT_AUDIENCE", "Người nhận không hợp lệ.");
    if (raw.audienceType === "CLASS" && (!Number.isInteger(raw.classId) || raw.classId! < 1))
      throw new AppError(400, "INVALID_ASSIGNMENT_AUDIENCE", "Hãy chọn lớp.");
    if (raw.audienceType === "SELECTED_STUDENTS" &&
        !draft && !(raw.selectedStudentIds?.length))
      throw new AppError(400, "INVALID_ASSIGNMENT_AUDIENCE", "Hãy chọn học sinh.");
    if (!assignmentTemplateCodes.includes(raw.templateCode))
      throw this.validation("Lộ trình không hợp lệ.");
    if (!answerFeedbackModes.includes(raw.answerFeedbackMode))
      throw this.validation("Chế độ phản hồi không hợp lệ.");
    if (!Array.isArray(raw.items) || raw.items.length > 40)
      throw this.validation("Bài có tối đa 40 từ.");
    if (!Array.isArray(raw.activities) || raw.activities.length > 8)
      throw this.validation("Bài có tối đa 8 hoạt động.");
    const items = raw.items.map((item, index) => {
      if (item.displayOrder !== index + 1)
        throw this.validation("Thứ tự từ phải liên tục từ 1.");
      const illustration = item.illustration;
      if (!illustration || !["NONE", "EMOJI", "PUBLIC_ASSET", "STORED_MEDIA"].includes(illustration.kind))
        throw this.validation("Hình minh họa không hợp lệ.");
      if (illustration.kind === "PUBLIC_ASSET" &&
          !/^\/learning\/[A-Za-z0-9_./-]+\.(svg|png|jpe?g|webp)$/i.test(illustration.value ?? ""))
        throw this.validation("Ảnh Unit không nằm trong allowlist.");
      if (illustration.kind === "STORED_MEDIA" &&
          (!Number.isInteger(illustration.mediaId) || illustration.mediaId! < 1))
        throw this.validation("Media đã lưu không hợp lệ.");
      return {
        ...item,
        word: this.text(item.word, 1, 100, "Từ"),
        meaningVi: this.text(item.meaningVi, 1, 200, "Nghĩa"),
        phonetic: this.text(item.phonetic, 0, 100, "Phiên âm") || undefined,
        partOfSpeech: this.text(item.partOfSpeech, 0, 50, "Loại từ") || undefined,
        exampleEn: this.text(item.exampleEn, 0, 500, "Ví dụ") || undefined,
        speechText: this.text(item.speechText || item.word, 1, 200, "Nội dung phát âm"),
      };
    });
    const activities = raw.activities.map((activity, index) => {
      if (activity.displayOrder !== index + 1 ||
          !gameMechanics.includes(activity.mechanic) ||
          !gamePresentations.includes(activity.presentation))
        throw this.validation("Cấu hình hoạt động không hợp lệ.");
      return { ...activity, config: activity.config ?? {} };
    });
    const selectedStudentIds = [...new Set(raw.selectedStudentIds ?? [])];
    if (selectedStudentIds.some((value) => !Number.isInteger(value) || value < 1))
      throw this.validation("Danh sách học sinh không hợp lệ.");
    const availableFrom = raw.availableFrom
      ? this.dateTime(raw.availableFrom, "Thời gian mở")
      : undefined;
    const dueAt = raw.dueAt ? this.dateTime(raw.dueAt, "Hạn hoàn thành") : undefined;
    if (availableFrom && dueAt &&
        new Date(dueAt).getTime() <= new Date(availableFrom).getTime())
      throw new AppError(400, "INVALID_DUE_DATE", "Hạn phải sau thời gian mở.");
    return {
      title,
      instruction,
      vocabularySetId: raw.vocabularySetId == null
        ? undefined
        : this.id(raw.vocabularySetId),
      ageBand: raw.ageBand,
      audienceType: raw.audienceType,
      classId: raw.audienceType === "CLASS" ? raw.classId : undefined,
      selectedStudentIds: raw.audienceType === "SELECTED_STUDENTS"
        ? selectedStudentIds
        : [],
      templateCode: raw.templateCode,
      availableFrom,
      dueAt,
      maxAttempts: raw.maxAttempts == null
        ? undefined
        : this.integer(raw.maxAttempts, 0, 1, 10, "Số lượt"),
      passScore: raw.passScore == null
        ? undefined
        : this.integer(raw.passScore, 0, 0, 100, "Điểm đạt"),
      answerFeedbackMode: raw.answerFeedbackMode,
      shuffleQuestions: Boolean(raw.shuffleQuestions),
      items,
      activities,
    };
  }

  private publishWarnings(assignment: AssignmentDetail): string[] {
    const warnings: string[] = [];
    if (!assignment.title.trim()) warnings.push("Bài chưa có tiêu đề.");
    if (!assignment.audienceType) warnings.push("Hãy chọn người nhận.");
    if (assignment.items.length < 2) warnings.push("Bài cần ít nhất 2 từ.");
    if (!assignment.activities.length) warnings.push("Bài cần ít nhất một hoạt động.");
    if (assignment.dueAt && new Date(assignment.dueAt).getTime() <= Date.now())
      warnings.push("Hạn hoàn thành phải ở tương lai.");
    const imageCount = assignment.items.filter((item) =>
      ["EMOJI", "STORED_MEDIA"].includes(item.illustrationSnapshot.kind)).length;
    if (assignment.activities.some((activity) =>
      imagePresentations.has(activity.presentation)) && imageCount < 2)
      warnings.push("Hoạt động cần hình nhưng chưa đủ 2 từ có hình.");
    if (assignment.templateCode !== "CUSTOM") {
      const template = assignmentActivitiesForTemplate(assignment.templateCode, {
        ageBand: assignment.ageBand,
        itemCount: assignment.items.length,
        imageItemCount: imageCount,
        exampleItemCount: assignment.items.filter((item) => item.exampleEn).length,
      });
      if (!assignment.activities.length && template.activities.length)
        warnings.push("Hãy áp dụng lộ trình đã chọn.");
    }
    return warnings;
  }

  private async share(
    publicCode: string,
    accessToken: string,
    recipient: Partial<AssignmentShare> = {},
  ): Promise<AssignmentShare> {
    const url = new URL(`/play/${publicCode}`, this.publicOrigin);
    url.searchParams.set("access", accessToken);
    const shareUrl = url.toString();
    const qrSvg = await QRCode.toString(shareUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
    });
    return { ...recipient, shareUrl, accessToken, qrSvg };
  }

  private text(
    value: unknown,
    min: number,
    max: number,
    label: string,
  ): string {
    const result = String(value ?? "").normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (result.length < min || result.length > max)
      throw this.validation(`${label} phải dài từ ${min} đến ${max} ký tự.`);
    return result;
  }

  private integer(
    value: number | undefined,
    fallback: number,
    min: number,
    max: number,
    label: string,
  ): number {
    const result = value ?? fallback;
    if (!Number.isInteger(result) || result < min || result > max)
      throw this.validation(`${label} không hợp lệ.`);
    return result;
  }

  private id(value: number): number {
    if (!Number.isInteger(value) || value < 1)
      throw this.validation("ID không hợp lệ.");
    return value;
  }

  private dateTime(value: string, label: string): string {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime()))
      throw new AppError(400, "INVALID_DUE_DATE", `${label} không hợp lệ.`);
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  private validation(message: string): AppError {
    return new AppError(400, "VALIDATION_ERROR", message);
  }
}
