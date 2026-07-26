import type {
  CreateVocabularySetRequest,
  DuplicateVocabularySetRequest,
  ImportPublicUnitSnapshotRequest,
  LearningAgeBand,
  UpdateVocabularySetRequest,
  VocabularyPageQuery,
  VocabularyTopicSuggestionRequest,
} from "@teacher/shared";
import type { Request, Response } from "express";
import { VocabularyService } from "../services/vocabulary.service";

function pageQuery(req: Request): VocabularyPageQuery {
  return {
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    ageBand: typeof req.query.ageBand === "string"
      ? req.query.ageBand as LearningAgeBand
      : undefined,
    page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
    pageSize: typeof req.query.pageSize === "string"
      ? Number(req.query.pageSize)
      : undefined,
  };
}

export class VocabularyController {
  constructor(private readonly service: VocabularyService) {}

  listTopics = async (req: Request, res: Response) => {
    const result = await this.service.listTopics(pageQuery(req));
    res.json({
      data: result.items,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  };

  topicDetail = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.topicDetail(
        String(req.params.slug),
        typeof req.query.ageBand === "string"
          ? req.query.ageBand as LearningAgeBand
          : undefined,
      ),
    });

  suggest = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.suggest(req.body as VocabularyTopicSuggestionRequest),
    });

  listSets = async (req: Request, res: Response) => {
    const result = await this.service.listSets(req.auth!.id, pageQuery(req));
    res.json({
      data: result.items,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  };

  setDetail = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.setDetail(Number(req.params.id), req.auth!.id),
    });

  createSet = async (req: Request, res: Response) => {
    const id = await this.service.create(
      req.body as CreateVocabularySetRequest,
      req.auth!.id,
    );
    res.status(201).json({ data: await this.service.setDetail(id, req.auth!.id) });
  };

  updateSet = async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await this.service.update(
      id,
      req.body as UpdateVocabularySetRequest,
      req.auth!.id,
    );
    res.json({ data: await this.service.setDetail(id, req.auth!.id) });
  };

  duplicateSet = async (req: Request, res: Response) => {
    const id = await this.service.duplicate(
      Number(req.params.id),
      req.body as DuplicateVocabularySetRequest,
      req.auth!.id,
    );
    res.status(201).json({ data: await this.service.setDetail(id, req.auth!.id) });
  };

  archiveSet = async (req: Request, res: Response) => {
    await this.service.archive(Number(req.params.id), req.auth!.id);
    res.status(204).end();
  };

  importPublicUnit = async (req: Request, res: Response) => {
    const id = await this.service.importPublicUnit(
      req.body as ImportPublicUnitSnapshotRequest,
      req.auth!.id,
    );
    res.status(201).json({ data: await this.service.setDetail(id, req.auth!.id) });
  };
}
