import type {
  LearningAgeBand,
  VocabularyPageQuery,
  VocabularySetDetail,
  VocabularySetItem,
  VocabularySetListItem,
  VocabularySetSourceType,
  VocabularySourceReference,
  VocabularyTier,
  VocabularyTopicDetail,
  VocabularyTopicListItem,
  VocabularyTopicWord,
} from "@teacher/shared";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { pool } from "../db/pool";
import { AuditRepository, type AuditAction } from "./audit.repository";

export interface PreparedVocabularyItem {
  id?: number;
  sourceTopicWordId?: number;
  displayOrder: number;
  word: string;
  normalizedWord: string;
  meaningVi: string;
  normalizedMeaning: string;
  phonetic: string | null;
  partOfSpeech: string | null;
  exampleEn: string | null;
  speechText: string;
  tier: VocabularyTier;
  illustrationKind: VocabularySetItem["illustration"]["kind"];
  illustrationValue: string | null;
  mediaId: number | null;
  supportsImageGame: boolean;
  imageSearchTerms: string[];
}

export interface PreparedVocabularySet {
  title: string;
  description: string | null;
  sourceType: VocabularySetSourceType;
  sourceReference: VocabularySourceReference | null;
  ageBand: LearningAgeBand;
  items: PreparedVocabularyItem[];
}

interface TopicRow extends RowDataPacket {
  id: number;
  slug: string;
  title_vi: string;
  description_vi: string | null;
  icon_key: string;
  core_word_count: number;
  extended_word_count: number;
}

interface TopicWordRow extends RowDataPacket {
  id: number;
  topic_id: number;
  word: string;
  normalized_word: string;
  meaning_vi: string;
  normalized_meaning: string;
  phonetic: string | null;
  part_of_speech: string | null;
  example_en: string | null;
  speech_text: string;
  tier: "CORE" | "EXTENDED";
  priority: number;
  age_bands_json: unknown;
  supports_image_game: number;
  image_search_terms_json: unknown;
}

interface SetRow extends RowDataPacket {
  id: number;
  title: string;
  description: string | null;
  source_type: VocabularySetSourceType;
  source_reference_json: unknown;
  age_band: LearningAgeBand;
  status: VocabularySetListItem["status"];
  item_count: number;
  updated_at: string;
}

interface ItemRow extends RowDataPacket {
  id: number;
  source_topic_word_id: number | null;
  display_order: number;
  word: string;
  normalized_word: string;
  meaning_vi: string;
  normalized_meaning: string;
  phonetic: string | null;
  part_of_speech: string | null;
  example_en: string | null;
  speech_text: string;
  tier: VocabularyTier;
  illustration_kind: VocabularySetItem["illustration"]["kind"];
  illustration_value: string | null;
  media_id: number | null;
  supports_image_game: number;
  image_search_terms_json: unknown;
}

function jsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function mapTopicWord(row: TopicWordRow): VocabularyTopicWord {
  return {
    id: Number(row.id),
    word: row.word,
    normalizedWord: row.normalized_word,
    meaningVi: row.meaning_vi,
    normalizedMeaning: row.normalized_meaning,
    phonetic: row.phonetic,
    partOfSpeech: row.part_of_speech,
    exampleEn: row.example_en,
    speechText: row.speech_text,
    tier: row.tier,
    priority: Number(row.priority),
    ageBands: jsonValue<LearningAgeBand[]>(row.age_bands_json, []),
    supportsImageGame: Boolean(row.supports_image_game),
    imageSearchTerms: jsonValue<string[]>(row.image_search_terms_json, [row.word]),
  };
}

function mapSet(row: SetRow): VocabularySetListItem {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    sourceType: row.source_type,
    sourceReference: jsonValue<VocabularySourceReference | null>(
      row.source_reference_json,
      null,
    ),
    ageBand: row.age_band,
    status: row.status,
    itemCount: Number(row.item_count),
    updatedAt: String(row.updated_at),
  };
}

function mapItem(row: ItemRow): VocabularySetItem {
  return {
    id: Number(row.id),
    sourceTopicWordId: row.source_topic_word_id == null
      ? undefined
      : Number(row.source_topic_word_id),
    displayOrder: Number(row.display_order),
    word: row.word,
    normalizedWord: row.normalized_word,
    meaningVi: row.meaning_vi,
    normalizedMeaning: row.normalized_meaning,
    phonetic: row.phonetic ?? undefined,
    partOfSpeech: row.part_of_speech ?? undefined,
    exampleEn: row.example_en ?? undefined,
    speechText: row.speech_text,
    tier: row.tier,
    illustration: {
      kind: row.illustration_kind,
      ...(row.illustration_value ? { value: row.illustration_value } : {}),
      ...(row.media_id ? { mediaId: Number(row.media_id) } : {}),
    },
    supportsImageGame: Boolean(row.supports_image_game),
    imageSearchTerms: jsonValue<string[]>(row.image_search_terms_json, [row.word]),
  };
}

export class VocabularyRepository {
  constructor(private readonly audit = new AuditRepository()) {}

  async listTopics(query: Required<Pick<VocabularyPageQuery, "page" | "pageSize">> &
    Pick<VocabularyPageQuery, "search" | "ageBand">) {
    const where = ["t.status='ACTIVE'"];
    const params: unknown[] = [];
    if (query.search) {
      where.push("(t.title_vi LIKE ? OR t.slug LIKE ?)");
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.ageBand) {
      where.push(`EXISTS (
        SELECT 1 FROM vocabulary_topic_words age_word
        WHERE age_word.topic_id=t.id AND age_word.status='ACTIVE'
          AND JSON_CONTAINS(age_word.age_bands_json,JSON_QUOTE(?))
      )`);
      params.push(query.ageBand);
    }
    const filter = where.join(" AND ");
    const [countRows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      `SELECT COUNT(*) count FROM vocabulary_topics t WHERE ${filter}`,
      params,
    );
    const offset = (query.page - 1) * query.pageSize;
    const ageCountClause = query.ageBand
      ? "AND JSON_CONTAINS(w.age_bands_json,JSON_QUOTE(?))"
      : "";
    const listParams = query.ageBand
      ? [query.ageBand, query.ageBand, ...params, query.pageSize, offset]
      : [...params, query.pageSize, offset];
    const [rows] = await pool.query<TopicRow[]>(
      `SELECT t.id,t.slug,t.title_vi,t.description_vi,t.icon_key,
        SUM(CASE WHEN w.tier='CORE' ${ageCountClause} THEN 1 ELSE 0 END) core_word_count,
        SUM(CASE WHEN w.tier='EXTENDED' ${ageCountClause} THEN 1 ELSE 0 END) extended_word_count
       FROM vocabulary_topics t
       LEFT JOIN vocabulary_topic_words w ON w.topic_id=t.id AND w.status='ACTIVE'
       WHERE ${filter}
       GROUP BY t.id
       ORDER BY t.display_order
       LIMIT ? OFFSET ?`,
      listParams,
    );
    const topicIds = rows.map((row) => Number(row.id));
    const ageBands = new Map<number, Set<LearningAgeBand>>();
    if (topicIds.length) {
      const placeholders = topicIds.map(() => "?").join(",");
      const [ageRows] = await pool.query<Array<RowDataPacket & {
        topic_id: number;
        age_band: LearningAgeBand;
      }>>(
        `SELECT DISTINCT tw.topic_id,b.age_band
         FROM vocabulary_topic_words tw
         JOIN JSON_TABLE(tw.age_bands_json,'$[*]' COLUMNS(age_band VARCHAR(30) PATH '$')) b ON TRUE
         WHERE tw.topic_id IN (${placeholders}) AND tw.status='ACTIVE'`,
        topicIds,
      );
      for (const row of ageRows) {
        const set = ageBands.get(Number(row.topic_id)) ?? new Set<LearningAgeBand>();
        set.add(row.age_band);
        ageBands.set(Number(row.topic_id), set);
      }
    }
    return {
      items: rows.map((row): VocabularyTopicListItem => ({
        id: Number(row.id),
        slug: row.slug,
        titleVi: row.title_vi,
        descriptionVi: row.description_vi,
        iconKey: row.icon_key,
        ageBands: [...(ageBands.get(Number(row.id)) ?? [])],
        coreWordCount: Number(row.core_word_count),
        extendedWordCount: Number(row.extended_word_count),
      })),
      total: Number(countRows[0]?.count ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findTopic(slug: string, ageBand?: LearningAgeBand): Promise<VocabularyTopicDetail | null> {
    const [topics] = await pool.query<TopicRow[]>(
      `SELECT t.id,t.slug,t.title_vi,t.description_vi,t.icon_key,
        SUM(CASE WHEN w.tier='CORE' THEN 1 ELSE 0 END) core_word_count,
        SUM(CASE WHEN w.tier='EXTENDED' THEN 1 ELSE 0 END) extended_word_count
       FROM vocabulary_topics t
       LEFT JOIN vocabulary_topic_words w ON w.topic_id=t.id AND w.status='ACTIVE'
       WHERE t.slug=? AND t.status='ACTIVE' GROUP BY t.id`,
      [slug],
    );
    const topic = topics[0];
    if (!topic) return null;
    const params: unknown[] = [topic.id];
    const ageFilter = ageBand
      ? "AND JSON_CONTAINS(age_bands_json,JSON_QUOTE(?))"
      : "";
    if (ageBand) params.push(ageBand);
    const [words] = await pool.query<TopicWordRow[]>(
      `SELECT *,COALESCE(core_priority,extension_priority) priority
       FROM vocabulary_topic_words
       WHERE topic_id=? AND status='ACTIVE' ${ageFilter}
       ORDER BY FIELD(tier,'CORE','EXTENDED'),
         COALESCE(core_priority,extension_priority),id`,
      params,
    );
    const mappedWords = words.map(mapTopicWord);
    return {
      id: Number(topic.id),
      slug: topic.slug,
      titleVi: topic.title_vi,
      descriptionVi: topic.description_vi,
      iconKey: topic.icon_key,
      ageBands: [...new Set(mappedWords.flatMap((word) => word.ageBands))],
      coreWordCount: mappedWords.filter((word) => word.tier === "CORE").length,
      extendedWordCount: mappedWords.filter((word) => word.tier === "EXTENDED").length,
      words: mappedWords,
    };
  }

  async listSets(
    teacherUserId: number,
    query: Required<Pick<VocabularyPageQuery, "page" | "pageSize">> &
      Pick<VocabularyPageQuery, "search" | "ageBand">,
  ) {
    const where = ["s.teacher_user_id=?"];
    const params: unknown[] = [teacherUserId];
    if (query.search) {
      where.push("(s.title LIKE ? OR s.description LIKE ?)");
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.ageBand) {
      where.push("s.age_band=?");
      params.push(query.ageBand);
    }
    const filter = where.join(" AND ");
    const [countRows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      `SELECT COUNT(*) count FROM vocabulary_sets s WHERE ${filter}`,
      params,
    );
    const [rows] = await pool.query<SetRow[]>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM vocabulary_items i
         WHERE i.vocabulary_set_id=s.id AND i.status='ACTIVE') item_count
       FROM vocabulary_sets s WHERE ${filter}
       ORDER BY FIELD(s.status,'ACTIVE','ARCHIVED'),s.updated_at DESC,s.id DESC
       LIMIT ? OFFSET ?`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return {
      items: rows.map(mapSet),
      total: Number(countRows[0]?.count ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findSet(id: number, teacherUserId: number): Promise<VocabularySetDetail | null> {
    const [sets] = await pool.query<SetRow[]>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM vocabulary_items i
         WHERE i.vocabulary_set_id=s.id AND i.status='ACTIVE') item_count
       FROM vocabulary_sets s WHERE s.id=? AND s.teacher_user_id=?`,
      [id, teacherUserId],
    );
    if (!sets[0]) return null;
    const [items] = await pool.query<ItemRow[]>(
      `SELECT * FROM vocabulary_items
       WHERE vocabulary_set_id=? AND status='ACTIVE'
       ORDER BY display_order,id`,
      [id],
    );
    return { ...mapSet(sets[0]), items: items.map(mapItem) };
  }

  async create(
    input: PreparedVocabularySet,
    teacherUserId: number,
    action: AuditAction = "VOCABULARY_SET_CREATED",
  ): Promise<number> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const id = await this.insertSet(connection, input, teacherUserId);
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action,
        entityType: "VOCABULARY_SET",
        entityId: id,
        newValues: {
          title: input.title,
          sourceType: input.sourceType,
          ageBand: input.ageBand,
          itemCount: input.items.length,
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
    input: PreparedVocabularySet,
    teacherUserId: number,
  ): Promise<"UPDATED" | "NOT_FOUND" | "ARCHIVED"> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<SetRow[]>(
        "SELECT * FROM vocabulary_sets WHERE id=? AND teacher_user_id=? FOR UPDATE",
        [id, teacherUserId],
      );
      const existing = rows[0];
      if (!existing) {
        await connection.rollback();
        return "NOT_FOUND";
      }
      if (existing.status === "ARCHIVED") {
        await connection.rollback();
        return "ARCHIVED";
      }
      await connection.execute(
        `UPDATE vocabulary_sets
         SET title=?,description=?,age_band=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [input.title, input.description, input.ageBand, id],
      );
      const [activeRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
        "SELECT id FROM vocabulary_items WHERE vocabulary_set_id=? AND status='ACTIVE' FOR UPDATE",
        [id],
      );
      const activeIds = new Set(activeRows.map((row) => Number(row.id)));
      const retainedIds = new Set<number>();
      for (const item of input.items) {
        if (item.id != null && activeIds.has(item.id)) {
          retainedIds.add(item.id);
          await this.updateItem(connection, id, item);
        } else {
          await this.insertItem(connection, id, item);
        }
      }
      const archivedIds = [...activeIds].filter((itemId) => !retainedIds.has(itemId));
      if (archivedIds.length) {
        const placeholders = archivedIds.map(() => "?").join(",");
        await connection.execute(
          `UPDATE vocabulary_items SET status='ARCHIVED',archived_at=CURRENT_TIMESTAMP
           WHERE vocabulary_set_id=? AND id IN (${placeholders})`,
          [id, ...archivedIds],
        );
      }
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action: "VOCABULARY_SET_UPDATED",
        entityType: "VOCABULARY_SET",
        entityId: id,
        previousValues: { title: existing.title, ageBand: existing.age_band },
        newValues: {
          title: input.title,
          ageBand: input.ageBand,
          itemCount: input.items.length,
        },
      });
      await connection.commit();
      return "UPDATED";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async archive(
    id: number,
    teacherUserId: number,
  ): Promise<"ARCHIVED" | "NOT_FOUND" | "ALREADY_ARCHIVED"> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<SetRow[]>(
        "SELECT * FROM vocabulary_sets WHERE id=? AND teacher_user_id=? FOR UPDATE",
        [id, teacherUserId],
      );
      if (!rows[0]) {
        await connection.rollback();
        return "NOT_FOUND";
      }
      if (rows[0].status === "ARCHIVED") {
        await connection.rollback();
        return "ALREADY_ARCHIVED";
      }
      await connection.execute(
        `UPDATE vocabulary_sets
         SET status='ARCHIVED',archived_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [id],
      );
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action: "VOCABULARY_SET_ARCHIVED",
        entityType: "VOCABULARY_SET",
        entityId: id,
        previousValues: { status: "ACTIVE" },
        newValues: { status: "ARCHIVED" },
      });
      await connection.commit();
      return "ARCHIVED";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async duplicate(
    id: number,
    teacherUserId: number,
    title: string,
  ): Promise<number | null> {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [sets] = await connection.query<SetRow[]>(
        "SELECT * FROM vocabulary_sets WHERE id=? AND teacher_user_id=? FOR UPDATE",
        [id, teacherUserId],
      );
      if (!sets[0]) {
        await connection.rollback();
        return null;
      }
      const [items] = await connection.query<ItemRow[]>(
        `SELECT * FROM vocabulary_items
         WHERE vocabulary_set_id=? AND status='ACTIVE'
         ORDER BY display_order,id`,
        [id],
      );
      const copy: PreparedVocabularySet = {
        title,
        description: sets[0].description,
        sourceType: "COPIED",
        sourceReference: { copiedSetId: id },
        ageBand: sets[0].age_band,
        items: items.map((row) => ({
          sourceTopicWordId: row.source_topic_word_id ?? undefined,
          displayOrder: Number(row.display_order),
          word: row.word,
          normalizedWord: row.normalized_word,
          meaningVi: row.meaning_vi,
          normalizedMeaning: row.normalized_meaning,
          phonetic: row.phonetic,
          partOfSpeech: row.part_of_speech,
          exampleEn: row.example_en,
          speechText: row.speech_text,
          tier: row.tier,
          illustrationKind: row.illustration_kind,
          illustrationValue: row.illustration_value,
          mediaId: row.media_id,
          supportsImageGame: Boolean(row.supports_image_game),
          imageSearchTerms: jsonValue<string[]>(row.image_search_terms_json, [row.word]),
        })),
      };
      const copyId = await this.insertSet(connection, copy, teacherUserId);
      await this.audit.record(connection, {
        actorUserId: teacherUserId,
        action: "VOCABULARY_SET_DUPLICATED",
        entityType: "VOCABULARY_SET",
        entityId: copyId,
        newValues: { copiedSetId: id, itemCount: copy.items.length },
      });
      await connection.commit();
      return copyId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async insertSet(
    connection: PoolConnection,
    input: PreparedVocabularySet,
    teacherUserId: number,
  ): Promise<number> {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO vocabulary_sets
        (teacher_user_id,title,description,source_type,source_reference_json,age_band)
       VALUES (?,?,?,?,?,?)`,
      [
        teacherUserId,
        input.title,
        input.description,
        input.sourceType,
        input.sourceReference ? JSON.stringify(input.sourceReference) : null,
        input.ageBand,
      ],
    );
    for (const item of input.items)
      await this.insertItem(connection, result.insertId, item);
    return result.insertId;
  }

  private async insertItem(
    connection: PoolConnection,
    setId: number,
    item: PreparedVocabularyItem,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO vocabulary_items
        (vocabulary_set_id,source_topic_word_id,display_order,word,normalized_word,
         meaning_vi,normalized_meaning,phonetic,part_of_speech,example_en,speech_text,
         tier,illustration_kind,illustration_value,media_id,supports_image_game,
         image_search_terms_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        setId,
        item.sourceTopicWordId ?? null,
        item.displayOrder,
        item.word,
        item.normalizedWord,
        item.meaningVi,
        item.normalizedMeaning,
        item.phonetic,
        item.partOfSpeech,
        item.exampleEn,
        item.speechText,
        item.tier,
        item.illustrationKind,
        item.illustrationValue,
        item.mediaId,
        item.supportsImageGame ? 1 : 0,
        JSON.stringify(item.imageSearchTerms),
      ],
    );
  }

  private async updateItem(
    connection: PoolConnection,
    setId: number,
    item: PreparedVocabularyItem,
  ): Promise<void> {
    await connection.execute(
      `UPDATE vocabulary_items SET
        source_topic_word_id=?,display_order=?,word=?,normalized_word=?,
        meaning_vi=?,normalized_meaning=?,phonetic=?,part_of_speech=?,example_en=?,
        speech_text=?,tier=?,illustration_kind=?,illustration_value=?,media_id=?,
        supports_image_game=?,image_search_terms_json=?,updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND vocabulary_set_id=? AND status='ACTIVE'`,
      [
        item.sourceTopicWordId ?? null,
        item.displayOrder,
        item.word,
        item.normalizedWord,
        item.meaningVi,
        item.normalizedMeaning,
        item.phonetic,
        item.partOfSpeech,
        item.exampleEn,
        item.speechText,
        item.tier,
        item.illustrationKind,
        item.illustrationValue,
        item.mediaId,
        item.supportsImageGame ? 1 : 0,
        JSON.stringify(item.imageSearchTerms),
        item.id!,
        setId,
      ],
    );
  }
}
