import { randomUUID } from "node:crypto";
import type { GoogleSheetSyncSettings } from "../config/google-sheet-sync-settings";
import { GoogleIntegrationError, classifyGoogleError } from "../integrations/google/google-integration.errors";
import type { GoogleSheetProvider } from "../integrations/google/google-integration.types";
import { GoogleSheetSyncRepository, type GoogleSheetSyncEvent } from "../repositories/google-sheet-sync.repository";
import { StudentGoogleSheetRepository } from "../repositories/student-google-sheet.repository";

export function googleSyncBackoffMs(attempt: number): number {
  const fixed = [60_000, 300_000, 900_000, 3_600_000];
  if (attempt < fixed.length) return fixed[attempt];
  return Math.min(24 * 3_600_000, 3_600_000 * 2 ** Math.min(5, attempt - 3));
}

export class GoogleSheetSyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;
  private running = false;
  readonly instanceId = `google-sheet-sync-${process.pid}-${randomUUID()}`;

  constructor(
    private readonly outbox: GoogleSheetSyncRepository,
    private readonly sheets: StudentGoogleSheetRepository,
    private readonly provider: GoogleSheetProvider | null,
    private readonly settings: GoogleSheetSyncSettings,
    private readonly driveEnabled: boolean,
  ) {}

  get enabled(): boolean {
    return this.driveEnabled && this.settings.enabled && this.provider != null;
  }

  start(): void {
    if (!this.enabled || this.running) return;
    this.stopping = false;
    this.running = true;
    void this.loop();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.running = false;
    }
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  async runOnce(): Promise<number> {
    if (!this.enabled || !this.provider) return 0;
    const events = await this.outbox.claimBatch(
      this.settings.batchSize,
      this.settings.lockTimeoutMs,
      this.instanceId,
    );
    for (const event of events) await this.process(event);
    return events.length;
  }

  private async loop(): Promise<void> {
    try {
      await this.runOnce();
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "google_sheet_sync_worker_failed",
        error: error instanceof Error ? error.name : "UnknownError",
      }));
    }
    if (this.stopping) {
      this.running = false;
      return;
    }
    this.timer = setTimeout(() => void this.loop(), this.settings.intervalMs);
    this.timer.unref();
  }

  private async process(event: GoogleSheetSyncEvent): Promise<void> {
    if (!this.provider) return;
    try {
      const sheet = await this.sheets.get(event.studentId);
      if (!sheet || sheet.status !== "ACTIVE")
        throw new GoogleIntegrationError("SPREADSHEET_MISSING", "Học sinh không còn Google Sheet đang hoạt động.", false);
      const resource = await this.provider.findByRecordId(sheet.id);
      if (!resource) throw new GoogleIntegrationError("SPREADSHEET_MISSING", "Không tìm thấy Google Sheet đã liên kết.", false);
      const snapshot = await this.sheets.snapshot(event.studentId);
      const syncedAt = new Date().toISOString();
      if (event.eventType === "VOCABULARY_ATTEMPT_UPSERT") {
        await this.provider.render(resource, snapshot, {
          templateVersion: sheet.templateVersion,
          recordId: sheet.id,
          generatedAt: sheet.lastGeneratedAt ?? syncedAt,
          syncedAt,
        });
        await this.outbox.succeed(event, syncedAt);
        return;
      }
      const row = event.eventType === "LESSON_REMOVE"
        ? null
        : snapshot.learning.find((item) => item.lessonId === event.lessonId) ?? null;
      await this.provider.syncLesson(resource, row, {
        ...snapshot.overview,
        currentClass: snapshot.student.currentClass,
        currentGrade: snapshot.student.currentGrade,
        currentAcademicYear: snapshot.student.currentAcademicYear,
      }, event.lessonId!, syncedAt);
      await this.outbox.succeed(event, syncedAt);
    } catch (error) {
      const classified = classifyGoogleError(error);
      await this.outbox.fail(
        event,
        classified.failureCode,
        classified.message,
        classified.retryable,
        this.settings.maxAttempts,
        googleSyncBackoffMs(event.attemptCount),
      );
    }
  }
}
