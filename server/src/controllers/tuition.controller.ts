import type { Request, Response } from "express";
import type { MarkTuitionPaidRequest } from "@teacher/shared";
import { TuitionService } from "../services/tuition.service";

export class TuitionController {
  constructor(private readonly service: TuitionService) {}
  list = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.list(
        typeof req.query.status === "string" ? req.query.status : undefined,
      ),
    });
  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id)) });
  markPaid = async (req: Request, res: Response) => {
    await this.service.markPaid(
      Number(req.params.id),
      req.body as MarkTuitionPaidRequest,
    );
    res.status(204).end();
  };
}
