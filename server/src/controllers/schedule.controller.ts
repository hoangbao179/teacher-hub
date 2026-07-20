import type { Request, Response } from "express";
import { ScheduleService } from "../services/schedule.service";
import type { CreateRecurringScheduleRequest } from "@teacher/shared";

export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}
  unrecorded = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.unrecorded(Number(req.query.days ?? 14)),
    });
  week = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.week(
        typeof req.query.from === "string" ? req.query.from : undefined,
      ),
    });
  createRecurring = async (req: Request, res: Response) => {
    const id = await this.service.create(Number(req.params.id), req.body as CreateRecurringScheduleRequest, req.auth!.id);
    res.status(201).json({ data: { id } });
  };
  updateRecurring = async (req: Request, res: Response) => {
    await this.service.update(Number(req.params.id), req.body as CreateRecurringScheduleRequest, req.auth!.id);
    res.status(204).end();
  };
  deleteRecurring = async (req: Request, res: Response) => {
    await this.service.remove(Number(req.params.id), req.auth!.id);
    res.status(204).end();
  };
}
