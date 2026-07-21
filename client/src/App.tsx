import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout } from "./layout/AdminLayout";
import { useAuth } from "./auth/AuthContext";
import { LoadingState } from "./components/LoadingState";
import { RouteMetadata } from "./components/RouteMetadata";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ClassesPage = lazy(() => import("./pages/ClassesPage").then((module) => ({ default: module.ClassesPage })));
const ClassDetailPage = lazy(() => import("./pages/ClassDetailPage").then((module) => ({ default: module.ClassDetailPage })));
const StudentsPage = lazy(() => import("./pages/StudentsPage").then((module) => ({ default: module.StudentsPage })));
const StudentDetailPage = lazy(() => import("./pages/StudentDetailPage").then((module) => ({ default: module.StudentDetailPage })));
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
          <Route path="/admin/students" element={<StudentsPage />} />
          <Route path="/admin/students/new" element={<StudentFormPage />} />
          <Route path="/admin/students/:id" element={<StudentDetailPage />} />
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
          <Route path="/admin/*" element={<NotFoundPage admin />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
