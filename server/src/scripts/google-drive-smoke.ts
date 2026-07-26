import "dotenv/config";
import { config } from "../config/config";
import { GoogleApiSheetProvider } from "../integrations/google/google-sheet.provider";
import type { StudentGoogleSheetSnapshot } from "../integrations/google/google-integration.types";

async function main(): Promise<void> {
if (process.env.GOOGLE_DRIVE_SMOKE !== "1") throw new Error("Smoke bị khóa. Đặt GOOGLE_DRIVE_SMOKE=1 để chạy chủ động.");
if (!config.googleDrive.enabled) throw new Error("GOOGLE_DRIVE_ENABLED phải là true.");
const provider = new GoogleApiSheetProvider(config.googleDrive);
const recordId = Date.now();
const fake: StudentGoogleSheetSnapshot = {
  student: { id: 0, fullName: "Học sinh kiểm thử không có thật", currentClass: "Lớp kiểm thử", currentGrade: "Khối 6", currentAcademicYear: "2026–2027" },
  overview: { currentProgress: 1, attendanceRate: 100, latestLesson: "2026-07-26", tuitionStatus: "Đang tích lũy",
    latestComment: "Dữ liệu giả", latestHomework: "Bài tập giả", teacher: "Cô Vy" },
  learning: [{ lessonId: 0, academicYear: "2026–2027", grade: "Khối 6", className: "Lớp kiểm thử", date: "2026-07-26",
    time: "18:00–19:30", attendance: "PRESENT", billable: true, cycleSequence: 1, content: "Dữ liệu giả", homework: "Dữ liệu giả",
    generalComment: "", studentComment: "Dữ liệu giả", updatedAt: new Date().toISOString() }],
  tuition: [],
  vocabularyAttempts: [],
};
let spreadsheetId = "";
try {
  await provider.assertReady(config.googleDrive.rootFolderId);
  const resource = await provider.create({ name: `Teacher Hub smoke ${new Date().toISOString()}`, rootFolderId: config.googleDrive.rootFolderId,
    appProperties: { teacherHubManaged: "true", studentId: "0", studentGoogleSheetRecordId: String(recordId),
      templateVersion: config.googleDrive.templateVersion, smokeTest: "true" } });
  spreadsheetId = resource.spreadsheetId;
  await provider.render(resource, fake, { templateVersion: config.googleDrive.templateVersion, recordId, generatedAt: new Date().toISOString() });
  const recovered = await provider.findByRecordId(recordId);
  if (recovered?.spreadsheetId !== spreadsheetId) throw new Error("Không đọc lại được appProperties của file smoke.");
  console.log(JSON.stringify({ event: "google_drive_smoke_passed", fiveSheetsRendered: true, metadataRecovered: true }));
} finally {
  if (spreadsheetId) await provider.trash(spreadsheetId);
}
}

void main().catch((error) => {
  console.error(JSON.stringify({ event: "google_drive_smoke_failed", error: error instanceof Error ? error.name : "UnknownError" }));
  process.exitCode = 1;
});
