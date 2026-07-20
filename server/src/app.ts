import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/config";
import { errorHandler } from "./middleware/error-handler";
import { createRouter } from "./routes";
import { requestContext } from "./middleware/request-context";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(requestContext);
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
