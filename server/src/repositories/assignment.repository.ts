import type {
  AssignmentActivity,
  AssignmentAudienceType,
  AssignmentDetail,
  AssignmentListItem,
  AssignmentListQuery,
  AssignmentRecipient,
  AssignmentSnapshotItem,
  AssignmentStatus,
  CreateAssignmentDraftRequest,
  LearningAgeBand,
  VocabularyIllustrationInput,
} from "@teacher/shared";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../db/pool";
import { AppError } from "../errors/app-error";
import { AuditRepository, type AuditAction } from "./audit.repository";

interface AssignmentRow extends RowDataPacket {
  id: number;
  teacher_user_id: number;
  vocabulary_set_id: number | null;
  title: string;
  instruction: string | null;
  audience_type: AssignmentAudienceType | null;
  class_id: number | null;
  public_code: string | null;
  status: AssignmentStatus;
  template_code: AssignmentDetail["templateCode"];
  age_band: LearningAgeBand;
  available_from: string | null;
  due_at: string | null;
  max_attempts: number | null;
  pass_score: number | null;
  answer_feedback_mode: AssignmentDetail["answerFeedbackMode"];
  shuffle_questions: number;
  version: number;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  recipient_count?: number;
  item_count?: number;
}

interface ItemRow extends RowDataPacket {
  id: number;
  source_vocabulary_item_id: number | null;
  stored_media_id: number | null;
  display_order: number;
  word: string;
  normalized_word: string;
  meaning_vi: string;
  phonetic: string | null;
  part_of_speech: string | null;
  example_en: string | null;
  speech_text: string;
  tier: AssignmentSnapshotItem["tier"];
  illustration_snapshot_json: unknown;
  supports_image_game: number;
  media_id?: number | null;
  media_alt_text?: string | null;
}

interface ActivityRow extends RowDataPacket {
  id: number;
  display_order: number;
  mechanic: AssignmentActivity["mechanic"];
  presentation: AssignmentActivity["presentation"];
  required: number;
  config_json: unknown;
}

function json<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return (value ?? fallback) as T;
}

function dateTime(value: unknown): string | null {
  return value == null ? null : new Date(value as string | Date).toISOString();
}

function mapList(row: AssignmentRow): AssignmentListItem {
  return {
    id: Number(row.id),
    title: row.title,
    status: row.status,
    audienceType: row.audience_type,
    ageBand: row.age_band,
    dueAt: dateTime(row.due_at),
    recipientCount: Number(row.recipient_count ?? 0),
    itemCount: Number(row.item_count ?? 0),
    version: Number(row.version),
    updatedAt: dateTime(row.updated_at)!,
  };
}

function mapItem(row: ItemRow): AssignmentSnapshotItem {
  let illustration = json<AssignmentSnapshotItem["illustrationSnapshot"]>(
    row.illustration_snapshot_json,
    { kind: "NONE" },
  );
  if (illustration.kind === "STORED_MEDIA" && row.media_id) {
    illustration = {
      ...illustration,
      mediaId: Number(row.media_id),
      mediaUrl: `/api/public/vocabulary-media/${Number(row.media_id)}?variant=GAME`,
      thumbnailUrl: `/api/public/vocabulary-media/${Number(row.media_id)}?variant=THUMBNAIL`,
      ...(row.media_alt_text ? { altText: row.media_alt_text } : {}),
    };
  }
  return {
    id: Number(row.id),
    ...(row.source_vocabulary_item_id
      ? { sourceVocabularyItemId: Number(row.source_vocabulary_item_id) }
      : {}),
    displayOrder: Number(row.display_order),
    word: row.word,
    normalizedWord: row.normalized_word,
    meaningVi: row.meaning_vi,
    ...(row.phonetic ? { phonetic: row.phonetic } : {}),
    ...(row.part_of_speech ? { partOfSpeech: row.part_of_speech } : {}),
    ...(row.example_en ? { exampleEn: row.example_en } : {}),
    speechText: row.speech_text,
    tier: row.tier,
    illustration: illustration as VocabularyIllustrationInput,
    illustrationSnapshot: illustration,
    supportsImageGame: Boolean(row.supports_image_game),
  };
}

function mapActivity(row: ActivityRow): AssignmentActivity {
  return {
    id: Number(row.id),
    displayOrder: Number(row.display_order),
    mechanic: row.mechanic,
    presentation: row.presentation,
    required: Boolean(row.required),
    config: json<Record<string, unknown>>(row.config_json, {}),
  };
}

export interface PublishToken {
  studentId: number;
  rawToken: string;
  tokenHash: string;
}

export class AssignmentRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async list(
    query: Required<Pick<AssignmentListQuery, "page" | "pageSize">> &
      Omit<AssignmentListQuery, "page" | "pageSize">,
    teacherUserId: number,
  ) {
    const where = ["a.teacher_user_id=?"];
    const params: unknown[] = [teacherUserId];
    if (query.search) {
      where.push("(a.title LIKE ? OR a.public_code LIKE ?)");
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.status) { where.push("a.status=?"); params.push(query.status); }
    if (query.audienceType) {
      where.push("a.audience_type=?");
      params.push(query.audienceType);
    }
    if (query.ageBand) { where.push("a.age_band=?"); params.push(query.ageBand); }
    const filter = where.join(" AND ");
    const [count] = await pool.query<Array<RowDataPacket & { count: number }>>(
      `SELECT COUNT(*) count FROM learning_assignments a WHERE ${filter}`,
      params,
    );
    const [rows] = await pool.query<AssignmentRow[]>(
      `SELECT a.*,
        (SELECT COUNT(*) FROM learning_assignment_recipients r
          WHERE r.assignment_id=a.id) recipient_count,
        (SELECT COUNT(*) FROM learning_assignment_items i
          WHERE i.assignment_id=a.id) item_count
       FROM learning_assignments a
       WHERE ${filter}
       ORDER BY FIELD(a.status,'DRAFT','PUBLISHED','CLOSED'),a.updated_at DESC,a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return {
      items: rows.map(mapList),
      total: Number(count[0]?.count ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(id: number, teacherUserId: number): Promise<AssignmentDetail | null> {
    const [rows] = await pool.query<AssignmentRow[]>(
      `SELECT a.*,
        (SELECT COUNT(*) FROM learning_assignment_recipients r
          WHERE r.assignment_id=a.id) recipient_count,
        (SELECT COUNT(*) FROM learning_assignment_items i
          WHERE i.assignment_id=a.id) item_count
       FROM learning_assignments a
       WHERE a.id=? AND a.teacher_user_id=? LIMIT 1`,
      [id, teacherUserId],
    );
    if (!rows[0]) return null;
    const [items] = await pool.query<ItemRow[]>(
      `SELECT i.*,m.id media_id,m.alt_text media_alt_text
       FROM learning_assignment_items i
       LEFT JOIN vocabulary_media m
         ON m.id=i.stored_media_id AND m.status='ACTIVE'
       WHERE i.assignment_id=? ORDER BY i.display_order`,
      [id],
    );
    const [activities] = await pool.query<ActivityRow[]>(
      "SELECT * FROM learning_assignment_activities WHERE assignment_id=? ORDER BY display_order",
      [id],
    );
    const [audience] = await pool.query<RowDataPacket[]>(
      "SELECT student_id FROM learning_assignment_audience_students WHERE assignment_id=? ORDER BY student_id",
      [id],
    );
    const row = rows[0];
    return {
      ...mapList(row),
      teacherUserId: Number(row.teacher_user_id),
      instruction: row.instruction,
      vocabularySetId: row.vocabulary_set_id == null
        ? null
        : Number(row.vocabulary_set_id),
      classId: row.class_id == null ? null : Number(row.class_id),
      selectedStudentIds: audience.map((value) => Number(value.student_id)),
      publicCode: row.public_code,
      templateCode: row.template_code,
      availableFrom: dateTime(row.available_from),
      maxAttempts: row.max_attempts == null ? null : Number(row.max_attempts),
      passScore: row.pass_score == null ? null : Number(row.pass_score),
      answerFeedbackMode: row.answer_feedback_mode,
      shuffleQuestions: Boolean(row.shuffle_questions),
      publishedAt: dateTime(row.published_at),
      closedAt: dateTime(row.closed_at),
      items: items.map(mapItem),
      activities: activities.map(mapActivity),
    };
  }

  async publicDetail(publicCode: string): Promise<AssignmentDetail | null> {
    const [rows] = await pool.query<AssignmentRow[]>(
      `SELECT a.*,
        (SELECT COUNT(*) FROM learning_assignment_recipients r
          WHERE r.assignment_id=a.id) recipient_count,
        (SELECT COUNT(*) FROM learning_assignment_items i
          WHERE i.assignment_id=a.id) item_count
       FROM learning_assignments a
       WHERE a.public_code=? AND a.status='PUBLISHED' LIMIT 1`,
      [publicCode],
    );
    if (!rows[0]) return null;
    const row = rows[0];
    const [items] = await pool.query<ItemRow[]>(
      `SELECT i.*,m.id media_id,m.alt_text media_alt_text
       FROM learning_assignment_items i
       LEFT JOIN vocabulary_media m
         ON m.id=i.stored_media_id AND m.status='ACTIVE'
       WHERE i.assignment_id=? ORDER BY i.display_order`,
      [row.id],
    );
    const [activities] = await pool.query<ActivityRow[]>(
      "SELECT * FROM learning_assignment_activities WHERE assignment_id=? ORDER BY display_order",
      [row.id],
    );
    return {
      ...mapList(row),
      teacherUserId: Number(row.teacher_user_id),
      instruction: row.instruction,
      vocabularySetId: row.vocabulary_set_id == null ? null : Number(row.vocabulary_set_id),
      classId: row.class_id == null ? null : Number(row.class_id),
      selectedStudentIds: [],
      publicCode: row.public_code,
      templateCode: row.template_code,
      availableFrom: dateTime(row.available_from),
      maxAttempts: row.max_attempts == null ? null : Number(row.max_attempts),
      passScore: row.pass_score == null ? null : Number(row.pass_score),
      answerFeedbackMode: row.answer_feedback_mode,
      shuffleQuestions: Boolean(row.shuffle_questions),
      publishedAt: dateTime(row.published_at),
      closedAt: dateTime(row.closed_at),
      items: items.map(mapItem),
      activities: activities.map(mapActivity),
    };
  }

  async create(
    input: CreateAssignmentDraftRequest,
    teacherUserId: number,
    action: AuditAction = "LEARNING_ASSIGNMENT_DRAFT_CREATED",
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await this.validateReferences(connection, input);
      const id = await this.insertDraft(connection, input, teacherUserId);
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action,
        entityType: "LEARNING_ASSIGNMENT",
        entityId: id,
        newValues: {
          title: input.title,
          audienceType: input.audienceType ?? null,
          ageBand: input.ageBand,
          itemCount: input.items.length,
          activityCount: input.activities.length,
        },
      });
      await connection.commit();
      return id;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(
    id: number,
    input: CreateAssignmentDraftRequest,
    expectedVersion: number,
    teacherUserId: number,
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const assignment = await this.lock(connection, id, teacherUserId);
      if (!assignment) throw this.notFound();
      if (assignment.status !== "DRAFT")
        throw new AppError(409, "ASSIGNMENT_NOT_EDITABLE", "Chỉ có thể sửa bài nháp.");
      if (Number(assignment.version) !== expectedVersion)
        throw new AppError(
          409,
          "ASSIGNMENT_VERSION_CONFLICT",
          "Bài đã được cập nhật ở nơi khác. Hãy tải lại trước khi lưu.",
        );
      await this.validateReferences(connection, input);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE learning_assignments SET
          vocabulary_set_id=?,title=?,instruction=?,audience_type=?,class_id=?,
          template_code=?,age_band=?,available_from=?,due_at=?,max_attempts=?,
          pass_score=?,answer_feedback_mode=?,shuffle_questions=?,version=version+1
         WHERE id=? AND version=?`,
        this.assignmentParams(input, id, expectedVersion),
      );
      if (!result.affectedRows)
        throw new AppError(409, "ASSIGNMENT_VERSION_CONFLICT", "Bài đã thay đổi.");
      await this.replaceChildren(connection, id, input);
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action: "LEARNING_ASSIGNMENT_UPDATED",
        entityType: "LEARNING_ASSIGNMENT",
        entityId: id,
        previousValues: { version: expectedVersion },
        newValues: { version: expectedVersion + 1, title: input.title },
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async publish(input: {
    id: number;
    teacherUserId: number;
    expectedVersion: number;
    publicCode: string;
    createToken: (studentId: number) => PublishToken;
    openToken?: { rawToken: string; tokenHash: string };
  }): Promise<Array<PublishToken & { recipientId: number; studentName: string }>> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const assignment = await this.lock(
        connection,
        input.id,
        input.teacherUserId,
      );
      if (!assignment) throw this.notFound();
      if (assignment.status !== "DRAFT")
        throw new AppError(
          409,
          "ASSIGNMENT_ALREADY_PUBLISHED",
          "Bài này không còn là bản nháp.",
        );
      if (Number(assignment.version) !== input.expectedVersion)
        throw new AppError(409, "ASSIGNMENT_VERSION_CONFLICT", "Bài nháp đã thay đổi.");
      const [itemCount] = await connection.query<Array<RowDataPacket & { count: number }>>(
        "SELECT COUNT(*) count FROM learning_assignment_items WHERE assignment_id=?",
        [input.id],
      );
      const [activityCount] = await connection.query<Array<RowDataPacket & { count: number }>>(
        "SELECT COUNT(*) count FROM learning_assignment_activities WHERE assignment_id=?",
        [input.id],
      );
      if (Number(itemCount[0]?.count ?? 0) < 2)
        throw new AppError(422, "ASSIGNMENT_HAS_NO_ITEMS", "Bài cần ít nhất 2 từ.");
      if (Number(activityCount[0]?.count ?? 0) < 1)
        throw new AppError(422, "ASSIGNMENT_HAS_NO_ACTIVITIES", "Bài cần ít nhất một hoạt động.");

      const recipients = await this.resolveRecipients(connection, assignment);
      const tokens: Array<PublishToken & { recipientId: number; studentName: string }> = [];
      for (const recipient of recipients) {
        const token = input.createToken(Number(recipient.id));
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO learning_assignment_recipients
            (assignment_id,student_id,student_name_snapshot,access_token_hash,assigned_at)
           VALUES (?,?,?,?,CURRENT_TIMESTAMP)`,
          [input.id, recipient.id, recipient.full_name, token.tokenHash],
        );
        tokens.push({
          ...token,
          recipientId: Number(result.insertId),
          studentName: String(recipient.full_name),
        });
      }
      const openHash = assignment.audience_type === "OPEN_LINK"
        ? input.openToken?.tokenHash ?? null
        : null;
      await connection.execute(
        `UPDATE learning_assignments
         SET status='PUBLISHED',public_code=?,open_access_token_hash=?,
           open_access_revoked_at=NULL,published_at=CURRENT_TIMESTAMP,version=version+1
         WHERE id=?`,
        [input.publicCode, openHash, input.id],
      );
      await this.audit.record(connection, {
        actorUserId: input.teacherUserId,
        action: "LEARNING_ASSIGNMENT_PUBLISHED",
        entityType: "LEARNING_ASSIGNMENT",
        entityId: input.id,
        newValues: {
          publicCode: input.publicCode,
          recipientCount: recipients.length,
          audienceType: assignment.audience_type,
        },
      });
      await connection.commit();
      return tokens;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async recipients(
    id: number,
    teacherUserId: number,
  ): Promise<AssignmentRecipient[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id,r.student_id,r.student_name_snapshot,r.assigned_at,
        r.token_revoked_at,r.completed_at
       FROM learning_assignment_recipients r
       JOIN learning_assignments a ON a.id=r.assignment_id
       WHERE r.assignment_id=? AND a.teacher_user_id=?
       ORDER BY r.student_name_snapshot`,
      [id, teacherUserId],
    );
    return rows.map((row) => ({
      id: Number(row.id),
      studentId: Number(row.student_id),
      studentName: String(row.student_name_snapshot),
      assignedAt: dateTime(row.assigned_at)!,
      tokenRevokedAt: dateTime(row.token_revoked_at),
      completedAt: dateTime(row.completed_at),
    }));
  }

  async rotateAccess(input: {
    assignmentId: number;
    recipientId?: number;
    teacherUserId: number;
    tokenHash: string;
  }): Promise<{ recipientId?: number; studentId?: number; studentName?: string }> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const assignment = await this.lock(
        connection,
        input.assignmentId,
        input.teacherUserId,
      );
      if (!assignment) throw this.notFound();
      if (assignment.status !== "PUBLISHED")
        throw new AppError(409, "ASSIGNMENT_CLOSED", "Chỉ bài đang mở mới đổi được link.");
      let result: { recipientId?: number; studentId?: number; studentName?: string } = {};
      if (assignment.audience_type === "OPEN_LINK") {
        await connection.execute(
          `UPDATE learning_assignments SET open_access_token_hash=?,
            open_access_revoked_at=NULL,open_access_version=open_access_version+1,
            version=version+1 WHERE id=?`,
          [input.tokenHash, input.assignmentId],
        );
      } else {
        if (!input.recipientId)
          throw new AppError(400, "VALIDATION_ERROR", "Thiếu người nhận cần đổi link.");
        const [recipients] = await connection.query<RowDataPacket[]>(
          `SELECT id,student_id,student_name_snapshot
           FROM learning_assignment_recipients
           WHERE id=? AND assignment_id=? FOR UPDATE`,
          [input.recipientId, input.assignmentId],
        );
        if (!recipients[0]) throw this.notFound();
        await connection.execute(
          `UPDATE learning_assignment_recipients
           SET access_token_hash=?,token_revoked_at=NULL,
             access_version=access_version+1 WHERE id=?`,
          [input.tokenHash, input.recipientId],
        );
        result = {
          recipientId: Number(recipients[0].id),
          studentId: Number(recipients[0].student_id),
          studentName: String(recipients[0].student_name_snapshot),
        };
      }
      await this.audit.record(connection, {
        actorUserId: input.teacherUserId,
        action: "LEARNING_ASSIGNMENT_ACCESS_REGENERATED",
        entityType: "LEARNING_ASSIGNMENT",
        entityId: input.assignmentId,
        newValues: { recipientId: input.recipientId ?? null },
      });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async revokeAccess(
    assignmentId: number,
    recipientId: number | undefined,
    teacherUserId: number,
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const assignment = await this.lock(connection, assignmentId, teacherUserId);
      if (!assignment) throw this.notFound();
      if (assignment.status !== "PUBLISHED")
        throw new AppError(409, "ASSIGNMENT_CLOSED", "Bài không còn mở.");
      if (assignment.audience_type === "OPEN_LINK") {
        await connection.execute(
          `UPDATE learning_assignments SET open_access_revoked_at=CURRENT_TIMESTAMP,
            open_access_version=open_access_version+1,version=version+1 WHERE id=?`,
          [assignmentId],
        );
      } else {
        if (!recipientId)
          throw new AppError(400, "VALIDATION_ERROR", "Thiếu người nhận cần thu hồi.");
        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE learning_assignment_recipients r
           JOIN learning_assignments a ON a.id=r.assignment_id
           SET r.token_revoked_at=CURRENT_TIMESTAMP,
             r.access_version=r.access_version+1
           WHERE r.id=? AND r.assignment_id=? AND a.teacher_user_id=?`,
          [recipientId, assignmentId, teacherUserId],
        );
        if (!result.affectedRows) throw this.notFound();
      }
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action: "LEARNING_ASSIGNMENT_ACCESS_REVOKED",
        entityType: "LEARNING_ASSIGNMENT",
        entityId: assignmentId,
        newValues: { recipientId: recipientId ?? null },
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async changeDueDate(
    id: number,
    dueAt: string | null,
    teacherUserId: number,
  ): Promise<void> {
    await this.guardedMutation(
      id,
      teacherUserId,
      "PUBLISHED",
      "LEARNING_ASSIGNMENT_DUE_DATE_CHANGED",
      async (connection, assignment) => {
        await connection.execute(
          "UPDATE learning_assignments SET due_at=?,version=version+1 WHERE id=?",
          [dueAt, id],
        );
        return { previousValues: { dueAt: assignment.due_at }, newValues: { dueAt } };
      },
    );
  }

  async close(id: number, teacherUserId: number): Promise<void> {
    await this.guardedMutation(
      id,
      teacherUserId,
      "PUBLISHED",
      "LEARNING_ASSIGNMENT_CLOSED",
      async (connection) => {
        await connection.execute(
          `UPDATE learning_assignments SET status='CLOSED',closed_at=CURRENT_TIMESTAMP,
            open_access_revoked_at=CURRENT_TIMESTAMP,
            open_access_version=open_access_version+1,version=version+1 WHERE id=?`,
          [id],
        );
        await connection.execute(
          `UPDATE learning_assignment_recipients SET token_revoked_at=CURRENT_TIMESTAMP,
             access_version=access_version+1
           WHERE assignment_id=? AND token_revoked_at IS NULL`,
          [id],
        );
        return { newValues: { status: "CLOSED" } };
      },
    );
  }

  private async validateReferences(
    connection: PoolConnection,
    input: CreateAssignmentDraftRequest,
  ): Promise<void> {
    if (input.vocabularySetId != null) {
      const [sets] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM vocabulary_sets WHERE id=? LIMIT 1",
        [input.vocabularySetId],
      );
      if (!sets.length)
        throw new AppError(
          404,
          "VOCABULARY_SET_NOT_FOUND",
          "Không tìm thấy bộ từ vựng.",
        );
    }

    const itemIds = [...new Set(input.items
      .map((item) => item.sourceVocabularyItemId)
      .filter((value): value is number => value != null))];
    if (itemIds.length) {
      const placeholders = itemIds.map(() => "?").join(",");
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id,vocabulary_set_id FROM vocabulary_items
         WHERE id IN (${placeholders})`,
        itemIds,
      );
      if (
        rows.length !== itemIds.length
        || (input.vocabularySetId != null
          && rows.some((row) =>
            Number(row.vocabulary_set_id) !== input.vocabularySetId))
      )
        throw new AppError(
          404,
          "VOCABULARY_ITEM_NOT_FOUND",
          "Một hoặc nhiều từ không còn thuộc bộ từ đã chọn.",
        );
    }

    const mediaIds = [...new Set(input.items
      .map((item) => item.illustration.kind === "STORED_MEDIA"
        ? item.illustration.mediaId : undefined)
      .filter((value): value is number => value != null))];
    if (mediaIds.length) {
      const placeholders = mediaIds.map(() => "?").join(",");
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM vocabulary_media
         WHERE id IN (${placeholders}) AND status='ACTIVE'`,
        mediaIds,
      );
      if (rows.length !== mediaIds.length)
        throw new AppError(
          404,
          "VOCABULARY_MEDIA_NOT_FOUND",
          "Một hoặc nhiều hình minh họa không còn khả dụng.",
        );
    }
  }

  private async insertDraft(
    connection: PoolConnection,
    input: CreateAssignmentDraftRequest,
    teacherUserId: number,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO learning_assignments
        (teacher_user_id,vocabulary_set_id,title,instruction,audience_type,class_id,
         template_code,age_band,available_from,due_at,max_attempts,pass_score,
         answer_feedback_mode,shuffle_questions)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [teacherUserId, ...this.assignmentParams(input)],
    );
    const id = Number(result.insertId);
    await this.replaceChildren(connection, id, input);
    return id;
  }

  private assignmentParams(
    input: CreateAssignmentDraftRequest,
    ...tail: Array<string | number | boolean | null>
  ): Array<string | number | boolean | null> {
    return [
      input.vocabularySetId ?? null,
      input.title,
      input.instruction || null,
      input.audienceType ?? null,
      input.audienceType === "CLASS" ? input.classId ?? null : null,
      input.templateCode,
      input.ageBand,
      input.availableFrom ?? null,
      input.dueAt ?? null,
      input.maxAttempts ?? null,
      input.passScore ?? null,
      input.answerFeedbackMode,
      input.shuffleQuestions,
      ...tail,
    ];
  }

  private async replaceChildren(
    connection: PoolConnection,
    id: number,
    input: CreateAssignmentDraftRequest,
  ): Promise<void> {
    await connection.execute(
      "DELETE FROM learning_assignment_audience_students WHERE assignment_id=?",
      [id],
    );
    await connection.execute(
      "DELETE FROM learning_assignment_activities WHERE assignment_id=?",
      [id],
    );
    await connection.execute(
      "DELETE FROM learning_assignment_items WHERE assignment_id=?",
      [id],
    );
    for (const item of input.items) {
      const snapshot = item.illustration;
      await connection.execute(
        `INSERT INTO learning_assignment_items
          (assignment_id,source_vocabulary_item_id,stored_media_id,display_order,
           word,normalized_word,meaning_vi,phonetic,part_of_speech,example_en,
           speech_text,tier,illustration_snapshot_json,supports_image_game)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          item.sourceVocabularyItemId ?? null,
          snapshot.kind === "STORED_MEDIA" ? snapshot.mediaId ?? null : null,
          item.displayOrder,
          item.word,
          item.word.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en"),
          item.meaningVi,
          item.phonetic ?? null,
          item.partOfSpeech ?? null,
          item.exampleEn ?? null,
          item.speechText || item.word,
          item.tier,
          JSON.stringify(snapshot),
          item.supportsImageGame,
        ],
      );
    }
    for (const activity of input.activities)
      await connection.execute(
        `INSERT INTO learning_assignment_activities
          (assignment_id,display_order,mechanic,presentation,required,config_json)
         VALUES (?,?,?,?,?,?)`,
        [
          id,
          activity.displayOrder,
          activity.mechanic,
          activity.presentation,
          activity.required,
          JSON.stringify(activity.config ?? {}),
        ],
      );
    if (input.audienceType === "SELECTED_STUDENTS")
      for (const studentId of [...new Set(input.selectedStudentIds ?? [])])
        await connection.execute(
          `INSERT INTO learning_assignment_audience_students
            (assignment_id,student_id) VALUES (?,?)`,
          [id, studentId],
        );
  }

  private lock(
    connection: PoolConnection,
    id: number,
    teacherUserId: number,
  ): Promise<AssignmentRow | null> {
    return connection.query<AssignmentRow[]>(
      "SELECT * FROM learning_assignments WHERE id=? AND teacher_user_id=? FOR UPDATE",
      [id, teacherUserId],
    ).then(([rows]) => rows[0] ?? null);
  }

  private async resolveRecipients(
    connection: PoolConnection,
    assignment: AssignmentRow,
  ): Promise<RowDataPacket[]> {
    if (!assignment.audience_type)
      throw new AppError(422, "INVALID_ASSIGNMENT_AUDIENCE", "Hãy chọn người nhận.");
    if (assignment.audience_type === "OPEN_LINK") return [];
    if (assignment.audience_type === "CLASS") {
      const [classes] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM classes WHERE id=? AND status<>'CLOSED' FOR UPDATE",
        [assignment.class_id],
      );
      if (!classes[0])
        throw new AppError(404, "CLASS_NOT_FOUND", "Không tìm thấy lớp đang hoạt động.");
      const [students] = await connection.query<RowDataPacket[]>(
        `SELECT DISTINCT s.id,s.full_name
         FROM class_enrollments e
         JOIN students s ON s.id=e.student_id AND s.status='ACTIVE'
         WHERE e.class_id=? AND e.status='ACTIVE'
         ORDER BY s.id FOR UPDATE`,
        [assignment.class_id],
      );
      if (!students.length)
        throw new AppError(422, "ASSIGNMENT_HAS_NO_RECIPIENTS", "Lớp chưa có học sinh đang học.");
      return students;
    }
    const [selected] = await connection.query<RowDataPacket[]>(
      `SELECT s.id,s.full_name
       FROM learning_assignment_audience_students a
       JOIN students s ON s.id=a.student_id AND s.status='ACTIVE'
       WHERE a.assignment_id=?
       ORDER BY s.id FOR UPDATE`,
      [assignment.id],
    );
    const [count] = await connection.query<Array<RowDataPacket & { count: number }>>(
      "SELECT COUNT(*) count FROM learning_assignment_audience_students WHERE assignment_id=?",
      [assignment.id],
    );
    if (!selected.length)
      throw new AppError(422, "ASSIGNMENT_HAS_NO_RECIPIENTS", "Hãy chọn ít nhất một học sinh.");
    if (selected.length !== Number(count[0].count))
      throw new AppError(404, "STUDENT_NOT_FOUND", "Một học sinh đã chọn không còn hoạt động.");
    return selected;
  }

  private async guardedMutation(
    id: number,
    teacherUserId: number,
    requiredStatus: AssignmentStatus,
    action: AuditAction,
    mutate: (
      connection: PoolConnection,
      assignment: AssignmentRow,
    ) => Promise<{ previousValues?: unknown; newValues?: unknown }>,
  ): Promise<void> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const assignment = await this.lock(connection, id, teacherUserId);
      if (!assignment) throw this.notFound();
      if (assignment.status !== requiredStatus)
        throw new AppError(
          409,
          assignment.status === "CLOSED" ? "ASSIGNMENT_CLOSED" : "ASSIGNMENT_NOT_EDITABLE",
          "Trạng thái bài không cho phép thao tác này.",
        );
      const audit = await mutate(connection, assignment);
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action,
        entityType: "LEARNING_ASSIGNMENT",
        entityId: id,
        ...audit,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private notFound(): AppError {
    return new AppError(404, "ASSIGNMENT_NOT_FOUND", "Không tìm thấy bài từ vựng.");
  }
}
