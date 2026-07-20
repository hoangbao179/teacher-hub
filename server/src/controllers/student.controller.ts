import type { Request, Response } from "express";
import type {
  CreateStudentRequest,
  UpdateStudentRequest,
} from "@teacher/shared";
import { StudentService } from "../services/student.service";

export class StudentController {
  constructor(private readonly service: StudentService) {}
  list = async (_req: Request, res: Response) =>
    res.json({ data: await this.service.list() });
  detail = async (req: Request, res: Response) =>
    res.json({ data: await this.service.detail(Number(req.params.id)) });
  create = async (req: Request, res: Response) => {
    const id = await this.service.create(req.body as CreateStudentRequest);
    res.status(201).json({ data: { id } });
  };
  update = async (req: Request, res: Response) => {
    await this.service.update(Number(req.params.id), req.body as UpdateStudentRequest);
    res.status(204).end();
  };
}
