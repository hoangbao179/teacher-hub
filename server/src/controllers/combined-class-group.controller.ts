import type { Request, Response } from "express";
import type {
  CompleteCombinedTeachingOccurrenceRequest,
  CreateCombinedClassGroupRequest,
  EndCombinedClassGroupRequest,
  UpdateCombinedClassGroupRequest,
} from "@teacher/shared";
import { CombinedClassGroupService } from "../services/combined-class-group.service";

export class CombinedClassGroupController {
  constructor(private readonly service: CombinedClassGroupService) {}

  list = async (_req: Request, res: Response) =>
    res.json({ data: await this.service.list() });

  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id)) });

  create = async (req: Request, res: Response) =>
    res.status(201).json({
      data: await this.service.create(
        req.body as CreateCombinedClassGroupRequest,
        req.auth!.id,
      ),
    });

  update = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.update(
        Number(req.params.id),
        req.body as UpdateCombinedClassGroupRequest,
        req.auth!.id,
      ),
    });

  end = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.end(
        Number(req.params.id),
        req.body as EndCombinedClassGroupRequest,
        req.auth!.id,
      ),
    });

  occurrenceDetail = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.occurrenceDetail(Number(req.params.id)),
    });

  completeOccurrence = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.completeOccurrence(
        Number(req.params.id),
        req.body as CompleteCombinedTeachingOccurrenceRequest,
        req.auth!.id,
      ),
    });
}
