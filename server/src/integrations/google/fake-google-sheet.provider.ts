import { GoogleSheetTemplateService } from "./google-sheet-template.service";
import type { CreateManagedSpreadsheetInput, GoogleSheetProvider, ManagedSpreadsheet, StudentGoogleSheetSnapshot } from "./google-integration.types";

export class FakeGoogleSheetProvider implements GoogleSheetProvider {
  readonly resources = new Map<number, ManagedSpreadsheet>();
  readonly rendered: Array<{ resource: ManagedSpreadsheet; snapshot: StudentGoogleSheetSnapshot }> = [];
  readonly trashed: string[] = [];
  createCount = 0;
  lastCreateInput: CreateManagedSpreadsheetInput | null = null;
  failure: "NETWORK" | "AUTH" | null = null;
  failOnce = false;
  delayMs = 0;
  timeoutAfterCreate = false;
  private readonly template = new GoogleSheetTemplateService();

  async assertReady(): Promise<void> {
    if (this.failure === "AUTH") throw Object.assign(new Error("invalid_grant"), { code: 401 });
  }
  async findByRecordId(recordId: number): Promise<ManagedSpreadsheet | null> { return this.resources.get(recordId) ?? null; }
  async create(input: CreateManagedSpreadsheetInput): Promise<ManagedSpreadsheet> {
    this.createCount += 1;
    this.lastCreateInput = input;
    if (this.failure === "NETWORK") { if (this.failOnce) this.failure = null; throw new Error("network timeout"); }
    const recordId = Number(input.appProperties.studentGoogleSheetRecordId);
    const resource = { spreadsheetId: `fake-sheet-${recordId}`, name: input.name,
      webViewUrl: `https://docs.google.com/spreadsheets/d/fake-sheet-${recordId}/edit` };
    this.resources.set(recordId, resource);
    if (this.timeoutAfterCreate) { this.timeoutAfterCreate = false; throw new Error("network timeout after create"); }
    return resource;
  }
  async render(resource: ManagedSpreadsheet, snapshot: StudentGoogleSheetSnapshot, metadata: {
    templateVersion: string; recordId: number; generatedAt: string; syncedAt?: string | null;
  }): Promise<void> {
    if (this.failure === "NETWORK") throw new Error("network timeout");
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.template.build(snapshot, resource.spreadsheetId,
      { "Tổng quan": 1, "Nhật ký học tập": 2, "Học phí": 3, _TeacherHub: 4 }, metadata);
    this.rendered.push({ resource, snapshot });
  }
  async trash(spreadsheetId: string): Promise<void> { this.trashed.push(spreadsheetId); }
}
