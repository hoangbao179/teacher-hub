export interface PublicVideo {
  title: string;
  description: string;
  url: string;
}

export interface PublicHeroSlide {
  id: string;
  mobileImage: string;
  desktopImage: string;
  focalPosition: string;
  alt: string;
}

export interface PublicTestimonial {
  id: string;
  guardianLabel: string;
  studentLevel: string;
  location: string;
  quote: string;
  verified: boolean;
  published: boolean;
  date?: string;
}

export interface PublicProgram {
  title: string;
  summary: string;
  topics: readonly string[];
  accent: "mint" | "blue" | "coral";
}

const defaultVideos: PublicVideo[] = [
  {
    title: "Từ vựng tiếng Anh qua ngữ cảnh",
    description: "Video tham khảo giúp học sinh nghe, nhắc lại và ghi nhớ từ mới trong tình huống gần gũi.",
    url: "https://www.youtube.com/watch?v=H6SSRhF9K3A",
  },
  {
    title: "Hoạt động hằng ngày bằng tiếng Anh",
    description: "Video tham khảo giúp học sinh luyện nghe và nhắc lại những từ, mẫu câu quen thuộc trong một ngày.",
    url: "https://www.youtube.com/watch?v=qD1pnquN_DM",
  },
];

const developmentTestimonialDrafts: PublicTestimonial[] = [
  {
    id: "draft-guardian-m-grade-3",
    guardianLabel: "Phụ huynh bé M.",
    studentLevel: "Lớp 3",
    location: "Huế",
    quote: "Sau một thời gian học cùng cô Vy, con chủ động đọc từ mới và tự tin hơn khi làm bài trên lớp. Cô theo sát từng phần con còn yếu và trao đổi khá kỹ với gia đình.",
    verified: false,
    published: false,
  },
  {
    id: "draft-guardian-h-grade-7",
    guardianLabel: "Phụ huynh em H.",
    studentLevel: "Lớp 7",
    location: "Huế",
    quote: "Trước đây con khá sợ ngữ pháp. Cô Vy chia nhỏ kiến thức, cho luyện lại phần căn bản nên con dễ theo hơn và kết quả kiểm tra cũng ổn định hơn.",
    verified: false,
    published: false,
  },
  {
    id: "draft-guardian-n-grade-9",
    guardianLabel: "Phụ huynh em N.",
    studentLevel: "Lớp 9",
    location: "TP. Huế",
    quote: "Cô hướng dẫn con ôn theo từng mục tiêu, sửa kỹ phần đọc hiểu và viết. Gia đình dễ theo dõi nội dung mỗi buổi và biết con cần củng cố thêm phần nào.",
    verified: false,
    published: false,
  },
];

export const isDevelopmentContent = import.meta.env.DEV;
const zaloUrl = "https://zalo.me/";
const facebookUrl = "https://www.facebook.com/uyenvy.le.12";

/**
 * Source of truth for stable Homepage content, contact links and local media.
 */
export const publicHomeContent = {
  siteUrl: "https://tienganhcovy.com",
  teacherName: "Cô Vy",
  brandName: "Lớp học cô Vy",
  subject: "Tiếng Anh",
  levels: "Lớp 1–9",
  location: "Huế",
  heroDescription: "Kèm cặp 1–1 và lớp nhóm nhỏ, bám sát năng lực từng học sinh.",
  carouselIntervalMs: 2_000,
  heroSlides: [
    {
      id: "foundation",
      mobileImage: "/images/teacher-english-hero-720.jpg",
      desktopImage: "/images/teacher-english-hero-1440.jpg",
      focalPosition: "center",
      alt: "Góc học tập tiếng Anh với sách, thẻ từ và đồ dùng học tập",
    },
    {
      id: "secondary",
      mobileImage: "/images/teacher-secondary-study-720.jpg",
      desktopImage: "/images/teacher-secondary-study-1440.jpg",
      focalPosition: "58% center",
      alt: "Không gian học tập với sách, vở và máy tính",
    },
  ] satisfies PublicHeroSlide[],
  introduction: "Cô Vy đồng hành cùng học sinh từ lớp 1 đến lớp 9 theo mục tiêu phù hợp: xây nền, củng cố phần còn yếu và bám sát chương trình trên trường.",
  teacherProfile: {
    greeting: "Xin chào, cô là Uyên Vy.",
    biography: "Đồng hành cùng học sinh lớp 1–9 tại Huế. Kèm cặp 1–1, lớp nhóm nhỏ, củng cố phần còn yếu và luyện thi theo mục tiêu.",
    highlights: [
      "Tiếng Anh lớp 1–9",
      "Kèm cặp 1–1 và nhóm nhỏ",
      "Theo sát năng lực từng học sinh",
      "Luyện thi Nguyễn Tri Phương",
      "Luyện thi 9 lên 10",
    ],
  },
  media: {
    ogImage: "/images/teacher-english-hero-1440.jpg",
    teacherPhoto: "/images/covy-image.png",
    teacherPhotoAlt: "Cô Uyên Vy trong không gian dạy học tiếng Anh",
    teacherPhotoFocalPosition: "center 42%",
  },
  contact: {
    zaloUrl,
    facebookUrl,
    heading: "Cùng cô Vy tìm cách học phù hợp cho con",
    description: "Ba mẹ có thể nhắn cô Vy để chia sẻ tình hình học hiện tại, thời gian phù hợp và phần con đang cần hỗ trợ. Cô sẽ trao đổi thêm về lớp học và cách học phù hợp.",
    highlights: ["Lớp 1–9", "1–1 hoặc nhóm nhỏ", "Tại Huế"],
    zaloLabel: "Nhắn Zalo",
    facebookLabel: "Facebook",
    followUp: "Trao đổi về tình hình học và lịch học của con",
  },
  methods: [
    { title: "Bám sát năng lực", detail: "Xác định phần kiến thức còn hổng và chọn nhịp học phù hợp với từng học sinh." },
    { title: "Học để sử dụng", detail: "Kết hợp phát âm, từ vựng, mẫu câu và ngữ pháp trong bài tập có ngữ cảnh." },
    { title: "Củng cố đều đặn", detail: "Ôn lại kiến thức, luyện kỹ năng và phản hồi rõ nội dung cần tiếp tục rèn." },
  ],
  programs: [
    {
      title: "Tiếng Anh tiểu học – lớp 1–5",
      summary: "Xây nền từ vựng, phát âm và mẫu câu vừa sức.",
      topics: ["Củng cố kiến thức trên trường", "Rèn nền tảng đều đặn"],
      accent: "mint",
    },
    {
      title: "Tiếng Anh THCS – lớp 6–9",
      summary: "Bám sát chương trình, củng cố ngữ pháp và kỹ năng làm bài.",
      topics: ["Củng cố kiến thức trên trường", "Ôn tập theo phần còn yếu"],
      accent: "blue",
    },
    {
      title: "Luyện thi theo mục tiêu",
      summary: "Lộ trình tập trung theo kỳ thi và năng lực từng học sinh.",
      topics: ["Luyện thi Nguyễn Tri Phương", "Luyện thi 9 lên 10"],
      accent: "coral",
    },
  ] satisfies PublicProgram[],
  videos: defaultVideos,
  testimonials: developmentTestimonialDrafts,
  parentTopics: [
    "Con mất gốc nên bắt đầu từ đâu?",
    "Học 1–1 hay học nhóm phù hợp hơn?",
    "Làm sao theo dõi tiến bộ của con?",
  ],
  seo: {
    title: "Lớp học tiếng Anh cô Vy | Tiếng Anh lớp 1–9 tại Huế",
    description: "Kèm cặp tiếng Anh 1–1 và lớp nhóm nhỏ cho học sinh lớp 1–9 tại Huế.",
  },
  footer: "2026 — từ người hâm mộ cô Vy, with love ❤️",
} as const;

export function publishableTestimonials(items: readonly PublicTestimonial[]): PublicTestimonial[] {
  return items.filter((item) => item.published && item.verified);
}
