import type { Request, Response } from "express";
import type { MarkMonthlyTuitionPaidRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { TuitionService } from "../services/tuition.service";

export class TuitionController {
  constructor(private readonly service: TuitionService) {}

  monthlyBoard = async (req: Request, res: Response) => {
    const year = requiredInteger(req.query.year, "year");
    const month = requiredInteger(req.query.month, "month");
    res.json({ data: await this.service.monthlyBoard({
      year,
      month,
      classId: optionalInteger(req.query.classId, "classId"),
      search: text(req.query.search),
    }) });
  };

  markMonthlyPaid = async (req: Request, res: Response) => {
    const result = await this.service.markMonthlyPaid(
      requiredInteger(req.params.enrollmentId, "enrollmentId"),
      requiredInteger(req.params.year, "year"),
      requiredInteger(req.params.month, "month"),
      req.body as MarkMonthlyTuitionPaidRequest,
      req.auth!.id,
    );
    res.json({ data: result });
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requiredInteger(value: unknown, field: string): number {
  const result = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(result))
    throw new AppError(400, "VALIDATION_ERROR", `${field} phải là số nguyên.`);
  return result;
}

function optionalInteger(value: unknown, field: string): number | undefined {
  return value == null ? undefined : requiredInteger(value, field);
}
