import type { Request, Response } from "express";
import type {
  MarkTuitionPaidRequest,
  TuitionCycleListQuery,
  TuitionCycleSort,
  CreateAdvanceReceiptRequest,
  SettleIncompleteCycleRequest,
} from "@teacher/shared";
import { TuitionService } from "../services/tuition.service";

export class TuitionController {
  constructor(private readonly service: TuitionService) {}
  list = async (req: Request, res: Response) => {
    const query: TuitionCycleListQuery = {
      status: text(req.query.status) as TuitionCycleListQuery["status"],
      classId: integer(req.query.classId),
      studentId: integer(req.query.studentId),
      enrollmentId: integer(req.query.enrollmentId),
      search: text(req.query.search),
      from: text(req.query.from),
      to: text(req.query.to),
      sort: text(req.query.sort) as TuitionCycleSort | undefined,
      page: integer(req.query.page),
      pageSize: integer(req.query.pageSize),
    };
    const result = await this.service.list(query);
    res.json({ data: result.items, meta: {
      total: result.total, page: result.page, pageSize: result.pageSize,
    } });
  };
  summary = async (req: Request, res: Response) =>
    res.json({ data: await this.service.summary({
      from: text(req.query.from),
      to: text(req.query.to),
    }) });
  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id)) });
  markPaid = async (req: Request, res: Response) => {
    const result = await this.service.markPaid(
      Number(req.params.id),
      req.body as MarkTuitionPaidRequest,
      req.auth!.id,
    );
    res.json({ data: result });
  };
  listReceipts = async (req: Request, res: Response) =>
    res.json({ data: await this.service.listReceipts(Number(req.params.id)) });
  createAdvanceReceipt = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.createAdvanceReceipt(
      Number(req.params.id), req.body as CreateAdvanceReceiptRequest, req.auth!.id,
    ) });
  settleIncomplete = async (req: Request, res: Response) =>
    res.json({ data: await this.service.settleIncomplete(
      Number(req.params.id), req.body as SettleIncompleteCycleRequest, req.auth!.id,
    ) });
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function integer(value: unknown): number | undefined {
  return typeof value === "string" ? Number(value) : undefined;
}
