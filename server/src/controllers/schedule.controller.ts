import type { Request, Response } from "express";
import type {
  BulkOccurrenceRequest,
  BulkSkipOccurrenceRequest,
  CreateRecurringScheduleRequest,
  ReconciliationState,
  RescheduleOccurrenceRequest,
  SkipOccurrenceRequest,
  TeacherBusySlotInput,
} from "@teacher/shared";
import { ScheduleService } from "../services/schedule.service";
import { addDays, todayInHoChiMinh } from "../utils/date";

export class ScheduleController {
  constructor(private readonly service: ScheduleService) {}

  occurrences = async (req: Request, res: Response) => {
    const to = text(req.query.to) ?? todayInHoChiMinh();
    res.json({ data: await this.service.occurrences({
      from: text(req.query.from) ?? addDays(to, -14),
      to,
      classId: integer(req.query.classId),
      state: text(req.query.state) as ReconciliationState | undefined,
      lookbackDays: integer(req.query.lookbackDays),
    }) });
  };
  createDraft = async (req: Request, res: Response) =>
    res.json({ data: await this.service.createDraft(String(req.params.key), req.auth!.id) });
  skip = async (req: Request, res: Response) =>
    res.json({ data: await this.service.skip(String(req.params.key), req.body as SkipOccurrenceRequest, req.auth!.id) });
  reschedule = async (req: Request, res: Response) =>
    res.json({ data: await this.service.reschedule(String(req.params.key), req.body as RescheduleOccurrenceRequest, req.auth!.id) });
  bulkCreateDrafts = async (req: Request, res: Response) =>
    res.json({ data: await this.service.bulkCreateDrafts(req.body as BulkOccurrenceRequest, req.auth!.id) });
  bulkSkip = async (req: Request, res: Response) =>
    res.json({ data: await this.service.bulkSkip(req.body as BulkSkipOccurrenceRequest, req.auth!.id) });

  unrecorded = async (req: Request, res: Response) =>
    res.json({ data: await this.service.unrecorded(Number(req.query.days ?? 14)) });
  week = async (req: Request, res: Response) =>
    res.json({ data: await this.service.week(text(req.query.from)) });
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

  listBusySlots = async (req: Request, res: Response) =>
    res.json({ data: await this.service.listBusySlots(text(req.query.from), text(req.query.to)) });
  createBusySlot = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.createBusySlot(req.body as TeacherBusySlotInput, req.auth!.id) });
  updateBusySlot = async (req: Request, res: Response) =>
    res.json({ data: await this.service.updateBusySlot(Number(req.params.id), req.body as TeacherBusySlotInput, req.auth!.id) });
  deleteBusySlot = async (req: Request, res: Response) => {
    await this.service.deleteBusySlot(Number(req.params.id), req.auth!.id);
    res.status(204).end();
  };
}

function text(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function integer(value: unknown): number | undefined { return typeof value === "string" ? Number(value) : undefined; }
