export type BookGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface PublicBook {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  grade: BookGrade;
  volume: 1 | 2 | null;
  seriesSlug: "global-success";
  seriesName: "Global Success";
  coverUrl: string;
  previewUrl: string;
  sourceHost: "online.flipbuilder.com";
  hasInteractiveAudio: true;
  enabled: boolean;
  displayOrder: number;
}
