import type { Request, Response } from "express";
import type {
  CompleteLessonRequest,
  CreateLessonRequest,
} from "@teacher/shared";
import { LessonService } from "../services/lesson.service";

export class LessonController {
  constructor(private readonly service: LessonService) {}
  create = async (req: Request, res: Response) => {
    const id = await this.service.create(req.body as CreateLessonRequest);
    res.status(201).json({ data: { id } });
  };
  complete = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.complete(
        Number(req.params.id),
        req.body as CompleteLessonRequest,
      ),
    });
}
