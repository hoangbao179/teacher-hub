import { apiDownload } from "./client";
import { api } from "./client";
import type { CreateStudentGoogleSheetRequest, EndEnrollmentRequest, StudentGoogleSheetMutationResult, StudentGoogleSheetResyncResult, StudentGoogleSheetState, TransferEnrollmentRequest, TransferEnrollmentResult } from "@teacher/shared";

function fallbackStudentReportFilename(studentName: string, reportDate: string): string {
  const safeName = studentName.trim().replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "-") || "hoc-sinh";
  return `Bao-cao-${safeName}-${reportDate.replace(/-/g, "")}.xlsx`;
}

export async function downloadStudentReport(studentId: number, studentName: string, reportDate: string): Promise<string> {
  const { blob, filename } = await apiDownload(
    `/api/students/${studentId}/export.xlsx`,
    fallbackStudentReportFilename(studentName, reportDate),
  );
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    return filename;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function endEnrollment(enrollmentId: number, input: EndEnrollmentRequest): Promise<void> {
  return api<void>(`/api/enrollments/${enrollmentId}/end`, { method: "POST", body: JSON.stringify(input) });
}

export function transferEnrollment(enrollmentId: number, input: TransferEnrollmentRequest): Promise<TransferEnrollmentResult> {
  return api<TransferEnrollmentResult>(`/api/enrollments/${enrollmentId}/transfer`, { method: "POST", body: JSON.stringify(input) });
}

export function getStudentGoogleSheet(studentId: number): Promise<StudentGoogleSheetState> {
  return api<StudentGoogleSheetState>(`/api/students/${studentId}/google-sheet`);
}

export function createStudentGoogleSheet(studentId: number, input: CreateStudentGoogleSheetRequest = {}): Promise<StudentGoogleSheetMutationResult> {
  return api<StudentGoogleSheetMutationResult>(`/api/students/${studentId}/google-sheet`, { method: "POST", body: JSON.stringify(input) });
}

export function retryStudentGoogleSheet(studentId: number): Promise<StudentGoogleSheetMutationResult> {
  return api<StudentGoogleSheetMutationResult>(`/api/students/${studentId}/google-sheet/retry`, { method: "POST", body: "{}" });
}

export function regenerateStudentGoogleSheet(studentId: number): Promise<StudentGoogleSheetMutationResult> {
  return api<StudentGoogleSheetMutationResult>(`/api/students/${studentId}/google-sheet/regenerate`, { method: "POST", body: "{}" });
}

export function resyncStudentGoogleSheet(studentId: number): Promise<StudentGoogleSheetResyncResult> {
  return api<StudentGoogleSheetResyncResult>(`/api/students/${studentId}/google-sheet/resync`, {
    method: "POST", body: "{}",
  });
}

export function archiveStudentGoogleSheet(studentId: number): Promise<StudentGoogleSheetMutationResult> {
  return api<StudentGoogleSheetMutationResult>(`/api/students/${studentId}/google-sheet/archive`, { method: "POST", body: "{}" });
}
