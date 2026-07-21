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
    title: "Một cách trực quan để hiểu phân số",
    description: "Video học tập tham khảo dành cho phụ huynh và học sinh.",
    url: "https://www.youtube.com/watch?v=U2ovEuEUxXQ",
  },
  {
    title: "Rèn tư duy giải quyết bài toán",
    description: "Gợi ý cách đọc đề, chia bước và kiểm tra kết quả.",
    url: "https://youtu.be/QrJ-KfLzngQ",
  },
];

const defaultTestimonials: PublicTestimonial[] = [
  {
    quote: "Con chủ động làm bài hơn và biết nói rõ phần mình chưa hiểu. Gia đình dễ theo dõi tiến bộ sau mỗi buổi.",
    attribution: "Phụ huynh học sinh lớp 5 (minh họa)",
  },
  {
    quote: "Cách hướng dẫn nhẹ nhàng nhưng có kế hoạch rõ ràng giúp con tự tin hơn khi học Toán.",
    attribution: "Phụ huynh học sinh THCS (minh họa)",
  },
];

export const isDemoContent = import.meta.env.VITE_PUBLIC_CONTENT_MODE !== "production";
const publicSiteUrl = value("VITE_PUBLIC_SITE_URL", "https://teacher-class-hub.example").replace(/\/$/, "");
const phoneDisplay = value("VITE_PUBLIC_PHONE_DISPLAY", "0900 000 000");
const phoneE164 = value("VITE_PUBLIC_PHONE_E164", "+84900000000");

/**
 * Public-only configuration. Demo fallbacks are visibly labeled by HomePage and
 * are rejected by `npm -w client run build:production`.
 */
export const publicHomeContent = {
  siteUrl: publicSiteUrl,
  teacherName: value("VITE_PUBLIC_TEACHER_NAME", "Cô giáo An"),
  brandName: value("VITE_PUBLIC_BRAND_NAME", "Lớp học cùng cô An"),
  subjectLine: value("VITE_PUBLIC_SUBJECT_LINE", "Học chắc nền tảng, tiến bộ bền vững mỗi ngày"),
  description: value("VITE_PUBLIC_DESCRIPTION", "Đồng hành cùng học sinh tiểu học và trung học cơ sở bằng lộ trình rõ ràng, bài học dễ hiểu và phản hồi sát sao sau từng buổi."),
  introduction: value("VITE_PUBLIC_INTRODUCTION", "Mỗi học sinh có một nhịp học riêng. Cô theo sát năng lực, giúp con hiểu bản chất và hình thành thói quen tự học thay vì chỉ ghi nhớ đáp án."),
  hero: {
    mobileUrl: value("VITE_PUBLIC_HERO_MOBILE_URL", "/images/teacher-hero-720.webp"),
    desktopUrl: value("VITE_PUBLIC_HERO_DESKTOP_URL", "/images/teacher-hero-1440.webp"),
  },
  contact: {
    zaloUrl: value("VITE_PUBLIC_ZALO_URL", "https://zalo.me/0900000000"),
    phoneDisplay,
    phoneHref: `tel:${phoneE164}`,
    facebookUrl: value("VITE_PUBLIC_FACEBOOK_URL", "https://www.facebook.com/"),
  },
  methods: [
    { title: "Dễ hiểu và thực tế", detail: "Giải thích từ gốc, liên hệ ví dụ gần gũi và kiểm tra lại ngay trong buổi học." },
    { title: "Thực hành có mục tiêu", detail: "Bài tập vừa sức, tăng dần độ khó và tập trung đúng phần con còn vướng." },
    { title: "Phản hồi liên tục", detail: "Theo dõi từng buổi, nhận xét rõ điểm tiến bộ và nội dung cần củng cố." },
  ],
  programs: [
    { level: "Tiểu học", title: "Xây nền Toán vững", detail: "Hiểu số, phép tính và tư duy giải bài toán có lời văn." },
    { level: "THCS", title: "Bám sát và mở rộng", detail: "Củng cố kiến thức trên lớp, rèn phương pháp trình bày và tự kiểm tra." },
    { level: "Cá nhân hóa", title: "1 kèm 1 hoặc lớp nhóm nhỏ", detail: "Lộ trình phù hợp năng lực và mục tiêu của từng học sinh." },
  ],
  videos: parseArray<PublicVideo>(import.meta.env.VITE_PUBLIC_VIDEOS_JSON, defaultVideos),
  testimonials: parseArray<PublicTestimonial>(import.meta.env.VITE_PUBLIC_TESTIMONIALS_JSON, defaultTestimonials),
  seo: {
    title: value("VITE_PUBLIC_SEO_TITLE", "Cô giáo An | Học Toán chắc nền tảng, tiến bộ bền vững"),
    description: value("VITE_PUBLIC_SEO_DESCRIPTION", "Lớp Toán 1 kèm 1 và nhóm nhỏ cho học sinh tiểu học, THCS với lộ trình cá nhân hóa và phản hồi sát sao."),
  },
} as const;
