import type { Request, Response } from "express";
import type { CreateStudentGoogleSheetRequest } from "@teacher/shared";
import { StudentGoogleSheetService } from "../services/student-google-sheet.service";

export class StudentGoogleSheetController {
  constructor(private readonly service: StudentGoogleSheetService) {}
  get = async (req: Request, res: Response) => res.json({ data: await this.service.state(Number(req.params.studentId)) });
  create = async (req: Request, res: Response) => {
    const result = await this.service.create(Number(req.params.studentId), req.body as CreateStudentGoogleSheetRequest, req.auth!.id);
    res.status(result.sheet.status === "CREATING" ? 202 : result.reused ? 200 : 201).json({ data: result });
  };
  retry = async (req: Request, res: Response) => {
    const result = await this.service.retry(Number(req.params.studentId), req.auth!.id);
    res.status(result.sheet.status === "CREATING" ? 202 : 200).json({ data: result });
  };
  regenerate = async (req: Request, res: Response) =>
    res.json({ data: await this.service.regenerate(Number(req.params.studentId), req.auth!.id) });
  archive = async (req: Request, res: Response) =>
    res.json({ data: await this.service.archive(Number(req.params.studentId), req.auth!.id) });
  resync = async (req: Request, res: Response) =>
    res.json({ data: await this.service.resync(Number(req.params.studentId), req.auth!.id) });
}
