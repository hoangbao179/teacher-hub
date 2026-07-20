import type { Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service";
export class DashboardController {
  constructor(private readonly service: DashboardService) {}
  get = async (_req: Request, res: Response) =>
    res.json({ data: await this.service.get() });
}
