import type { StudentListItem } from "@teacher/shared";

export function getEnrollmentCandidates(students: StudentListItem[]): StudentListItem[] {
  return students.filter((student) => student.status === "ACTIVE" && student.enrollmentId == null);
}
