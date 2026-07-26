import {
  learningAgeBands,
  vocabularyIllustrationKinds,
  vocabularySetSourceTypes,
  vocabularyTiers,
  type CreateVocabularySetRequest,
  type DuplicateVocabularySetRequest,
  type ImportPublicUnitSnapshotRequest,
  type LearningAgeBand,
  type UpdateVocabularySetRequest,
  type VocabularyIllustrationInput,
  type VocabularyPageQuery,
  type VocabularySetItemInput,
  type VocabularySetSourceType,
  type VocabularySourceReference,
  type VocabularyTopicSuggestionRequest,
} from "@teacher/shared";
import { AppError } from "../errors/app-error";
import {
  VocabularyRepository,
  type PreparedVocabularyItem,
  type PreparedVocabularySet,
} from "../repositories/vocabulary.repository";

const MAX_SET_ITEMS = 100;
const MAX_ASSIGNMENT_ITEMS = 40;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export function normalizeVocabularyText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en");
}

export class VocabularyService {
  constructor(private readonly repository: VocabularyRepository) {}

  listTopics(rawQuery: VocabularyPageQuery) {
    return this.repository.listTopics(this.validatePageQuery(rawQuery));
  }

  async topicDetail(slug: string, ageBand?: LearningAgeBand) {
    const normalizedSlug = this.validateSlug(slug);
    if (ageBand != null) this.validateAgeBand(ageBand);
    const topic = await this.repository.findTopic(normalizedSlug, ageBand);
    if (!topic)
      throw new AppError(404, "TOPIC_NOT_FOUND", "Không tìm thấy chủ đề từ vựng.");
    return topic;
  }

  async suggest(input: VocabularyTopicSuggestionRequest) {
    this.validateAgeBand(input.ageBand);
    if (!Number.isInteger(input.targetCount) || input.targetCount < 2 ||
      input.targetCount > MAX_ASSIGNMENT_ITEMS)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Số từ gợi ý phải từ 2 đến ${MAX_ASSIGNMENT_ITEMS}.`,
      );
    const topic = await this.topicDetail(input.topicSlug, input.ageBand);
    const seen = new Set<string>();
    const items = topic.words.filter((word) => {
      const key = `${word.normalizedWord}\u0000${word.normalizedMeaning}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((word, index) => ({
      ...word,
      selected: word.tier === "CORE" || index < input.targetCount,
    }));
    return {
      topic: {
        id: topic.id,
        slug: topic.slug,
        titleVi: topic.titleVi,
        descriptionVi: topic.descriptionVi,
        iconKey: topic.iconKey,
        ageBands: topic.ageBands,
        coreWordCount: topic.coreWordCount,
        extendedWordCount: topic.extendedWordCount,
      },
      ageBand: input.ageBand,
      targetCount: input.targetCount,
      items,
      selectedCount: items.filter((item) => item.selected).length,
    };
  }

  listSets(teacherUserId: number, rawQuery: VocabularyPageQuery) {
    this.validateActor(teacherUserId);
    return this.repository.listSets(teacherUserId, this.validatePageQuery(rawQuery));
  }

  async setDetail(id: number, teacherUserId: number) {
    this.validateId(id);
    this.validateActor(teacherUserId);
    const set = await this.repository.findSet(id, teacherUserId);
    if (!set)
      throw new AppError(
        404,
        "VOCABULARY_SET_NOT_FOUND",
        "Không tìm thấy bộ từ vựng.",
      );
    return set;
  }

  async create(input: CreateVocabularySetRequest, teacherUserId: number) {
    this.validateActor(teacherUserId);
    const prepared = this.prepareSet(input);
    return this.repository.create(prepared, teacherUserId);
  }

  async update(
    id: number,
    input: UpdateVocabularySetRequest,
    teacherUserId: number,
  ) {
    this.validateId(id);
    this.validateActor(teacherUserId);
    const existing = await this.setDetail(id, teacherUserId);
    if (existing.status === "ARCHIVED")
      throw new AppError(
        409,
        "VOCABULARY_SET_ARCHIVED",
        "Bộ từ đã lưu trữ không thể chỉnh sửa. Hãy nhân bản để dùng lại.",
      );
    const prepared = this.prepareSet({
      ...input,
      sourceType: existing.sourceType,
      sourceReference: existing.sourceReference ?? undefined,
    });
    const result = await this.repository.update(id, prepared, teacherUserId);
    if (result === "NOT_FOUND")
      throw new AppError(
        404,
        "VOCABULARY_SET_NOT_FOUND",
        "Không tìm thấy bộ từ vựng.",
      );
    if (result === "ARCHIVED")
      throw new AppError(
        409,
        "VOCABULARY_SET_ARCHIVED",
        "Bộ từ đã lưu trữ không thể chỉnh sửa. Hãy nhân bản để dùng lại.",
      );
  }

  async archive(id: number, teacherUserId: number) {
    this.validateId(id);
    this.validateActor(teacherUserId);
    const result = await this.repository.archive(id, teacherUserId);
    if (result === "NOT_FOUND")
      throw new AppError(
        404,
        "VOCABULARY_SET_NOT_FOUND",
        "Không tìm thấy bộ từ vựng.",
      );
    if (result === "ALREADY_ARCHIVED")
      throw new AppError(
        409,
        "VOCABULARY_SET_ARCHIVED",
        "Bộ từ đã được lưu trữ.",
      );
  }

  async duplicate(
    id: number,
    input: DuplicateVocabularySetRequest,
    teacherUserId: number,
  ) {
    this.validateId(id);
    this.validateActor(teacherUserId);
    const existing = await this.setDetail(id, teacherUserId);
    const title = this.validateText(
      input.title ?? `Bản sao — ${existing.title}`,
      "Tiêu đề",
      160,
    );
    const copyId = await this.repository.duplicate(id, teacherUserId, title);
    if (copyId == null)
      throw new AppError(
        404,
        "VOCABULARY_SET_NOT_FOUND",
        "Không tìm thấy bộ từ vựng.",
      );
    return copyId;
  }

  async importPublicUnit(
    input: ImportPublicUnitSnapshotRequest,
    teacherUserId: number,
  ) {
    this.validateActor(teacherUserId);
    this.validateAgeBand(input.ageBand);
    const unitId = this.validateText(input.unitId, "Mã Unit", 100);
    const levelSlug = this.validateText(input.levelSlug, "Mã lớp public", 30);
    if (!/^mam-non$|^lop-[1-9]$/.test(levelSlug))
      throw new AppError(400, "VALIDATION_ERROR", "Mã lớp public không hợp lệ.");
    const expectedAgeBand = levelSlug === "mam-non" || levelSlug === "lop-1"
      ? "PRESCHOOL_G1"
      : levelSlug === "lop-2" || levelSlug === "lop-3"
        ? "G2_G3"
        : levelSlug === "lop-4" || levelSlug === "lop-5"
          ? "G4_G5"
          : "G6_G9";
    if (input.ageBand !== expectedAgeBand)
      throw new AppError(
        400,
        "INVALID_AGE_BAND",
        "Khối tuổi không tương thích với lớp của Public Unit.",
      );
    if (!Number.isInteger(input.contentVersion) || input.contentVersion < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Phiên bản nội dung không hợp lệ.");
    if (!Array.isArray(input.items) || input.items.length < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Public Unit phải có từ vựng.");
    if (input.items.length > MAX_SET_ITEMS)
      throw new AppError(
        422,
        "VOCABULARY_LIMIT_EXCEEDED",
        `Một bộ từ không được vượt quá ${MAX_SET_ITEMS} từ.`,
      );
    const sourceIds = new Set<string>();
    const items: VocabularySetItemInput[] = input.items.map((item, index) => {
      const sourceId = this.validateText(item.id, `Mã từ dòng ${index + 1}`, 100);
      if (sourceIds.has(sourceId))
        throw new AppError(400, "VALIDATION_ERROR", "Public Unit có mã từ trùng.");
      sourceIds.add(sourceId);
      if (item.illustration.kind === "STORED_MEDIA")
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "V20A không import stored media từ Public Unit.",
        );
      return {
        displayOrder: index + 1,
        word: item.word,
        meaningVi: item.meaningVi,
        phonetic: item.phonetic,
        speechText: item.speechText ?? item.word,
        exampleEn: item.exampleEn,
        tier: "CUSTOM",
        illustration: item.illustration,
        supportsImageGame: item.illustration.kind !== "NONE",
      };
    });
    const prepared = this.prepareSet({
      title: input.title,
      description: input.description,
      sourceType: "PUBLIC_UNIT",
      sourceReference: {
        unitId,
        levelSlug,
        contentVersion: input.contentVersion,
      },
      ageBand: input.ageBand,
      items,
    });
    return this.repository.create(
      prepared,
      teacherUserId,
      "VOCABULARY_PUBLIC_UNIT_IMPORTED",
    );
  }

  private prepareSet(input: CreateVocabularySetRequest): PreparedVocabularySet {
    const title = this.validateText(input.title, "Tiêu đề", 160);
    const description = input.description?.trim()
      ? this.validateText(input.description, "Mô tả", 2000)
      : null;
    this.validateAgeBand(input.ageBand);
    if (!vocabularySetSourceTypes.includes(input.sourceType))
      throw new AppError(400, "VALIDATION_ERROR", "Nguồn bộ từ không hợp lệ.");
    this.validateSourceReference(input.sourceType, input.sourceReference);
    if (!Array.isArray(input.items) || input.items.length < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Bộ từ phải có ít nhất một từ.");
    if (input.items.length > MAX_SET_ITEMS)
      throw new AppError(
        422,
        "VOCABULARY_LIMIT_EXCEEDED",
        `Một bộ từ không được vượt quá ${MAX_SET_ITEMS} từ.`,
      );
    const orders = new Set<number>();
    const normalizedPairs = new Set<string>();
    const items = input.items.map((item, index) => {
      if (!Number.isInteger(item.displayOrder) || item.displayOrder < 1 ||
        item.displayOrder > MAX_SET_ITEMS || orders.has(item.displayOrder))
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `Thứ tự từ dòng ${index + 1} không hợp lệ hoặc bị trùng.`,
        );
      orders.add(item.displayOrder);
      const prepared = this.prepareItem(item, index);
      const pair = `${prepared.normalizedWord}\u0000${prepared.normalizedMeaning}`;
      if (normalizedPairs.has(pair))
        throw new AppError(
          409,
          "DUPLICATE_VOCABULARY_ITEM",
          `Từ và nghĩa ở dòng ${index + 1} bị trùng.`,
        );
      normalizedPairs.add(pair);
      return prepared;
    }).sort((a, b) => a.displayOrder - b.displayOrder);
    return {
      title,
      description,
      sourceType: input.sourceType,
      sourceReference: input.sourceReference ?? null,
      ageBand: input.ageBand,
      items,
    };
  }

  private prepareItem(item: VocabularySetItemInput, index: number): PreparedVocabularyItem {
    if (item.id != null) this.validateId(item.id);
    if (item.sourceTopicWordId != null) this.validateId(item.sourceTopicWordId);
    if (!vocabularyTiers.includes(item.tier))
      throw new AppError(400, "VALIDATION_ERROR", `Nhóm từ dòng ${index + 1} không hợp lệ.`);
    const word = this.validateText(item.word, `Từ dòng ${index + 1}`, 100);
    const meaningVi = this.validateText(item.meaningVi, `Nghĩa dòng ${index + 1}`, 200);
    const speechText = this.validateText(
      item.speechText ?? word,
      `Nội dung phát âm dòng ${index + 1}`,
      200,
    );
    const illustration = this.validateIllustration(item.illustration, index);
    const imageSearchTerms = [...new Set(
      (item.imageSearchTerms?.length ? item.imageSearchTerms : [word])
        .map((value) => this.validateText(value, `Từ khóa ảnh dòng ${index + 1}`, 100)),
    )].slice(0, 8);
    return {
      id: item.id,
      sourceTopicWordId: item.sourceTopicWordId,
      displayOrder: item.displayOrder,
      word,
      normalizedWord: normalizeVocabularyText(word),
      meaningVi,
      normalizedMeaning: normalizeVocabularyText(meaningVi),
      phonetic: item.phonetic?.trim()
        ? this.validateText(item.phonetic, `Phiên âm dòng ${index + 1}`, 100)
        : null,
      partOfSpeech: item.partOfSpeech?.trim()
        ? this.validateText(item.partOfSpeech, `Loại từ dòng ${index + 1}`, 50)
        : null,
      exampleEn: item.exampleEn?.trim()
        ? this.validateText(item.exampleEn, `Ví dụ dòng ${index + 1}`, 500)
        : null,
      speechText,
      tier: item.tier,
      illustrationKind: illustration.kind,
      illustrationValue: illustration.value ?? null,
      mediaId: illustration.mediaId ?? null,
      supportsImageGame: Boolean(item.supportsImageGame),
      imageSearchTerms,
    };
  }

  private validateIllustration(
    illustration: VocabularyIllustrationInput,
    index: number,
  ): VocabularyIllustrationInput {
    if (!illustration || !vocabularyIllustrationKinds.includes(illustration.kind))
      throw new AppError(400, "VALIDATION_ERROR", `Minh họa dòng ${index + 1} không hợp lệ.`);
    if (illustration.kind === "NONE") {
      if (illustration.value != null || illustration.mediaId != null)
        throw new AppError(400, "VALIDATION_ERROR", `Minh họa dòng ${index + 1} không hợp lệ.`);
      return { kind: "NONE" };
    }
    if (illustration.kind === "EMOJI") {
      const value = illustration.value?.trim() ?? "";
      if (!value || value.length > 16 || !/\p{Extended_Pictographic}/u.test(value) ||
        illustration.mediaId != null)
        throw new AppError(400, "VALIDATION_ERROR", `Emoji dòng ${index + 1} không hợp lệ.`);
      return { kind: "EMOJI", value };
    }
    if (illustration.kind === "PUBLIC_ASSET") {
      const value = illustration.value?.trim() ?? "";
      if (!/^\/learning\/[A-Za-z0-9/_\-.]+$/.test(value) ||
        value.includes("..") || illustration.mediaId != null)
        throw new AppError(400, "VALIDATION_ERROR", `Asset public dòng ${index + 1} không hợp lệ.`);
      return { kind: "PUBLIC_ASSET", value };
    }
    if (!Number.isInteger(illustration.mediaId) || Number(illustration.mediaId) < 1 ||
      illustration.value != null)
      throw new AppError(400, "VALIDATION_ERROR", `Stored media dòng ${index + 1} không hợp lệ.`);
    return { kind: "STORED_MEDIA", mediaId: Number(illustration.mediaId) };
  }

  private validateSourceReference(
    sourceType: VocabularySetSourceType,
    reference?: VocabularySourceReference,
  ) {
    if (sourceType === "MANUAL" && reference != null)
      throw new AppError(400, "VALIDATION_ERROR", "Bộ từ nhập tay không có sourceReference.");
    if (sourceType !== "MANUAL" && reference == null)
      throw new AppError(400, "VALIDATION_ERROR", "Nguồn bộ từ thiếu sourceReference.");
    if (sourceType === "TOPIC_CATALOG" &&
      (!("topicSlug" in (reference ?? {})) || !String((reference as { topicSlug?: string }).topicSlug ?? "").trim()))
      throw new AppError(400, "VALIDATION_ERROR", "Nguồn chủ đề không hợp lệ.");
    if (sourceType === "COPIED" &&
      (!("copiedSetId" in (reference ?? {})) ||
        !Number.isInteger((reference as { copiedSetId?: number }).copiedSetId)))
      throw new AppError(400, "VALIDATION_ERROR", "Nguồn bản sao không hợp lệ.");
    if (sourceType === "PUBLIC_UNIT") {
      const publicRef = reference as {
        unitId?: string;
        levelSlug?: string;
        contentVersion?: number;
      };
      if (!publicRef?.unitId?.trim() || !publicRef.levelSlug?.trim() ||
        !Number.isInteger(publicRef.contentVersion) || Number(publicRef.contentVersion) < 1)
        throw new AppError(400, "VALIDATION_ERROR", "Nguồn Public Unit không hợp lệ.");
    }
  }

  private validatePageQuery(raw: VocabularyPageQuery) {
    const page = Number(raw.page ?? 1);
    const pageSize = Number(raw.pageSize ?? DEFAULT_PAGE_SIZE);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) ||
      pageSize < 1 || pageSize > MAX_PAGE_SIZE)
      throw new AppError(400, "VALIDATION_ERROR", "Phân trang không hợp lệ.");
    if (raw.ageBand != null) this.validateAgeBand(raw.ageBand);
    const search = raw.search?.trim();
    if (search && search.length > 100)
      throw new AppError(400, "VALIDATION_ERROR", "Từ khóa tìm kiếm tối đa 100 ký tự.");
    return { page, pageSize, ageBand: raw.ageBand, search: search || undefined };
  }

  private validateAgeBand(value: LearningAgeBand): void {
    if (!learningAgeBands.includes(value))
      throw new AppError(400, "INVALID_AGE_BAND", "Nhóm tuổi không hợp lệ.");
  }

  private validateId(id: number): void {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(400, "VALIDATION_ERROR", "Mã dữ liệu không hợp lệ.");
  }

  private validateActor(id: number): void {
    if (!Number.isInteger(id) || id < 1)
      throw new AppError(401, "UNAUTHORIZED", "Bạn cần đăng nhập.");
  }

  private validateSlug(value: string): string {
    const slug = value?.trim();
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
      throw new AppError(400, "VALIDATION_ERROR", "Mã chủ đề không hợp lệ.");
    return slug;
  }

  private validateText(value: string, label: string, maxLength: number): string {
    const trimmed = value?.normalize("NFKC").trim().replace(/\s+/gu, " ");
    if (!trimmed || trimmed.length > maxLength)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `${label} là bắt buộc và tối đa ${maxLength} ký tự.`,
      );
    return trimmed;
  }
}
