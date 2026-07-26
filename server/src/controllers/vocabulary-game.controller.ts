import type { Request, Response } from "express";
import type { SubmitLearningAnswerRequest } from "@teacher/shared";
import { VocabularyGameService } from "../services/vocabulary-game.service";

export class VocabularyGameController {
  constructor(private readonly service: VocabularyGameService) {}

  summary = async (req: Request, res: Response) =>
    res.json({ data: await this.service.summary(String(req.params.publicCode)) });

  access = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.access(
      String(req.params.publicCode),
      req.body?.accessToken,
      req.body?.guestName,
    ) });

  start = async (req: Request, res: Response) =>
    res.status(201).json({ data: await this.service.start(
      String(req.params.publicCode),
      req.body?.sessionToken,
    ) });

  attempt = async (req: Request, res: Response) =>
    res.json({ data: await this.service.attempt(String(req.params.sessionToken)) });

  answer = async (req: Request, res: Response) =>
    res.json({ data: await this.service.answer(
      String(req.params.sessionToken),
      req.body as SubmitLearningAnswerRequest,
    ) });

  complete = async (req: Request, res: Response) =>
    res.json({ data: await this.service.complete(String(req.params.sessionToken)) });
}
