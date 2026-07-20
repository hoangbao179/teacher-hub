import { apiDownload } from "./client";

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
