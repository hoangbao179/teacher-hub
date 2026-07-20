import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout } from "./layout/AdminLayout";
import { useAuth } from "./auth/AuthContext";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ClassesPage } from "./pages/ClassesPage";
import { ClassDetailPage } from "./pages/ClassDetailPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentDetailPage } from "./pages/StudentDetailPage";
import { TuitionPage } from "./pages/TuitionPage";
import { TuitionDetailPage } from "./pages/TuitionDetailPage";
import { MarkTuitionPaidPage } from "./pages/MarkTuitionPaidPage";
import { CalendarPage } from "./pages/CalendarPage";
import { UnrecordedPage } from "./pages/UnrecordedPage";
import { LessonWizardPage } from "./pages/LessonWizardPage";
import { ClassFormPage } from "./pages/ClassFormPage";
import { StudentFormPage } from "./pages/StudentFormPage";
import { LoadingState } from "./components/LoadingState";
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
export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/unrecorded" element={<UnrecordedPage />} />
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
          <Route path="/admin/lessons/new" element={<LessonWizardPage />} />
          <Route path="/admin/lessons/:id/edit" element={<LessonWizardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
