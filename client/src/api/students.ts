import { apiDownload } from "./client";
import { api } from "./client";
import type { EndEnrollmentRequest, LegacyImportPreview, TransferEnrollmentRequest, TransferEnrollmentResult } from "@teacher/shared";

export async function downloadStudentReport(studentId: number): Promise<string> {
  const { blob, filename } = await apiDownload(`/api/students/${studentId}/export.xlsx`);
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

export function previewLegacyWorkbook(studentId: number, file: File): Promise<LegacyImportPreview> {
  const body = new FormData();
  body.append("file", file);
  return api<LegacyImportPreview>(`/api/students/${studentId}/legacy-imports/preview`, { method: "POST", body });
}
