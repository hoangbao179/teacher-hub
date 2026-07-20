import type { Request, Response } from "express";
import { pool } from "../db/pool";

export class HealthController {
  health = (_req: Request, res: Response) =>
    res.json({ data: { status: "ok" } });
  ready = async (_req: Request, res: Response) => {
    await pool.query("SELECT 1");
    res.json({ data: { status: "ready" } });
  };
}
