import type { ClassListItem, StudentListItem } from "@teacher/shared";
import { api } from "./client";

/** Existing authenticated roster endpoints; never exposed from public game pages. */
export const listTeacherGameClasses = () => api<ClassListItem[]>("/api/classes");
export const listTeacherGameStudents = () => api<StudentListItem[]>("/api/students");
