import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout } from "./layout/AdminLayout";
import { useAuth } from "./auth/AuthContext";
import { LoadingState } from "./components/LoadingState";
import { RouteMetadata } from "./components/RouteMetadata";
import { AuthProvider } from "./auth/AuthContext";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ClassesPage = lazy(() => import("./pages/ClassesPage").then((module) => ({ default: module.ClassesPage })));
const CombinedClassGroupsPage = lazy(() => import("./pages/CombinedClassGroupsPage").then((module) => ({ default: module.CombinedClassGroupsPage })));
const CombinedClassGroupFormPage = lazy(() => import("./pages/CombinedClassGroupFormPage").then((module) => ({ default: module.CombinedClassGroupFormPage })));
const CombinedTeachingOccurrencePage = lazy(() => import("./pages/CombinedTeachingOccurrencePage").then((module) => ({ default: module.CombinedTeachingOccurrencePage })));
const ClassDetailPage = lazy(() => import("./pages/ClassDetailPage").then((module) => ({ default: module.ClassDetailPage })));
const StudentsPage = lazy(() => import("./pages/StudentsPage").then((module) => ({ default: module.StudentsPage })));
const StudentDetailPage = lazy(() => import("./pages/StudentDetailPage").then((module) => ({ default: module.StudentDetailPage })));
const LegacyImportPage = lazy(() => import("./pages/LegacyImportPage").then((module) => ({ default: module.LegacyImportPage })));
const TuitionPage = lazy(() => import("./pages/TuitionPage").then((module) => ({ default: module.TuitionPage })));
const TuitionDetailPage = lazy(() => import("./pages/TuitionDetailPage").then((module) => ({ default: module.TuitionDetailPage })));
const MarkTuitionPaidPage = lazy(() => import("./pages/MarkTuitionPaidPage").then((module) => ({ default: module.MarkTuitionPaidPage })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const ReconciliationPage = lazy(() => import("./pages/ReconciliationPage").then((module) => ({ default: module.ReconciliationPage })));
const BusySlotFormPage = lazy(() => import("./pages/BusySlotFormPage").then((module) => ({ default: module.BusySlotFormPage })));
const BusySlotsPage = lazy(() => import("./pages/BusySlotsPage").then((module) => ({ default: module.BusySlotsPage })));
const OutstandingMakeupsPage = lazy(() => import("./pages/OutstandingMakeupsPage").then((module) => ({ default: module.OutstandingMakeupsPage })));
const LessonWizardPage = lazy(() => import("./pages/LessonWizardPage").then((module) => ({ default: module.LessonWizardPage })));
const ClassFormPage = lazy(() => import("./pages/ClassFormPage").then((module) => ({ default: module.ClassFormPage })));
const StudentFormPage = lazy(() => import("./pages/StudentFormPage").then((module) => ({ default: module.StudentFormPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const LearningHubPage = lazy(() => import("./features/learning/pages/LearningHubPage").then((module) => ({ default: module.LearningHubPage })));
const LearningLevelPage = lazy(() => import("./features/learning/pages/LearningLevelPage").then((module) => ({ default: module.LearningLevelPage })));
const LearningUnitPage = lazy(() => import("./features/learning/pages/LearningUnitPage").then((module) => ({ default: module.LearningUnitPage })));
const LearningFlashcardsPage = lazy(() => import("./features/learning/pages/LearningFlashcardsPage").then((module) => ({ default: module.LearningFlashcardsPage })));
const LearningListenPage = lazy(() => import("./features/learning/pages/LearningListenPage").then((module) => ({ default: module.LearningListenPage })));
const LearningQuizPage = lazy(() => import("./features/learning/pages/LearningQuizPage").then((module) => ({ default: module.LearningQuizPage })));
const LearningResultPage = lazy(() => import("./features/learning/pages/LearningResultPage").then((module) => ({ default: module.LearningResultPage })));
const LearningReviewPage = lazy(() => import("./features/learning/pages/LearningReviewPage").then((module) => ({ default: module.LearningReviewPage })));
const LearningNotFoundPage = lazy(() => import("./features/learning/pages/LearningNotFoundPage").then((module) => ({ default: module.LearningNotFoundPage })));
const VocabularyListPage = lazy(() => import("./features/vocabulary/pages/VocabularyListPage").then((module) => ({ default: module.VocabularyListPage })));
const VocabularyEditorPage = lazy(() => import("./features/vocabulary/pages/VocabularyEditorPage").then((module) => ({ default: module.VocabularyEditorPage })));
const AssignmentListPage = lazy(() => import("./features/assignments/pages/AssignmentListPage").then((module) => ({ default: module.AssignmentListPage })));
const AssignmentWizardPage = lazy(() => import("./features/assignments/pages/AssignmentWizardPage").then((module) => ({ default: module.AssignmentWizardPage })));
const AssignmentDetailPage = lazy(() => import("./features/assignments/pages/AssignmentDetailPage").then((module) => ({ default: module.AssignmentDetailPage })));
const AssignmentResultsPage = lazy(() => import("./features/assignments/pages/AssignmentResultsPage").then((module) => ({ default: module.AssignmentResultsPage })));
const AccountPage = lazy(() => import("./pages/AccountPage").then((module) => ({ default: module.AccountPage })));
const PlayStartPage = lazy(() => import("./features/vocabulary-games/pages/PlayStartPage").then((module) => ({ default: module.PlayStartPage })));
const PlayGamePage = lazy(() => import("./features/vocabulary-games/pages/PlayGamePage").then((module) => ({ default: module.PlayGamePage })));
const PlayResultPage = lazy(() => import("./features/vocabulary-games/pages/PlayResultPage").then((module) => ({ default: module.PlayResultPage })));
const BookLibraryPage = lazy(() => import("./features/books/pages/BookLibraryPage").then((module) => ({ default: module.BookLibraryPage })));
const BookPreviewPage = lazy(() => import("./features/books/pages/BookPreviewPage").then((module) => ({ default: module.BookPreviewPage })));
const InteractiveAudioPage = lazy(() => import("./features/books/pages/InteractiveAudioPage").then((module) => ({ default: module.InteractiveAudioPage })));
const BookNotFoundPage = lazy(() => import("./features/books/pages/BookNotFoundPage").then((module) => ({ default: module.BookNotFoundPage })));
function AdminAuthBoundary() {
  return <AuthProvider><Outlet /></AuthProvider>;
}
function Protected() {
  const { user, bootstrapping } = useAuth();
  const location = useLocation();
  if (bootstrapping) return <LoadingState />;
  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />
  );
}
function GuestOnly() {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) return <LoadingState />;
  return user ? <Navigate to="/admin" replace /> : <Outlet />;
}
export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RouteMetadata />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/hoc" element={<LearningHubPage />} />
      <Route path="/hoc/:levelSlug" element={<LearningLevelPage />} />
      <Route path="/hoc/:levelSlug/:unitSlug" element={<LearningUnitPage />} />
      <Route path="/hoc/:levelSlug/:unitSlug/flashcards" element={<LearningFlashcardsPage />} />
      <Route path="/hoc/:levelSlug/:unitSlug/listen" element={<LearningListenPage />} />
      <Route path="/hoc/:levelSlug/:unitSlug/quiz" element={<LearningQuizPage />} />
      <Route path="/hoc/:levelSlug/:unitSlug/result" element={<LearningResultPage />} />
      <Route path="/hoc/:levelSlug/:unitSlug/review" element={<LearningReviewPage />} />
      <Route path="/hoc/*" element={<LearningNotFoundPage />} />
      <Route path="/sach" element={<BookLibraryPage />} />
      <Route path="/sach/:seriesSlug/:bookSlug/nghe" element={<InteractiveAudioPage />} />
      <Route path="/sach/:seriesSlug/:bookSlug" element={<BookPreviewPage />} />
      <Route path="/sach/*" element={<BookNotFoundPage />} />
      <Route path="/play/:publicCode" element={<PlayStartPage />} />
      <Route path="/play/session/:sessionToken" element={<PlayGamePage />} />
      <Route path="/play/session/:sessionToken/result" element={<PlayResultPage />} />
      <Route element={<AdminAuthBoundary />}>
        <Route element={<GuestOnly />}>
          <Route path="/admin/login" element={<LoginPage />} />
        </Route>
        <Route element={<Protected />}>
          <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/reconciliation" element={<ReconciliationPage />} />
          <Route path="/admin/unrecorded" element={<Navigate to="/admin/reconciliation" replace />} />
          <Route path="/admin/classes" element={<ClassesPage />} />
          <Route path="/admin/classes/new" element={<ClassFormPage />} />
          <Route path="/admin/classes/:id" element={<ClassDetailPage />} />
          <Route path="/admin/classes/:id/edit" element={<ClassFormPage />} />
          <Route path="/admin/combined-class-groups" element={<CombinedClassGroupsPage />} />
          <Route path="/admin/combined-class-groups/new" element={<CombinedClassGroupFormPage />} />
          <Route path="/admin/combined-class-groups/:id/edit" element={<CombinedClassGroupFormPage />} />
          <Route path="/admin/combined-class-groups/occurrences/:id" element={<CombinedTeachingOccurrencePage />} />
          <Route path="/admin/students" element={<StudentsPage />} />
          <Route path="/admin/students/new" element={<StudentFormPage />} />
          <Route path="/admin/students/:id" element={<StudentDetailPage />} />
          <Route path="/admin/students/:studentId/legacy-import" element={<LegacyImportPage />} />
          <Route path="/admin/students/:id/edit" element={<StudentFormPage />} />
          <Route path="/admin/tuition" element={<TuitionPage />} />
          <Route path="/admin/tuition/:cycleId" element={<TuitionDetailPage />} />
          <Route path="/admin/tuition/:cycleId/mark-paid" element={<MarkTuitionPaidPage />} />
          <Route path="/admin/calendar" element={<CalendarPage />} />
          <Route path="/admin/busy-slots" element={<BusySlotsPage />} />
          <Route path="/admin/busy-slots/new" element={<BusySlotFormPage />} />
          <Route path="/admin/busy-slots/:id/edit" element={<BusySlotFormPage />} />
          <Route path="/admin/lessons/new" element={<LessonWizardPage />} />
          <Route path="/admin/makeup-outstanding" element={<OutstandingMakeupsPage />} />
          <Route path="/admin/lessons/:id/edit" element={<LessonWizardPage />} />
          <Route path="/admin/vocabulary" element={<VocabularyListPage />} />
          <Route path="/admin/vocabulary/new" element={<VocabularyEditorPage />} />
          <Route path="/admin/vocabulary/:id" element={<VocabularyEditorPage />} />
          <Route path="/admin/assignments" element={<AssignmentListPage />} />
          <Route path="/admin/assignments/new" element={<AssignmentWizardPage />} />
          <Route path="/admin/assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="/admin/assignments/:id/results" element={<AssignmentResultsPage />} />
          <Route path="/admin/assignments/:id/edit" element={<AssignmentWizardPage />} />
          <Route path="/admin/account" element={<AccountPage />} />
          <Route path="/admin/*" element={<NotFoundPage admin />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
