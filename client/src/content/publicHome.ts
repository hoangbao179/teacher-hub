export interface PublicVideo {
  title: string;
  description: string;
  url: string;
}

export interface PublicProgram {
  title: string;
  summary: string;
  topics: readonly string[];
  accent: "mint" | "blue" | "coral";
}

export interface PublicTestimonial {
  id: string;
  guardianLabel: string;
  studentLevel: string;
  quote: string;
  verified: true;
}

const siteUrl = "https://tienganhcovy.com";

// Phản hồi ẩn danh, dựa trên chia sẻ thực tế và đã được chủ website xác nhận.
const verifiedParentTestimonials: PublicTestimonial[] = [
  {
    id: "guardian-m-grade-2",
    guardianLabel: "Mẹ bé M.",
    studentLevel: "Học sinh lớp 2",
    quote: "Trước đây bé khá ngại học tiếng Anh, nhất là phần đọc và nhớ từ. Học với cô một thời gian, bé chủ động xem lại bài hơn, về nhà còn tự đọc lại những từ đã học.",
    verified: true,
  },
  {
    id: "guardian-n-grade-6",
    guardianLabel: "Mẹ bé N.",
    studentLevel: "Học sinh lớp 6",
    quote: "Con bị hổng ngữ pháp nên lúc làm bài thường khá rối và dễ nản. Sau một thời gian được hướng dẫn lại từng phần, con hiểu bài hơn và làm bài cũng chắc hơn trước.",
    verified: true,
  },
  {
    id: "guardian-h-grade-9",
    guardianLabel: "Phụ huynh bé H.",
    studentLevel: "Học sinh lớp 9",
    quote: "Giai đoạn ôn thi gia đình khá lo vì con chưa biết nên tập trung vào phần nào. Nhờ được sửa kỹ từng lỗi và hướng dẫn cách làm bài, con bình tĩnh và tự tin hơn nhiều.",
    verified: true,
  },
];

/**
 * Source of truth for stable Homepage copy, contact details and local media.
 */
export const publicHomeContent = {
  siteUrl,
  teacherName: "Uyên Vy",
  teacherBrandName: "Cô Vy",
  brandName: "Lớp tiếng Anh cô Vy",
  headerBrandName: "Lớp tiếng Anh cô Vy",
  subject: "Tiếng Anh",
  levels: "Mầm non, tiểu học và THCS",
  location: "Huế",
  hero: {
    eyebrow: "TIẾNG ANH LỚP 1–9 · HUẾ",
    heading: "Cô Vy dạy tiếng Anh tại Huế",
    description: "Đồng hành cùng học sinh từ nền tảng đến luyện thi, theo hình thức 1–1 hoặc lớp nhóm.",
  },
  teacherProfile: {
    heading: "Người đồng hành cùng học sinh",
    biography: "Cô Vy đồng hành cùng học sinh theo năng lực, tập trung xây nền tảng chắc, củng cố phần còn yếu và giúp các em tự tin hơn khi sử dụng tiếng Anh.",
    experience: [
      "5 năm kinh nghiệm giảng dạy",
      "Từng giảng dạy tại Kindle, Amigo và Let’s Shine",
      "Hiện là giáo viên tại DTP Education Solutions",
      "Thực tập tại Trường Tiểu học Phú Hòa, đạt 9.8/10 và đảm nhiệm vai trò Leader",
    ],
    qualifications: [
      "Xếp loại giỏi chuyên ngành tiếng Anh sư phạm bậc tiểu học",
      "Cử nhân ngành Ngôn ngữ Anh",
      "VSTEP 8.5/10, trình độ C1",
      "Chứng chỉ nghiệp vụ sư phạm",
      "Chứng chỉ quốc tế TESOL 120h",
    ],
  },
  media: {
    ogImage: "/images/covy-image-1200.jpg",
    teacherPhoto: "/images/covy-image-1200.jpg",
    teacherPhotoSources: [
      { srcSet: "/images/covy-image-480.webp 480w, /images/covy-image-768.webp 768w, /images/covy-image-1200.webp 1200w", type: "image/webp" },
    ],
    teacherPhotoAlt: "Cô Uyên Vy, giáo viên tiếng Anh tại Huế",
    teacherPhotoFocalPosition: "center 42%",
    logo: "/logo-covy.svg",
    logoAlt: "Logo Lớp tiếng Anh cô Vy",
    headerMark: "/favicon.svg",
  },
  contact: {
    zaloUrl: "https://zalo.me/0971697759",
    facebookUrl: "https://www.facebook.com/uyenvy.le.12",
    facebookLabel: "Facebook",
    facebookAriaLabel: "Facebook Uyên Vy Lê",
    heading: "Trao đổi về lớp học",
    description: "Ba mẹ có thể nhắn Zalo hoặc Facebook để trao đổi về mục tiêu và lịch học phù hợp cho con.",
    highlights: ["Học 1–1 hoặc lớp nhóm", "Trao đổi lịch trước khi học"],
  },
  locations: {
    heading: "Hình thức và địa điểm học",
    teacherHome: {
      title: "Học tại địa chỉ lớp",
      detail: "101 Kiệt 245 Bùi Thị Xuân, Huế",
    },
    studentHome: {
      title: "Học tại nhà học sinh",
      detail: "Nhận dạy trong khu vực Huế",
    },
    note: "Phụ huynh vui lòng liên hệ trước để trao đổi lịch học phù hợp.",
  },
  methods: [
    { title: "Bám sát năng lực", detail: "Xác định phần kiến thức còn hổng và chọn nhịp học phù hợp với từng học sinh." },
    { title: "Học để sử dụng", detail: "Kết hợp phát âm, từ vựng, mẫu câu và ngữ pháp trong bài tập có ngữ cảnh." },
    { title: "Củng cố đều đặn", detail: "Ôn lại kiến thức, luyện kỹ năng và phản hồi rõ nội dung cần tiếp tục rèn." },
  ],
  programs: [
    {
      title: "Tiếng Anh nền tảng",
      summary: "Mầm non và tiểu học lớp 1–5. Phát âm, từ vựng, mẫu câu và giao tiếp cơ bản.",
      topics: ["Mầm non và lớp 1–5", "Học 1–1 hoặc lớp nhóm"],
      accent: "mint",
    },
    {
      title: "Tiếng Anh THCS",
      summary: "Dành cho học sinh lớp 6–9. Củng cố ngữ pháp, từ vựng, đọc hiểu và kỹ năng làm bài.",
      topics: ["Tiếng Anh lớp 6–9", "Bám sát phần kiến thức còn yếu"],
      accent: "blue",
    },
    {
      title: "Luyện thi theo mục tiêu",
      summary: "Luyện thi Nguyễn Tri Phương và lớp 9 lên 10. Hệ thống kiến thức, luyện dạng bài và chiến lược làm bài.",
      topics: ["Luyện thi Nguyễn Tri Phương", "Ôn thi lớp 9 lên 10"],
      accent: "coral",
    },
  ] satisfies PublicProgram[],
  videos: [
    {
      title: "Từ vựng tiếng Anh qua ngữ cảnh",
      description: "Luyện nghe, nhắc lại và ghi nhớ từ mới trong tình huống gần gũi.",
      url: "https://www.youtube.com/watch?v=H6SSRhF9K3A",
    },
    {
      title: "Hoạt động hằng ngày bằng tiếng Anh",
      description: "Luyện nghe và nhắc lại từ, mẫu câu quen thuộc.",
      url: "https://www.youtube.com/watch?v=qD1pnquN_DM",
    },
  ] satisfies PublicVideo[],
  testimonials: verifiedParentTestimonials,
  seo: {
    title: "Lớp tiếng Anh cô Vy tại Huế | Mầm non đến THCS",
    description: "Lớp tiếng Anh cô Vy tại Huế dành cho học sinh mầm non, tiểu học và THCS. Có lớp 1–1, lớp nhóm, luyện thi và nhận dạy tại nhà học sinh.",
  },
  footer: {
    copy: "2026 — từ người hâm mộ cô Vy, with love ❤️",
  },
} as const;

export const publicHomeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: "Lớp tiếng Anh cô Vy",
      alternateName: ["Tiếng Anh cô Vy", "Cô Vy"],
      inLanguage: "vi-VN",
    },
    {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#business`,
      name: "Lớp tiếng Anh cô Vy",
      url: `${siteUrl}/`,
      logo: `${siteUrl}/logo-covy.svg`,
      image: `${siteUrl}/images/covy-image-1200.jpg`,
      description: "Lớp tiếng Anh cô Vy tại Huế dành cho học sinh mầm non, tiểu học và THCS. Có lớp 1–1, lớp nhóm, luyện thi và nhận dạy tại nhà học sinh.",
      areaServed: {
        "@type": "City",
        name: "Huế",
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: "101 Kiệt 245 Bùi Thị Xuân",
        addressLocality: "Huế",
        addressCountry: "VN",
      },
      sameAs: [
        "https://www.facebook.com/uyenvy.le.12",
        "https://zalo.me/0971697759",
      ],
      founder: { "@id": `${siteUrl}/#teacher` },
    },
    {
      "@type": "Person",
      "@id": `${siteUrl}/#teacher`,
      name: "Uyên Vy",
      alternateName: "Cô Vy",
      url: `${siteUrl}/`,
      image: `${siteUrl}/images/covy-image-1200.jpg`,
      jobTitle: "Giáo viên tiếng Anh",
      worksFor: { "@id": `${siteUrl}/#business` },
      sameAs: ["https://www.facebook.com/uyenvy.le.12"],
    },
  ],
} as const;
