import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import type { PdfService } from "../services/pdf.service";
import { PdfGuestRepository, type PdfGuest } from "../repositories/pdf-guest.repository";
import { pdfError, uuid } from "../services/pdf-validation";
import { config } from "../config/config";
import { PdfController } from "./pdf.controller";

const COOKIE = "teacher_pdf_guest";
function token(req: Request): string | null {
  const found = (req.header("cookie") ?? "").split(";").map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+"="));
  return found.length === 1 ? found[0].slice(COOKIE.length+1) : null;
}
function origin(req: Request): void {
  if (req.header("origin") !== config.publicAppOrigin) throw pdfError(403,"PDF_ORIGIN_FORBIDDEN");
}
function scopedKey(guest:PdfGuest,input:unknown):string {
  if (!uuid(input)) throw pdfError(400,"PDF_INVALID_REQUEST");
  const hex=createHash("sha256").update("public-pdf:"+guest.id+":"+input).digest("hex").slice(0,32).split("");
  hex[12]="4"; hex[16]="89ab"[parseInt(hex[16],16)%4];
  const v=hex.join("");
  return v.slice(0,8)+"-"+v.slice(8,12)+"-"+v.slice(12,16)+"-"+v.slice(16,20)+"-"+v.slice(20);
}
export class PublicPdfController {
  private readonly streaming: PdfController;
  constructor(private service: PdfService, private repository = new PdfGuestRepository()) {
    this.streaming = new PdfController(service);
  }
  capabilities = async (_req:Request,res:Response) => res.json({data:await this.service.capabilities()});
  session = async (req:Request,res:Response) => {
    origin(req);
    if (!(await this.service.capabilities()).submitEnabled) throw pdfError(503,"PDF_SERVICE_UNAVAILABLE");
    const current = await this.repository.find(token(req));
    if (!current) {
      const issued = await this.repository.issue();
      res.cookie(COOKIE,issued.token,{httpOnly:true,secure:config.nodeEnv==="production",sameSite:"strict",
        path:"/api/public/pdf",maxAge:180*86400000});
    }
    res.json({data:{available:true}});
  };
  private async requireGuest(req:Request):Promise<PdfGuest> {
    const guest = await this.repository.find(token(req));
    if (!guest) throw pdfError(401,"PDF_GUEST_SESSION_REQUIRED");
    return guest;
  }
  list = async (req:Request,res:Response) => {
    res.json({data:await this.repository.publicList(req.query.page)});
  };
  create = async (req:Request,res:Response) => {
    origin(req);
    const guest = await this.requireGuest(req);
    const batch = await this.service.create(guest.owner,scopedKey(guest,req.header("Idempotency-Key")),req.body);
    await this.repository.attach(guest,batch.id);
    res.status(201).json({data:batch});
  };
  detail = async (req:Request,res:Response) => {
    const id=String(req.params.id),guest=await this.repository.publicBatch(id);
    res.json({data:await this.service.detail(guest.owner,id)});
  };
  retry = async (req:Request,res:Response) => {
    origin(req);
    const id=String(req.params.id),guest=await this.repository.publicJob(id);
    res.status(201).json({data:await this.service.retry(guest.owner,id,scopedKey(guest,req.header("Idempotency-Key")))});
  };
  ticket = async (req:Request,res:Response) => {
    origin(req);
    const id=String(req.params.id),guest=await this.repository.publicJob(id);
    const grant=await this.service.ticket(guest.owner,id);
    res.json({data:{...grant,downloadPath:grant.downloadPath.replace("/api/pdf/","/api/public/pdf/")}});
  };
  download = async (req:Request,res:Response) => {
    origin(req);
    const id=String(req.params.id),guest=await this.repository.publicJob(id);
    const previous = req.auth;
    req.auth = {id:guest.owner,role:"TEACHER"} as typeof req.auth;
    try { await this.streaming.download(req,res); }
    finally { req.auth = previous; }
  };
}
