export interface PublicVideo {
  title: string;
  description: string;
  url: string;
}

export interface PublicTestimonial {
  id: string;
  guardianLabel: string;
  studentLevel: string;
  quote: string;
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

// Nội dung mẫu, giữ cấu trúc này để thay bằng phản hồi thật sau này.
const parentTestimonials: PublicTestimonial[] = [
  {
    id: "guardian-m-grade-2",
    guardianLabel: "Mẹ bé M.",
    studentLevel: "Học sinh lớp 2",
    quote: "Trước đây bé khá ngại học tiếng Anh, nhất là phần đọc và nhớ từ. Học với cô một thời gian, bé chủ động xem lại bài hơn, về nhà còn tự đọc lại những từ cô đã hướng dẫn.",
  },
  {
    id: "guardian-n-grade-6",
    guardianLabel: "Mẹ bé N.",
    studentLevel: "Học sinh lớp 6",
    quote: "Con bị hổng ngữ pháp nên lúc làm bài thường khá rối và dễ nản. Cô chỉ lại từng phần, giao bài vừa sức nên dần dần con hiểu bài hơn và làm bài cũng chắc hơn trước.",
  },
  {
    id: "guardian-h-grade-9",
    guardianLabel: "Phụ huynh bé H.",
    studentLevel: "Học sinh lớp 9",
    quote: "Giai đoạn ôn thi gia đình khá lo vì con chưa biết nên tập trung vào phần nào. Cô theo sát, sửa kỹ từng lỗi và hướng dẫn cách làm bài nên con bình tĩnh và tự tin hơn nhiều.",
  },
];

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
  testimonials: parentTestimonials,
  seo: {
    title: "Lớp học tiếng Anh cô Vy | Tiếng Anh lớp 1–9 tại Huế",
    description: "Kèm cặp tiếng Anh 1–1 và lớp nhóm nhỏ cho học sinh lớp 1–9 tại Huế.",
  },
  footer: "2026 — từ người hâm mộ cô Vy, with love ❤️",
} as const;
