export interface PublicVideo {
  title: string;
  description: string;
  url: string;
}

export interface PublicTestimonial {
  quote: string;
  attribution: string;
}

const value = (name: keyof ImportMetaEnv, fallback: string): string => import.meta.env[name]?.trim() || fallback;
const parseArray = <T>(raw: string | undefined, fallback: T[]): T[] => {
  if (!raw?.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
};

const defaultVideos: PublicVideo[] = [
  {
    title: "Từ vựng tiếng Anh qua ngữ cảnh",
    description: "Video tham khảo giúp học sinh nhỏ tuổi nghe, nhắc lại và ghi nhớ từ mới trong tình huống gần gũi.",
    url: "https://www.youtube.com/watch?v=H6SSRhF9K3A",
  },
];

const defaultTestimonials: PublicTestimonial[] = [
  {
    quote: "Khu vực này chỉ minh họa cách hiển thị phản hồi. Nội dung thật cần được phụ huynh đồng ý trước khi đăng.",
    attribution: "Nội dung minh họa — chưa phải phản hồi thực tế",
  },
];

export const isDemoContent = import.meta.env.VITE_PUBLIC_CONTENT_MODE !== "production";
const publicSiteUrl = value("VITE_PUBLIC_SITE_URL", "https://configure-public-domain.invalid").replace(/\/$/, "");
const phoneDisplay = value("VITE_PUBLIC_PHONE_DISPLAY", "Chưa cấu hình");
const phoneE164 = value("VITE_PUBLIC_PHONE_E164", "+84000000000");

/**
 * Source of truth for every deployment-specific public value. Development
 * fallbacks are visibly labeled on the Homepage and rejected by production
 * validation. VITE_* values are public browser configuration, never secrets.
 */
export const publicHomeContent = {
  siteUrl: publicSiteUrl,
  teacherName: value("VITE_PUBLIC_TEACHER_NAME", "Cô Vy"),
  brandName: value("VITE_PUBLIC_BRAND_NAME", "Lớp học cô Vy"),
  subject: "Tiếng Anh",
  levels: "Lớp 1–9",
  heroHeading: value("VITE_PUBLIC_HERO_HEADING", "Tiếng Anh vững nền tảng, tự tin tiến bộ mỗi ngày"),
  heroDescription: value("VITE_PUBLIC_DESCRIPTION", "Kèm cặp 1–1 và lớp nhóm nhỏ, bám sát năng lực từng học sinh."),
  introduction: value("VITE_PUBLIC_INTRODUCTION", "Cô Vy đồng hành cùng học sinh từ lớp 1 đến lớp 9 theo mục tiêu phù hợp: xây nền, củng cố phần còn yếu và bám sát chương trình trên trường."),
  media: {
    heroMobile: value("VITE_PUBLIC_HERO_MOBILE_URL", "/images/teacher-english-hero-720.jpg"),
    heroDesktop: value("VITE_PUBLIC_HERO_DESKTOP_URL", "/images/teacher-english-hero-1440.jpg"),
    ogImage: value("VITE_PUBLIC_OG_IMAGE_URL", "/images/teacher-english-hero-1440.jpg"),
  },
  contact: {
    zaloUrl: value("VITE_PUBLIC_ZALO_URL", "https://zalo.me/84000000000"),
    phoneDisplay,
    phoneHref: `tel:${phoneE164}`,
    facebookUrl: value("VITE_PUBLIC_FACEBOOK_URL", "https://www.facebook.com/chua-cau-hinh-co-vy"),
  },
  methods: [
    { title: "Bám sát năng lực", detail: "Xác định phần kiến thức còn hổng và chọn nhịp học phù hợp với từng học sinh." },
    { title: "Học để sử dụng", detail: "Kết hợp phát âm, từ vựng, mẫu câu và ngữ pháp trong bài tập có ngữ cảnh." },
    { title: "Củng cố đều đặn", detail: "Ôn lại kiến thức, luyện kỹ năng và phản hồi rõ nội dung cần tiếp tục rèn." },
  ],
  programs: [
    {
      level: "Tiếng Anh lớp 1–5",
      title: "Phát âm, phonics và xây nền",
      detail: "Làm quen âm, từ vựng và mẫu câu; xây nền đọc, nghe và phản xạ phù hợp với lứa tuổi.",
    },
    {
      level: "Tiếng Anh lớp 6–9",
      title: "Bám sát chương trình trên trường",
      detail: "Củng cố từ vựng, ngữ pháp, đọc hiểu và viết; hệ thống kiến thức để ôn kiểm tra.",
    },
    {
      level: "Kèm cặp và ôn thi",
      title: "Theo mục tiêu của từng học sinh",
      detail: "Hỗ trợ học sinh mất gốc, kèm cặp 1–1 hoặc lớp nhóm nhỏ, củng cố kiến thức và ôn thi Nguyễn Tri Phương theo năng lực từng em.",
    },
  ],
  videos: parseArray<PublicVideo>(import.meta.env.VITE_PUBLIC_VIDEOS_JSON, defaultVideos),
  testimonials: parseArray<PublicTestimonial>(import.meta.env.VITE_PUBLIC_TESTIMONIALS_JSON, defaultTestimonials),
  seo: {
    title: value("VITE_PUBLIC_SEO_TITLE", "Lớp học tiếng Anh cô Vy | Tiếng Anh lớp 1–9"),
    description: value("VITE_PUBLIC_SEO_DESCRIPTION", "Kèm cặp tiếng Anh 1–1 và lớp nhóm nhỏ cho học sinh lớp 1–9, củng cố kiến thức, bám sát chương trình và ôn thi Nguyễn Tri Phương."),
  },
} as const;
