export interface PublicVideo {
  title: string;
  description: string;
  url: string;
}

export interface PublicHeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
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

const placeholderContact = /\.invalid(?:\/|$)|localhost|chua-cau-hinh|chưa-cấu-hình|example(?:\.|\/|$)/i;

const defaultVideos: PublicVideo[] = [
  {
    title: "Từ vựng tiếng Anh qua ngữ cảnh",
    description: "Video tham khảo giúp học sinh nghe, nhắc lại và ghi nhớ từ mới trong tình huống gần gũi.",
    url: "https://www.youtube.com/watch?v=H6SSRhF9K3A",
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
const rawZaloUrl = import.meta.env.VITE_PUBLIC_ZALO_URL?.trim() ?? "";
const zaloUrl = isConfiguredExternalUrl(rawZaloUrl, "zalo.me") ? rawZaloUrl : isDevelopmentContent ? "https://zalo.me/" : rawZaloUrl;
const facebookUrl = "https://www.facebook.com/uyenvy.le.12";

/**
 * Source of truth for stable Homepage content and local media.
 * Only the Zalo URL remains deployment-specific; VITE_* values must never contain secrets.
 */
export const publicHomeContent = {
  siteUrl: "https://tienganhcovy.com",
  teacherName: "Cô Vy",
  brandName: "Lớp học cô Vy",
  subject: "Tiếng Anh",
  levels: "Lớp 1–9",
  location: "Huế",
  heroDescription: "Kèm cặp 1–1 và lớp nhóm nhỏ, bám sát năng lực từng học sinh.",
  carouselIntervalMs: 5_500,
  heroSlides: [
    {
      id: "foundation",
      eyebrow: "Cô Vy · Tiếng Anh lớp 1–9 tại Huế",
      title: "Tiếng Anh vững nền tảng",
      description: "Tự tin tiến bộ mỗi ngày",
      mobileImage: "/images/teacher-english-hero-720.jpg",
      desktopImage: "/images/teacher-english-hero-1440.jpg",
      focalPosition: "center",
      alt: "Góc học tập tiếng Anh với sách, thẻ từ và đồ dùng học tập",
    },
    {
      id: "primary",
      eyebrow: "Xây nền đúng nhịp cho từng học sinh",
      title: "Tiếng Anh lớp 1–5",
      description: "Phonics, phát âm, từ vựng và mẫu câu",
      mobileImage: "/images/teacher-hero-720.webp",
      desktopImage: "/images/teacher-hero-1440.webp",
      focalPosition: "68% center",
      alt: "Sách tiếng Anh, thẻ chữ cái và bút màu trên bàn học",
    },
    {
      id: "secondary",
      eyebrow: "Củng cố kiến thức và bám sát chương trình",
      title: "Tiếng Anh lớp 6–9",
      description: "Ngữ pháp, đọc hiểu, viết và kỹ năng làm bài",
      mobileImage: "/images/teacher-secondary-study-720.jpg",
      desktopImage: "/images/teacher-secondary-study-1440.jpg",
      focalPosition: "58% center",
      alt: "Không gian học tập với sách, vở và máy tính",
    },
  ] satisfies PublicHeroSlide[],
  introduction: "Cô Vy đồng hành cùng học sinh từ lớp 1 đến lớp 9 theo mục tiêu phù hợp: xây nền, củng cố phần còn yếu và bám sát chương trình trên trường.",
  teacherProfile: {
    greeting: "Xin chào, cô là Uyên Vy.",
    biography: "Đồng hành cùng học sinh lớp 1–9 tại Huế. Tập trung xây nền, củng cố phần còn yếu và giúp học sinh tự tin hơn.",
    highlights: ["Tiếng Anh lớp 1–9", "Kèm cặp 1–1 và nhóm nhỏ", "Theo sát năng lực từng học sinh"],
  },
  media: {
    ogImage: "/images/teacher-english-hero-1440.jpg",
    teacherPhoto: "/images/teacher-hero-720.webp",
    teacherPhotoAlt: "Không gian dạy và học tiếng Anh của cô Vy",
    teacherPhotoFocalPosition: "center",
  },
  contact: {
    zaloUrl,
    facebookUrl,
    heroCtaLabel: "Nhắn Zalo cho cô Vy",
    heroCtaHint: "Trao đổi nhanh về tình hình học của con",
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
      title: "Tiếng Anh lớp 1–5",
      summary: "Xây nền ngôn ngữ vững vàng, vừa sức với lứa tuổi.",
      topics: ["Phonics", "Phát âm", "Từ vựng", "Mẫu câu", "Xây nền"],
      accent: "mint",
    },
    {
      title: "Tiếng Anh lớp 6–9",
      summary: "Bám sát chương trình và rèn kỹ năng làm bài.",
      topics: ["Từ vựng", "Ngữ pháp", "Đọc hiểu", "Viết", "Ôn kiểm tra"],
      accent: "blue",
    },
    {
      title: "Kèm cặp và ôn thi",
      summary: "Lộ trình theo phần kiến thức và mục tiêu từng em.",
      topics: ["Học sinh mất gốc", "Kèm cặp 1–1", "Lớp nhóm nhỏ", "Củng cố kiến thức", "Ôn thi Nguyễn Tri Phương"],
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

export function isConfiguredExternalUrl(raw: string, host: "zalo.me" | "facebook.com"): boolean {
  if (!raw || placeholderContact.test(raw)) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (url.hostname === host || url.hostname.endsWith(`.${host}`)) && (host !== "facebook.com" || url.pathname.replaceAll("/", "").length > 0);
  } catch {
    return false;
  }
}

export function publishableTestimonials(items: readonly PublicTestimonial[]): PublicTestimonial[] {
  return items.filter((item) => item.published && item.verified);
}
