import type {
  AssignmentRecipientResult,
  AssignmentResultListQuery,
  CreateVocabularyReviewDraftRequest,
  VocabularyMasteryStatus,
} from "@teacher/shared";
import type { Request, Response } from "express";
import { VocabularyResultsService } from "../services/vocabulary-results.service";

export class VocabularyResultsController {
  constructor(private readonly service: VocabularyResultsService) {}

  private query(req: Request): AssignmentResultListQuery {
    return {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      mastery: typeof req.query.mastery === "string"
        ? req.query.mastery as VocabularyMasteryStatus : undefined,
      status: typeof req.query.status === "string"
        ? req.query.status as AssignmentRecipientResult["status"] : undefined,
      sort: typeof req.query.sort === "string"
        ? req.query.sort as AssignmentResultListQuery["sort"] : undefined,
      direction: typeof req.query.direction === "string"
        ? req.query.direction as AssignmentResultListQuery["direction"] : undefined,
      page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
      pageSize: typeof req.query.pageSize === "string" ? Number(req.query.pageSize) : undefined,
    };
  }

  summary = async (req: Request, res: Response) =>
    res.json({ data: await this.service.summary(Number(req.params.id), req.auth!.id) });

  recipients = async (req: Request, res: Response) => {
    const result = await this.service.recipientsList(
      Number(req.params.id), this.query(req), req.auth!.id);
    res.json({ data: result.items, meta: {
      total: result.total, page: result.page, pageSize: result.pageSize,
    } });
  };

  vocabulary = async (req: Request, res: Response) => {
    const result = await this.service.vocabularyList(
      Number(req.params.id), this.query(req), req.auth!.id);
    res.json({ data: result.items, meta: {
      total: result.total, page: result.page, pageSize: result.pageSize,
    } });
  };

  recipient = async (req: Request, res: Response) =>
    res.json({ data: await this.service.recipientDetail(
      Number(req.params.id), Number(req.params.recipientId), req.auth!.id) });

  reviewDraft = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.createReviewDraft(
      Number(req.params.id), req.body as CreateVocabularyReviewDraftRequest, req.auth!.id) });
}
