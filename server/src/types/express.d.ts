import type { AuthUser } from "@teacher/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
