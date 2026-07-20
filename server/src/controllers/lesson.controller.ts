import type { Request, Response } from "express";
import type {
  CancelLessonRequest,
  CompleteLessonRequest,
  CreateLessonRequest,
  UpdateLessonAttendancesRequest,
  UpdateLessonContentRequest,
  UpdateLessonParticipantsRequest,
  UpdateLessonRequest,
} from "@teacher/shared";
import { LessonService } from "../services/lesson.service";

export class LessonController {
  constructor(private readonly service: LessonService) {}

  create = async (req: Request, res: Response) => {
    const detail = await this.service.create(req.body as CreateLessonRequest, req.auth!.id);
    res.status(201).json({ data: detail });
  };

  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id)) });

  update = async (req: Request, res: Response) =>
    res.json({ data: await this.service.update(Number(req.params.id), req.body as UpdateLessonRequest, req.auth!.id) });

  updateParticipants = async (req: Request, res: Response) =>
    res.json({ data: await this.service.updateParticipants(Number(req.params.id), req.body as UpdateLessonParticipantsRequest, req.auth!.id) });

  updateAttendances = async (req: Request, res: Response) =>
    res.json({ data: await this.service.updateAttendances(Number(req.params.id), req.body as UpdateLessonAttendancesRequest, req.auth!.id) });

  updateContent = async (req: Request, res: Response) =>
    res.json({ data: await this.service.updateContent(Number(req.params.id), req.body as UpdateLessonContentRequest, req.auth!.id) });

  complete = async (req: Request, res: Response) =>
    res.json({ data: await this.service.complete(Number(req.params.id), req.body as CompleteLessonRequest, req.auth!.id) });

  cancel = async (req: Request, res: Response) => {
    await this.service.cancel(Number(req.params.id), req.body as CancelLessonRequest, req.auth!.id);
    res.status(204).end();
  };
}
