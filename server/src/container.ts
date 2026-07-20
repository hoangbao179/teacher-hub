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
const lessonService = new LessonService(lessons, tuition);
const tuitionService = new TuitionService(tuition);
const scheduleService = new ScheduleService(schedules, lessonService);
const dashboardService = new DashboardService(tuition, schedules);
const enrollmentService = new EnrollmentService(enrollments);
const studentReportService = new StudentReportService(studentReports);

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
};
