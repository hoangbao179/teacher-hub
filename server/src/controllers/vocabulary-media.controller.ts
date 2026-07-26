import type {
  ImportVocabularyMediaRequest,
  VocabularyImageMediaType,
  VocabularyImageOrientation,
} from "@teacher/shared";
import type { Request, Response } from "express";
import { VocabularyMediaService } from "../services/vocabulary-media.service";

export class VocabularyMediaController {
  constructor(private readonly service: VocabularyMediaService) {}

  status = async (_req: Request, res: Response) =>
    res.json({ data: this.service.providerStatus() });

  search = async (req: Request, res: Response) =>
    res.json({
      data: await this.service.search({
        query: typeof req.query.query === "string" ? req.query.query : "",
        page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
        pageSize: typeof req.query.pageSize === "string"
          ? Number(req.query.pageSize)
          : undefined,
        mediaType: typeof req.query.mediaType === "string"
          ? req.query.mediaType as VocabularyImageMediaType
          : undefined,
        orientation: typeof req.query.orientation === "string"
          ? req.query.orientation as VocabularyImageOrientation
          : undefined,
      }),
    });

  import = async (req: Request, res: Response) =>
    res.status(201).json({
      data: await this.service.importMedia(
        req.body as ImportVocabularyMediaRequest,
        req.auth!.id,
      ),
    });

  serve = async (req: Request, res: Response) => {
    const file = await this.service.mediaFile(
      Number(req.params.mediaId),
      typeof req.query.variant === "string" ? req.query.variant : undefined,
    );
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(file.path);
  };
}
