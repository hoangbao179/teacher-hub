import type { Request, Response } from "express";
import type { LoginRequest } from "@teacher/shared";
import { AuthService } from "../services/auth.service";

export class AuthController {
  constructor(private readonly service: AuthService) {}
  login = async (req: Request, res: Response) => {
    const body = req.body as LoginRequest;
    res.json({
      data: await this.service.login(body.username ?? "", body.password ?? ""),
    });
  };
  me = async (req: Request, res: Response) => res.json({ data: await this.service.me(req.auth!.id) });
  logout = async (_req: Request, res: Response) => res.status(204).end();
}
