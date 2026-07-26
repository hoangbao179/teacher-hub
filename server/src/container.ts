import { AuthController } from "./controllers/auth.controller";
import { ClassController } from "./controllers/class.controller";
import { DashboardController } from "./controllers/dashboard.controller";
import { HealthController } from "./controllers/health.controller";
import { LessonController } from "./controllers/lesson.controller";
import { ScheduleController } from "./controllers/schedule.controller";
import { StudentController } from "./controllers/student.controller";
import { TuitionController } from "./controllers/tuition.controller";
import { StudentReportController } from "./controllers/student-report.controller";
import { EnrollmentController } from "./controllers/enrollment.controller";
import { ClassRepository } from "./repositories/class.repository";
import { LessonRepository } from "./repositories/lesson.repository";
import { ScheduleRepository } from "./repositories/schedule.repository";
import { StudentRepository } from "./repositories/student.repository";
import { TuitionRepository } from "./repositories/tuition.repository";
import { StudentReportRepository } from "./repositories/student-report.repository";
import { UserRepository } from "./repositories/user.repository";
import { EnrollmentRepository } from "./repositories/enrollment.repository";
import { AuthService } from "./services/auth.service";
import { ClassService } from "./services/class.service";
import { DashboardService } from "./services/dashboard.service";
import { LessonService } from "./services/lesson.service";
import { ScheduleService } from "./services/schedule.service";
import { StudentService } from "./services/student.service";
import { TuitionService } from "./services/tuition.service";
import { StudentReportService } from "./services/student-report.service";
import { EnrollmentService } from "./services/enrollment.service";
import { LegacyImportController } from "./controllers/legacy-import.controller";
import { LegacyImportService } from "./services/legacy-import.service";
import { StudentGoogleSheetController } from "./controllers/student-google-sheet.controller";
import { StudentGoogleSheetService } from "./services/student-google-sheet.service";
import { StudentGoogleSheetRepository } from "./repositories/student-google-sheet.repository";
import { GoogleApiSheetProvider } from "./integrations/google/google-sheet.provider";
import { config } from "./config/config";
import { FakeGoogleSheetProvider } from "./integrations/google/fake-google-sheet.provider";
import { GoogleSheetSyncRepository } from "./repositories/google-sheet-sync.repository";
import { GoogleSheetSyncWorker } from "./workers/google-sheet-sync.worker";

const users = new UserRepository();
const classes = new ClassRepository();
const students = new StudentRepository();
const lessons = new LessonRepository();
const tuition = new TuitionRepository();
const schedules = new ScheduleRepository();
const enrollments = new EnrollmentRepository();
const studentReports = new StudentReportRepository();

const authService = new AuthService(users);
const classService = new ClassService(classes);
const studentService = new StudentService(students);
const googleSheetSync = new GoogleSheetSyncRepository();
const lessonService = new LessonService(lessons, tuition, undefined, undefined, googleSheetSync);
const tuitionService = new TuitionService(tuition);
const scheduleService = new ScheduleService(schedules, lessonService);
const dashboardService = new DashboardService(tuition, schedules);
const enrollmentService = new EnrollmentService(enrollments);
const studentReportService = new StudentReportService(studentReports);
const legacyImportService = new LegacyImportService(studentService, classService);
const studentGoogleSheets = new StudentGoogleSheetRepository();
function createGoogleSheetProvider() {
  if (!config.googleDrive.enabled) return null;
  if (config.nodeEnv === "test" && process.env.GOOGLE_DRIVE_FAKE === "1") {
    const fake = new FakeGoogleSheetProvider();
    if (process.env.GOOGLE_DRIVE_FAKE_FAIL_ONCE === "1") { fake.failure = "NETWORK"; fake.failOnce = true; }
    fake.delayMs = Number(process.env.GOOGLE_DRIVE_FAKE_DELAY_MS ?? 0);
    return fake;
  }
  return new GoogleApiSheetProvider(config.googleDrive);
}
const googleSheetProvider = createGoogleSheetProvider();
const studentGoogleSheetService = new StudentGoogleSheetService(
  studentGoogleSheets,
  studentService,
  config.googleDrive,
  googleSheetProvider,
  googleSheetSync,
  config.googleSheetSync,
);
export const googleSheetSyncWorker = new GoogleSheetSyncWorker(
  googleSheetSync,
  studentGoogleSheets,
  googleSheetProvider,
  config.googleSheetSync,
  config.googleDrive.enabled,
);

export const controllers = {
  health: new HealthController(),
  auth: new AuthController(authService),
  classes: new ClassController(classService, lessonService),
  students: new StudentController(studentService),
  lessons: new LessonController(lessonService),
  tuition: new TuitionController(tuitionService),
  schedule: new ScheduleController(scheduleService),
  dashboard: new DashboardController(dashboardService),
  enrollments: new EnrollmentController(enrollmentService),
  studentReports: new StudentReportController(studentReportService),
  legacyImports: new LegacyImportController(legacyImportService),
  studentGoogleSheets: new StudentGoogleSheetController(studentGoogleSheetService),
};
