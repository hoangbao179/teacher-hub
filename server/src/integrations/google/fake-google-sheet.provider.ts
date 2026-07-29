import { GoogleSheetTemplateService } from "./google-sheet-template.service";
import type { CreateManagedSpreadsheetInput, GoogleSheetProvider, ManagedSpreadsheet, StudentGoogleSheetSnapshot } from "./google-integration.types";

export class FakeGoogleSheetProvider implements GoogleSheetProvider {
  readonly resources = new Map<number, ManagedSpreadsheet>();
  readonly rendered: Array<{ resource: ManagedSpreadsheet; snapshot: StudentGoogleSheetSnapshot }> = [];
  readonly trashed: string[] = [];
  readonly synced: Array<{ resource: ManagedSpreadsheet; lessonId: number; row: StudentGoogleSheetSnapshot["learning"][number] | null }> = [];
  readonly learningRows = new Map<string, StudentGoogleSheetSnapshot["learning"][number]>();
  readonly vocabularyRows = new Map<string, StudentGoogleSheetSnapshot["vocabularyAttempts"][number]>();
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
  async rename(resource: ManagedSpreadsheet, name: string): Promise<ManagedSpreadsheet> {
    const renamed = { ...resource, name };
    for (const [recordId, candidate] of this.resources)
      if (candidate.spreadsheetId === resource.spreadsheetId) this.resources.set(recordId, renamed);
    return renamed;
  }
  async render(resource: ManagedSpreadsheet, snapshot: StudentGoogleSheetSnapshot, metadata: {
    templateVersion: string; recordId: number; generatedAt: string; syncedAt?: string | null;
  }): Promise<void> {
    if (this.failure === "NETWORK") throw new Error("network timeout");
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.template.build(snapshot, resource.spreadsheetId,
      {
        "Quá trình học tập": 2,
        "Học phí": 3,
        _TeacherHub: 5,
      }, metadata);
    this.rendered.push({ resource, snapshot });
    for (const row of snapshot.learning) this.learningRows.set(`${resource.spreadsheetId}:${row.lessonId}`, row);
  }
  async syncLesson(
    resource: ManagedSpreadsheet,
    row: StudentGoogleSheetSnapshot["learning"][number] | null,
    _overview: StudentGoogleSheetSnapshot["overview"] & {
      currentClass: string; currentGrade: string; currentAcademicYear: string;
    },
    lessonId: number,
  ): Promise<void> {
    if (this.failure === "NETWORK") throw new Error("network timeout");
    if (this.failure === "AUTH") throw Object.assign(new Error("permission denied"), { code: 403 });
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    const key = `${resource.spreadsheetId}:${lessonId}`;
    if (row) this.learningRows.set(key, row); else this.learningRows.delete(key);
    this.synced.push({ resource, lessonId, row });
  }
  async syncVocabularyAttempt(
    _resource: ManagedSpreadsheet,
    _row: StudentGoogleSheetSnapshot["vocabularyAttempts"][number],
    _attemptId: number,
  ): Promise<void> {
    if (this.failure === "NETWORK") throw new Error("network timeout");
    if (this.failure === "AUTH") throw Object.assign(new Error("permission denied"), { code: 403 });
  }
  async trash(spreadsheetId: string): Promise<void> { this.trashed.push(spreadsheetId); }
}
