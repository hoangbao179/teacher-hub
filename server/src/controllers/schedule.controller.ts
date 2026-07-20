import type { Request, Response } from "express";
import { ScheduleService } from "../services/schedule.service";

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
}
