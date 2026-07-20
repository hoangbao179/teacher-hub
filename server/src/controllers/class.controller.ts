import type { Request, Response } from "express";
import type { CreateClassRequest, UpdateClassRequest } from "@teacher/shared";
import { ClassService } from "../services/class.service";
import { LessonService } from "../services/lesson.service";

export class ClassController {
  constructor(
    private readonly service: ClassService,
    private readonly lessons: LessonService,
  ) {}
  list = async (_req: Request, res: Response) =>
    res.json({ data: await this.service.list() });
  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id)) });
  create = async (req: Request, res: Response) => {
    const id = await this.service.create(req.body as CreateClassRequest);
    res.status(201).json({ data: { id } });
  };
  update = async (req: Request, res: Response) => {
    await this.service.update(Number(req.params.id), req.body as UpdateClassRequest);
    res.status(204).end();
  };
  pause = async (req: Request, res: Response) => {
    await this.service.setStatus(Number(req.params.id), "PAUSED");
    res.status(204).end();
  };
  resume = async (req: Request, res: Response) => {
    await this.service.setStatus(Number(req.params.id), "ACTIVE");
    res.status(204).end();
  };
  close = async (req: Request, res: Response) => {
    await this.service.setStatus(Number(req.params.id), "CLOSED");
    res.status(204).end();
  };
  lessonsByClass = async (req: Request, res: Response) =>
    res.json({ data: await this.lessons.listByClass(Number(req.params.id)) });
}
