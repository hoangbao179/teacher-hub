import { createPdfRuntime } from "./services/pdf-runtime";
import { PublicPdfController } from "./controllers/public-pdf.controller";

export const publicPdfController = new PublicPdfController(createPdfRuntime());
