import type {
  AssignmentResultListQuery,
  CreateAssignmentDraftRequest,
  CreateVocabularyReviewDraftRequest,
} from "@teacher/shared";
import { assignmentActivitiesForTemplate } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { AssignmentRepository } from "../repositories/assignment.repository";
import { VocabularyResultsRepository } from "../repositories/vocabulary-results.repository";

function id(value: unknown, label = "ID"): number {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1)
    throw new AppError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  return result;
}

export class VocabularyResultsService {
  constructor(
    private readonly results: VocabularyResultsRepository,
    private readonly assignments: AssignmentRepository,
  ) {}

  private query(raw: AssignmentResultListQuery) {
    const page = raw.page ?? 1;
    const pageSize = raw.pageSize ?? 20;
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize)
      || pageSize < 1 || pageSize > 50)
      throw new AppError(400, "VALIDATION_ERROR", "Phân trang không hợp lệ.");
    const sort = raw.sort ?? "NAME";
    const direction = raw.direction ?? "ASC";
    if (!["NAME", "LAST_ACTIVITY", "COMPLETED_AT", "LATEST_SCORE", "FIRST_TRY", "MASTERY"].includes(sort)
      || !["ASC", "DESC"].includes(direction))
      throw new AppError(400, "VALIDATION_ERROR", "Sắp xếp không hợp lệ.");
    if (raw.status && !["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(raw.status))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái người nhận không hợp lệ.");
    if (raw.mastery && !["MASTERED", "LEARNING", "NEEDS_REVIEW", "NOT_SEEN"].includes(raw.mastery))
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái mastery không hợp lệ.");
    if (raw.search && raw.search.length > 160)
      throw new AppError(400, "VALIDATION_ERROR", "Từ khóa tìm kiếm quá dài.");
    return { ...raw, page, pageSize, sort, direction };
  }

  async summary(assignmentId: number, teacherUserId: number) {
    const assignment = await this.results.owner(id(assignmentId), teacherUserId);
    const [recipients, words, guest, attemptSummary] = await Promise.all([
      this.results.recipientRows(assignmentId),
      this.results.vocabularyRows(assignmentId),
      this.results.guestSummary(assignmentId),
      this.results.authoritativeAttemptSummary(assignmentId, assignment.pass_score),
    ]);
    const assigned = recipients.length;
    const completed = recipients.filter((row) => row.status === "COMPLETED").length;
    return {
      assignmentId,
      assignmentStatus: assignment.status,
      audienceType: assignment.audience_type!,
      assigned,
      notStarted: recipients.filter((row) => row.status === "NOT_STARTED").length,
      inProgress: recipients.filter((row) => row.status === "IN_PROGRESS").length,
      completed,
      completionPercent: assigned ? Math.round(completed * 100 / assigned) : 0,
      masteredWords: words.filter((row) => row.mastery === "MASTERED").length,
      needsReviewWords: words.filter((row) => row.mastery === "NEEDS_REVIEW").length,
      ...attemptSummary,
      guest,
    };
  }

  async recipientsList(
    assignmentId: number,
    raw: AssignmentResultListQuery,
    teacherUserId: number,
  ) {
    await this.results.owner(id(assignmentId), teacherUserId);
    return this.results.recipientPage(assignmentId, this.query(raw));
  }

  async vocabularyList(
    assignmentId: number,
    raw: AssignmentResultListQuery,
    teacherUserId: number,
  ) {
    await this.results.owner(id(assignmentId), teacherUserId);
    return this.results.paginateVocabulary(
      await this.results.vocabularyRows(assignmentId),
      this.query(raw),
    );
  }

  async recipientDetail(assignmentId: number, recipientId: number, teacherUserId: number) {
    await this.results.owner(id(assignmentId), teacherUserId);
    const recipient = (await this.results.recipientRows(assignmentId))
      .find((row) => row.recipientId === id(recipientId, "Người nhận"));
    if (!recipient)
      throw new AppError(404, "ASSIGNMENT_RECIPIENT_NOT_FOUND", "Không tìm thấy người nhận.");
    return {
      ...recipient,
      ...(await Promise.all([
        this.results.recipientVocabularyRows(assignmentId, recipientId),
        this.results.recipientAttempts(assignmentId, recipientId),
        this.results.recipientActivities(assignmentId, recipientId),
      ]).then(([words, attempts, activities]) => ({ words, attempts, activities }))),
    };
  }

  async createReviewDraft(
    assignmentId: number,
    raw: CreateVocabularyReviewDraftRequest,
    teacherUserId: number,
  ) {
    await this.results.owner(id(assignmentId), teacherUserId);
    const source = await this.assignments.detail(assignmentId, teacherUserId);
    if (!source || source.status === "DRAFT")
      throw new AppError(409, "ASSIGNMENT_NOT_PUBLISHED", "Bài nguồn chưa có kết quả.");
    if (source.audienceType === "OPEN_LINK")
      throw new AppError(
        409,
        "OPEN_LINK_RESULTS_NOT_AUTHORITATIVE",
        "Kết quả khách không dùng để tự tạo bài giao cho học sinh.",
      );
    const itemIds = [...new Set((raw.assignmentItemIds ?? []).map((value) => id(value, "Từ")))];
    const recipientIds = [...new Set((raw.recipientIds ?? []).map((value) => id(value, "Người nhận")))];
    if (!itemIds.length || itemIds.length > 40 || !recipientIds.length)
      throw new AppError(400, "VALIDATION_ERROR", "Hãy chọn từ cần ôn và người nhận.");
    const items = source.items.filter((item) => itemIds.includes(item.id));
    if (items.length !== itemIds.length)
      throw new AppError(400, "VALIDATION_ERROR", "Từ đã chọn không thuộc bài nguồn.");
    const recipients = (await this.assignments.recipients(assignmentId, teacherUserId))
      .filter((recipient) => recipientIds.includes(recipient.id));
    if (recipients.length !== recipientIds.length)
      throw new AppError(400, "VALIDATION_ERROR", "Người nhận không thuộc bài nguồn.");
    const candidateIds = await this.results.reviewCandidateItemIds(
      assignmentId,
      recipientIds,
    );
    if (!itemIds.some((itemId) => candidateIds.includes(itemId)))
      throw new AppError(
        409,
        "NO_VOCABULARY_NEEDS_REVIEW",
        "Những học sinh đã chọn chưa có từ nào cần ôn.",
      );
    const title = String(raw.title ?? `Ôn lại · ${source.title}`).normalize("NFKC").trim();
    if (!title || title.length > 160)
      throw new AppError(400, "VALIDATION_ERROR", "Tiêu đề phải dài từ 1 đến 160 ký tự.");
    const template = assignmentActivitiesForTemplate("PRE_TEST_REVIEW", {
      ageBand: source.ageBand,
      itemCount: items.length,
      imageItemCount: items.filter((item) =>
        ["EMOJI", "STORED_MEDIA"].includes(item.illustration.kind)).length,
      exampleItemCount: items.filter((item) => Boolean(item.exampleEn)).length,
    });
    const input: CreateAssignmentDraftRequest = {
      title,
      instruction: "Ôn lại các từ cần củng cố từ bài trước.",
      ageBand: source.ageBand,
      audienceType: "SELECTED_STUDENTS",
      selectedStudentIds: recipients.map((recipient) => recipient.studentId),
      templateCode: "PRE_TEST_REVIEW",
      answerFeedbackMode: source.answerFeedbackMode,
      shuffleQuestions: source.shuffleQuestions,
      maxAttempts: source.maxAttempts ?? undefined,
      passScore: source.passScore ?? undefined,
      items: items.map((item, index) => ({
        sourceVocabularyItemId: item.sourceVocabularyItemId,
        displayOrder: index + 1,
        word: item.word,
        meaningVi: item.meaningVi,
        phonetic: item.phonetic,
        partOfSpeech: item.partOfSpeech,
        exampleEn: item.exampleEn,
        speechText: item.speechText,
        tier: item.tier,
        illustration: item.illustration,
        supportsImageGame: item.supportsImageGame,
      })),
      activities: template.activities.map((activity, index) => ({
        displayOrder: index + 1,
        mechanic: activity.mechanic,
        presentation: activity.presentation,
        required: activity.required,
        config: activity.config,
      })),
    };
    const reviewId = await this.assignments.createReview(input, assignmentId, teacherUserId);
    console.info(JSON.stringify({
      event: "vocabulary_review_draft_created",
      assignmentId,
      reviewAssignmentId: reviewId,
      itemCount: items.length,
      recipientCount: recipients.length,
    }));
    return {
      id: reviewId,
      status: "DRAFT" as const,
      sourceAssignmentId: assignmentId,
      itemCount: items.length,
      recipientCount: recipients.length,
    };
  }
}
