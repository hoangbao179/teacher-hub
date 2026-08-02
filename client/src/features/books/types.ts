export type BookGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type BookType = "STUDENT_BOOK" | "TEACHER_BOOK" | "WORKBOOK";

export interface PublicBook {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  grade: BookGrade;
  volume: 1 | 2 | null;
  seriesSlug: string;
  seriesName: string;
  bookType: BookType;
  coverUrl: string;
  officialDetailUrl: string;
  officialViewerUrl: string;
  officialViewerMode: "PAGE_IMAGES" | "EXTERNAL";
  officialPageManifestUrl?: string;
  interactiveAudioUrl?: string;
  enabled: boolean;
  displayOrder: number;
}
