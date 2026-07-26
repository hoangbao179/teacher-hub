import type {
  AssignmentAudienceType,
  AssignmentStatus,
  CreateAssignmentDraftRequest,
  LearningAgeBand,
  UpdateAssignmentDraftRequest,
} from "@teacher/shared";
import type { Request, Response } from "express";
import { AssignmentService } from "../services/assignment.service";

export class AssignmentController {
  constructor(private readonly service: AssignmentService) {}

  list = async (req: Request, res: Response) => {
    const result = await this.service.list({
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      status: typeof req.query.status === "string" ? req.query.status as AssignmentStatus : undefined,
      audienceType: typeof req.query.audienceType === "string"
        ? req.query.audienceType as AssignmentAudienceType : undefined,
      ageBand: typeof req.query.ageBand === "string" ? req.query.ageBand as LearningAgeBand : undefined,
      page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
      pageSize: typeof req.query.pageSize === "string" ? Number(req.query.pageSize) : undefined,
    }, req.auth!.id);
    res.json({
      data: result.items,
      meta: { total: result.total, page: result.page, pageSize: result.pageSize },
    });
  };

  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id), req.auth!.id) });
  create = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.create(
      req.body as CreateAssignmentDraftRequest, req.auth!.id) });
  update = async (req: Request, res: Response) =>
    res.json({ data: await this.service.update(
      Number(req.params.id), req.body as UpdateAssignmentDraftRequest, req.auth!.id) });
  preview = async (req: Request, res: Response) =>
    res.json({ data: await this.service.preview(Number(req.params.id), req.auth!.id) });
  publish = async (req: Request, res: Response) =>
    res.json({ data: await this.service.publish(
      Number(req.params.id), Number(req.body?.version), req.auth!.id) });
  duplicate = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.duplicate(
      Number(req.params.id),
      typeof req.body?.title === "string" ? req.body.title : undefined,
      req.auth!.id,
    ) });
  close = async (req: Request, res: Response) => {
    await this.service.close(Number(req.params.id), req.auth!.id);
    res.status(204).end();
  };
  dueDate = async (req: Request, res: Response) =>
    res.json({ data: await this.service.changeDueDate(
      Number(req.params.id),
      req.body?.dueAt == null ? null : String(req.body.dueAt),
      req.auth!.id,
    ) });
  recipients = async (req: Request, res: Response) =>
    res.json({ data: await this.service.recipients(Number(req.params.id), req.auth!.id) });
  regenerateAccess = async (req: Request, res: Response) =>
    res.json({ data: await this.service.regenerateAccess(
      Number(req.params.id),
      req.body?.recipientId == null ? undefined : Number(req.body.recipientId),
      req.auth!.id,
    ) });
  revokeAccess = async (req: Request, res: Response) => {
    await this.service.revokeAccess(
      Number(req.params.id),
      req.body?.recipientId == null ? undefined : Number(req.body.recipientId),
      req.auth!.id,
    );
    res.status(204).end();
  };
}
