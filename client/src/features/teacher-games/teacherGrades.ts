import type { LearningAgeBand } from "@teacher/shared";

export const teacherGradeOptions: readonly { value: number; label: string }[] = [
  { value: 0, label: "Mầm non" },
  ...Array.from({ length: 9 }, (_, index) => ({
    value: index + 1, label: `Lớp ${index + 1}`,
  })),
];

export function ageBandForGrade(gradeLevel: number): LearningAgeBand {
  if (!Number.isInteger(gradeLevel) || gradeLevel < 0 || gradeLevel > 9)
    throw new Error("Khối lớp không hợp lệ.");
  if (gradeLevel <= 1) return "PRESCHOOL_G1";
  if (gradeLevel <= 3) return "G2_G3";
  if (gradeLevel <= 5) return "G4_G5";
  return "G6_G9";
}

export function teacherGradeLabel(gradeLevel: number | null | undefined): string {
  return gradeLevel == null ? "Chưa phân khối" :
    teacherGradeOptions.find((value) => value.value === gradeLevel)?.label ?? "Khối lớp chưa xác định";
}
