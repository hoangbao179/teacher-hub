import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/config";
import { errorHandler } from "./middleware/error-handler";
import { createRouter } from "./routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin.split(",").map((item) => item.trim()),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(createRouter());
  app.use((_req, res) =>
    res
      .status(404)
      .json({
        error: { code: "NOT_FOUND", message: "Không tìm thấy endpoint." },
      }),
  );
  app.use(errorHandler);
  return app;
}
