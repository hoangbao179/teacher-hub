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

const parseTestimonials = (raw: string | undefined, fallback: PublicTestimonial[]): PublicTestimonial[] => {
  const parsed = parseArray<PublicTestimonial>(raw, fallback);
  return parsed.every((item) =>
    typeof item?.id === "string" && typeof item.guardianLabel === "string" &&
    typeof item.studentLevel === "string" && typeof item.location === "string" &&
    typeof item.quote === "string" && typeof item.verified === "boolean" &&
    typeof item.published === "boolean") ? parsed : fallback;
};

const placeholderContact = /\.invalid(?:\/|$)|localhost|84000000000|84900000000|chua-cau-hinh|chưa-cấu-hình|example(?:\.|\/|$)/i;

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

export const isDevelopmentContent = import.meta.env.VITE_PUBLIC_CONTENT_MODE !== "production";
const publicSiteUrl = value("VITE_PUBLIC_SITE_URL", "https://configure-public-domain.invalid").replace(/\/$/, "");
const heroMobile = value("VITE_PUBLIC_HERO_MOBILE_URL", "/images/teacher-english-hero-720.jpg");
const heroDesktop = value("VITE_PUBLIC_HERO_DESKTOP_URL", "/images/teacher-english-hero-1440.jpg");
const alternateHeroMobile = value("VITE_PUBLIC_HERO_ALT_MOBILE_URL", "/images/teacher-hero-720.webp");
const alternateHeroDesktop = value("VITE_PUBLIC_HERO_ALT_DESKTOP_URL", "/images/teacher-hero-1440.webp");
const secondaryHeroMobile = value("VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL", "/images/teacher-secondary-study-720.jpg");
const secondaryHeroDesktop = value("VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL", "/images/teacher-secondary-study-1440.jpg");
const rawZaloUrl = value("VITE_PUBLIC_ZALO_URL", "");
const rawFacebookUrl = value("VITE_PUBLIC_FACEBOOK_URL", "");
const rawPhoneDisplay = value("VITE_PUBLIC_PHONE_DISPLAY", "");
const rawPhoneE164 = value("VITE_PUBLIC_PHONE_E164", "");
const zaloUrl = isConfiguredExternalUrl(rawZaloUrl, "zalo.me") ? rawZaloUrl : isDevelopmentContent ? "https://zalo.me/84912345678" : rawZaloUrl;
const facebookUrl = isConfiguredExternalUrl(rawFacebookUrl, "facebook.com") ? rawFacebookUrl : isDevelopmentContent ? "https://www.facebook.com/lophocanhngucovy" : rawFacebookUrl;
const phoneDisplay = isConfiguredPhone(`tel:${rawPhoneE164}`, rawPhoneDisplay) ? rawPhoneDisplay : isDevelopmentContent ? "0912 345 678" : rawPhoneDisplay;
const phoneE164 = isConfiguredPhone(`tel:${rawPhoneE164}`, rawPhoneDisplay) ? rawPhoneE164 : isDevelopmentContent ? "+84912345678" : rawPhoneE164;

/**
 * Source of truth for deployment-specific public content and temporary media.
 * VITE_* values are public browser configuration and must never contain secrets.
 */
export const publicHomeContent = {
  siteUrl: publicSiteUrl,
  teacherName: value("VITE_PUBLIC_TEACHER_NAME", "Cô Vy"),
  brandName: value("VITE_PUBLIC_BRAND_NAME", "Lớp học cô Vy"),
  subject: "Tiếng Anh",
  levels: "Lớp 1–9",
  location: "Huế",
  heroDescription: value("VITE_PUBLIC_DESCRIPTION", "Kèm cặp 1–1 và lớp nhóm nhỏ, bám sát năng lực từng học sinh."),
  carouselIntervalMs: 5_500,
  heroSlides: [
    {
      id: "foundation",
      eyebrow: "Cô Vy · Tiếng Anh lớp 1–9 tại Huế",
      title: value("VITE_PUBLIC_HERO_HEADING", "Tiếng Anh vững nền tảng"),
      description: "Tự tin tiến bộ mỗi ngày",
      mobileImage: heroMobile,
      desktopImage: heroDesktop,
      focalPosition: "center",
      alt: "Góc học tập tiếng Anh với sách, thẻ từ và đồ dùng học tập",
    },
    {
      id: "primary",
      eyebrow: "Xây nền đúng nhịp cho từng học sinh",
      title: "Tiếng Anh lớp 1–5",
      description: "Phonics, phát âm, từ vựng và mẫu câu",
      mobileImage: alternateHeroMobile,
      desktopImage: alternateHeroDesktop,
      focalPosition: "68% center",
      alt: "Sách tiếng Anh, thẻ chữ cái và bút màu trên bàn học",
    },
    {
      id: "secondary",
      eyebrow: "Củng cố kiến thức và bám sát chương trình",
      title: "Tiếng Anh lớp 6–9",
      description: "Ngữ pháp, đọc hiểu, viết và kỹ năng làm bài",
      mobileImage: secondaryHeroMobile,
      desktopImage: secondaryHeroDesktop,
      focalPosition: "58% center",
      alt: "Không gian học tập với sách, vở và máy tính",
    },
  ] satisfies PublicHeroSlide[],
  introduction: value("VITE_PUBLIC_INTRODUCTION", "Cô Vy đồng hành cùng học sinh từ lớp 1 đến lớp 9 theo mục tiêu phù hợp: xây nền, củng cố phần còn yếu và bám sát chương trình trên trường."),
  teacherProfile: {
    greeting: "Xin chào, cô là Uyên Vy.",
    biography: "Đồng hành cùng học sinh lớp 1–9 tại Huế. Tập trung xây nền, củng cố phần còn yếu và giúp học sinh tự tin hơn.",
    highlights: ["Tiếng Anh lớp 1–9", "Kèm cặp 1–1 và nhóm nhỏ", "Theo sát năng lực từng học sinh"],
  },
  media: {
    ogImage: value("VITE_PUBLIC_OG_IMAGE_URL", "/images/teacher-english-hero-1440.jpg"),
    teacherPhoto: value("VITE_PUBLIC_TEACHER_PHOTO_URL", "/images/teacher-hero-720.webp"),
    teacherPhotoAlt: value("VITE_PUBLIC_TEACHER_PHOTO_ALT", "Không gian dạy và học tiếng Anh của cô Vy"),
    teacherPhotoFocalPosition: value("VITE_PUBLIC_TEACHER_PHOTO_FOCAL_POSITION", "center"),
  },
  contact: {
    zaloUrl,
    phoneDisplay,
    phoneHref: phoneE164 ? `tel:${phoneE164}` : "",
    facebookUrl,
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
  videos: parseArray<PublicVideo>(import.meta.env.VITE_PUBLIC_VIDEOS_JSON, defaultVideos),
  testimonials: parseTestimonials(import.meta.env.VITE_PUBLIC_TESTIMONIALS_JSON, developmentTestimonialDrafts),
  parentTopics: [
    "Con mất gốc nên bắt đầu từ đâu?",
    "Học 1–1 hay học nhóm phù hợp hơn?",
    "Làm sao theo dõi tiến bộ của con?",
  ],
  seo: {
    title: value("VITE_PUBLIC_SEO_TITLE", "Lớp học tiếng Anh cô Vy | Tiếng Anh lớp 1–9 tại Huế"),
    description: value("VITE_PUBLIC_SEO_DESCRIPTION", "Kèm cặp tiếng Anh 1–1 và lớp nhóm nhỏ cho học sinh lớp 1–9 tại Huế, củng cố kiến thức, bám sát chương trình và ôn thi Nguyễn Tri Phương."),
  },
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

export function isConfiguredPhone(href: string, label: string): boolean {
  return /^tel:\+[1-9]\d{7,14}$/.test(href) && Boolean(label.trim()) && !placeholderContact.test(`${href} ${label}`);
}

export function publishableTestimonials(items: readonly PublicTestimonial[]): PublicTestimonial[] {
  return items.filter((item) => item.published && item.verified);
}
