import type { Request, Response } from "express";
import type { ChangeEnrollmentStatusRequest, ChangeTuitionExemptionRequest, CreateEnrollmentRequest, EndEnrollmentRequest, TransferEnrollmentRequest } from "@teacher/shared";
import { EnrollmentService } from "../services/enrollment.service";

export class EnrollmentController {
  constructor(private readonly service: EnrollmentService) {}
  create = async (req: Request, res: Response) => {
    const id = await this.service.create(Number(req.params.id), req.body as CreateEnrollmentRequest, req.auth!.id);
    res.status(201).json({ data: { id } });
  };
  pause = async (req: Request, res: Response) => { await this.service.pause(Number(req.params.id), req.body as ChangeEnrollmentStatusRequest, req.auth!.id); res.status(204).end(); };
  resume = async (req: Request, res: Response) => { await this.service.resume(Number(req.params.id), req.body as ChangeEnrollmentStatusRequest, req.auth!.id); res.status(204).end(); };
  end = async (req: Request, res: Response) => { await this.service.end(Number(req.params.id), req.body as EndEnrollmentRequest, req.auth!.id); res.status(204).end(); };
  transfer = async (req: Request, res: Response) => res.status(201).json({ data:
    await this.service.transfer(Number(req.params.id), req.body as TransferEnrollmentRequest, req.auth!.id) });
  changeTuitionExemption = async (req: Request, res: Response) => { await this.service.changeTuitionExemption(Number(req.params.id), req.body as ChangeTuitionExemptionRequest, req.auth!.id); res.status(204).end(); };
}
