import type { Request, Response } from "express";
import type { StudentReportExportQuery } from "@teacher/shared";
import { StudentReportService } from "../services/student-report.service";

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export class StudentReportController {
  constructor(private readonly service: StudentReportService) {}

  export = async (req: Request, res: Response) => {
    const classIdText = text(req.query.classId);
    const query: StudentReportExportQuery = {
      fromDate: text(req.query.fromDate),
      toDate: text(req.query.toDate),
      classId: classIdText == null ? undefined : Number(classIdText),
    };
    const result = await this.service.export(Number(req.params.studentId), query, req.auth!.id);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(result.buffer);
  };
}

