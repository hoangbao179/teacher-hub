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

// Chỉ thêm phản hồi thật đã được xác minh và cho phép công khai.
const verifiedParentTestimonials: PublicTestimonial[] = [];

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
    eyebrow: "LỚP TIẾNG ANH CÔ VY · HUẾ",
    heading: "Cô Vy dạy tiếng Anh tại Huế",
    description: "Lớp tiếng Anh tại Huế cho học sinh mầm non, tiểu học và THCS; học 1–1 hoặc theo lớp, củng cố kiến thức và luyện thi theo mục tiêu.",
  },
  teacherProfile: {
    heading: "Giới thiệu giáo viên Uyên Vy",
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
    heading: "Liên hệ lớp tiếng Anh cô Vy",
    description: "Ba mẹ có thể nhắn Zalo hoặc Facebook để trao đổi về năng lực hiện tại, mục tiêu và lịch học phù hợp cho con.",
    highlights: ["Lớp 1–1 và lớp nhóm", "Mầm non đến THCS", "Tại Huế"],
  },
  locations: {
    heading: "Địa điểm học tiếng Anh tại Huế",
    teacherHome: {
      title: "Học tại nhà cô Vy",
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
      title: "Tiếng Anh mầm non",
      summary: "Làm quen với âm, từ vựng và mẫu câu cơ bản qua hoạt động vừa sức.",
      topics: ["Tạo hứng thú với tiếng Anh", "Rèn nghe và phản xạ ban đầu"],
      accent: "mint",
    },
    {
      title: "Tiếng Anh tiểu học",
      summary: "Xây nền phát âm, từ vựng và mẫu câu; củng cố kiến thức theo chương trình.",
      topics: ["Tiếng Anh lớp 1–5", "Học 1–1 hoặc theo lớp"],
      accent: "blue",
    },
    {
      title: "Tiếng Anh THCS",
      summary: "Củng cố ngữ pháp, kỹ năng làm bài và phần kiến thức còn yếu.",
      topics: ["Tiếng Anh lớp 6–9", "Bám sát mục tiêu từng học sinh"],
      accent: "coral",
    },
    {
      title: "Luyện thi Nguyễn Tri Phương",
      summary: "Ôn tập theo mục tiêu tuyển sinh và năng lực hiện tại của học sinh.",
      topics: ["Củng cố kiến thức trọng tâm", "Luyện kỹ năng làm bài"],
      accent: "mint",
    },
    {
      title: "Luyện thi lớp 9 lên 10 môn Anh",
      summary: "Hệ thống kiến thức và luyện dạng bài cho kỳ thi vào lớp 10 tại Huế.",
      topics: ["Ôn theo phần còn yếu", "Rèn chiến lược làm bài"],
      accent: "blue",
    },
    {
      title: "Tiếng Anh giao tiếp cơ bản",
      summary: "Luyện nghe, phát âm và mẫu câu thông dụng trong các tình huống quen thuộc.",
      topics: ["Giao tiếp nền tảng", "Tăng sự tự tin khi sử dụng tiếng Anh"],
      accent: "coral",
    },
  ] satisfies PublicProgram[],
  videos: [
    {
      title: "Từ vựng tiếng Anh qua ngữ cảnh",
      description: "Video học tiếng Anh tham khảo giúp học sinh nghe, nhắc lại và ghi nhớ từ mới trong tình huống gần gũi.",
      url: "https://www.youtube.com/watch?v=H6SSRhF9K3A",
    },
    {
      title: "Hoạt động hằng ngày bằng tiếng Anh",
      description: "Video học tiếng Anh tham khảo giúp học sinh luyện nghe và nhắc lại từ, mẫu câu quen thuộc.",
      url: "https://www.youtube.com/watch?v=qD1pnquN_DM",
    },
  ] satisfies PublicVideo[],
  testimonials: verifiedParentTestimonials,
  faq: {
    heading: "Câu hỏi thường gặp về lớp tiếng Anh cô Vy",
    items: [
      {
        question: "Cô Vy nhận dạy học sinh ở độ tuổi nào?",
        answer: "Cô Vy nhận dạy học sinh mầm non, tiểu học và THCS, cùng các chương trình luyện thi theo mục tiêu.",
      },
      {
        question: "Có lớp 1–1 và lớp nhóm không?",
        answer: "Có. Hình thức học được sắp xếp theo nhu cầu và chương trình phù hợp.",
      },
      {
        question: "Học sinh có thể học ở đâu?",
        answer: "Học sinh có thể học tại nhà cô Vy ở 101 Kiệt 245 Bùi Thị Xuân, Huế, hoặc tại nhà học sinh trong khu vực Huế.",
      },
      {
        question: "Cô Vy có luyện thi lớp 10 môn tiếng Anh không?",
        answer: "Có chương trình củng cố kiến thức và luyện dạng bài phù hợp cho kỳ thi vào lớp 10.",
      },
      {
        question: "Có luyện thi Nguyễn Tri Phương không?",
        answer: "Có ôn tập theo năng lực hiện tại và mục tiêu của học sinh.",
      },
    ],
  },
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
