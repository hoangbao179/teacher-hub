import type { LearningLevel, LearningUnit, VocabularyItem } from "../types.ts";

const words = (prefix: string, entries: readonly [string, string, string, string, string?][]): VocabularyItem[] =>
  entries.map(([word, phonetic, vietnameseMeaning, image, example], index) => ({
    id: `${prefix}-${index + 1}`,
    word,
    phonetic,
    vietnameseMeaning,
    image,
    speechText: word,
    ...(example ? { example } : {}),
  }));

export const learningLevels: readonly LearningLevel[] = [
  { id: "preschool", slug: "mam-non", name: "Mầm non", group: "EARLY", accent: "#f5a623", mascot: "🐻", available: true },
  { id: "grade-1", slug: "lop-1", name: "Lớp 1", group: "PRIMARY", accent: "#e76f8b", mascot: "🐰", available: false, grade: 1 },
  { id: "grade-2", slug: "lop-2", name: "Lớp 2", group: "PRIMARY", accent: "#4c9fe8", mascot: "🐱", available: false, grade: 2 },
  { id: "grade-3", slug: "lop-3", name: "Lớp 3", group: "PRIMARY", accent: "#4f9f78", mascot: "🦊", available: true, grade: 3 },
  { id: "grade-4", slug: "lop-4", name: "Lớp 4", group: "PRIMARY", accent: "#ee8b2d", mascot: "🐯", available: false, grade: 4 },
  { id: "grade-5", slug: "lop-5", name: "Lớp 5", group: "PRIMARY", accent: "#6f61b8", mascot: "🐼", available: false, grade: 5 },
  { id: "grade-6", slug: "lop-6", name: "Lớp 6", group: "SECONDARY", accent: "#547ad6", mascot: "🐬", available: false, grade: 6 },
  { id: "grade-7", slug: "lop-7", name: "Lớp 7", group: "SECONDARY", accent: "#26988e", mascot: "🦉", available: false, grade: 7 },
  { id: "grade-8", slug: "lop-8", name: "Lớp 8", group: "SECONDARY", accent: "#c6537d", mascot: "🦄", available: false, grade: 8 },
  { id: "grade-9", slug: "lop-9", name: "Lớp 9", group: "SECONDARY", accent: "#7455c5", mascot: "🐺", available: false, grade: 9 },
] as const;

export const learningUnits: readonly LearningUnit[] = [
  {
    id: "preschool-happy-animals", slug: "con-vat-dang-yeu", levelSlug: "mam-non", title: "Con vật đáng yêu", description: "Gọi tên những người bạn nhỏ quanh con.", icon: "🐾", status: "PUBLISHED", contentVersion: 1,
    vocabulary: words("pa", [
      ["cat", "/kæt/", "con mèo", "/learning/animals/cat.svg", "The cat is soft."], ["dog", "/dɒɡ/", "con chó", "🐶", "The dog can run."],
      ["bird", "/bɜːd/", "con chim", "🐦"], ["fish", "/fɪʃ/", "con cá", "🐟"], ["duck", "/dʌk/", "con vịt", "🦆"],
      ["rabbit", "/ˈræb.ɪt/", "con thỏ", "🐰"], ["cow", "/kaʊ/", "con bò", "🐮"], ["pig", "/pɪɡ/", "con lợn", "🐷"],
      ["bee", "/biː/", "con ong", "🐝"], ["frog", "/frɒɡ/", "con ếch", "🐸"],
    ]),
  },
  {
    id: "preschool-colour-garden", slug: "khu-vuon-sac-mau", levelSlug: "mam-non", title: "Khu vườn sắc màu", description: "Nhận biết màu sắc qua đồ vật quen thuộc.", icon: "🌈", status: "PUBLISHED", contentVersion: 1,
    vocabulary: words("pc", [
      ["red", "/red/", "màu đỏ", "🔴"], ["blue", "/bluː/", "màu xanh dương", "🔵"], ["yellow", "/ˈjel.əʊ/", "màu vàng", "🟡"],
      ["green", "/ɡriːn/", "màu xanh lá", "🟢"], ["orange", "/ˈɒr.ɪndʒ/", "màu cam", "🟠"], ["purple", "/ˈpɜː.pəl/", "màu tím", "🟣"],
      ["pink", "/pɪŋk/", "màu hồng", "🌸"], ["white", "/waɪt/", "màu trắng", "☁️"], ["black", "/blæk/", "màu đen", "⬛"], ["brown", "/braʊn/", "màu nâu", "🟫"],
    ]),
  },
  {
    id: "grade3-school-day", slug: "ngay-o-truong", levelSlug: "lop-3", title: "Một ngày ở trường", description: "Từ vựng gần gũi trong lớp học.", icon: "🎒", status: "PUBLISHED", contentVersion: 1,
    vocabulary: words("gs", [
      ["book", "/bʊk/", "quyển sách", "📘"], ["pen", "/pen/", "bút mực", "🖊️"], ["pencil", "/ˈpen.səl/", "bút chì", "✏️"],
      ["ruler", "/ˈruː.lər/", "thước kẻ", "📏"], ["bag", "/bæɡ/", "cặp sách", "🎒"], ["desk", "/desk/", "bàn học", "🪑"],
      ["board", "/bɔːd/", "bảng", "▰"], ["teacher", "/ˈtiː.tʃər/", "giáo viên", "👩‍🏫"], ["friend", "/frend/", "người bạn", "🧑‍🤝‍🧑"], ["lesson", "/ˈles.ən/", "bài học", "📝"],
    ]),
  },
  {
    id: "grade3-family-home", slug: "gia-dinh-cua-em", levelSlug: "lop-3", title: "Gia đình của em", description: "Nói về gia đình bằng những từ đơn giản.", icon: "🏡", status: "PUBLISHED", contentVersion: 1,
    vocabulary: words("gf", [
      ["family", "/ˈfæm.əl.i/", "gia đình", "👨‍👩‍👧‍👦"], ["mother", "/ˈmʌð.ər/", "mẹ", "👩"], ["father", "/ˈfɑː.ðər/", "bố", "👨"],
      ["sister", "/ˈsɪs.tər/", "chị hoặc em gái", "👧"], ["brother", "/ˈbrʌð.ər/", "anh hoặc em trai", "👦"], ["grandmother", "/ˈɡræn.mʌð.ər/", "bà", "👵"],
      ["grandfather", "/ˈɡræn.fɑː.ðər/", "ông", "👴"], ["home", "/həʊm/", "nhà", "🏠"], ["happy", "/ˈhæp.i/", "vui vẻ", "😊"], ["love", "/lʌv/", "yêu thương", "💜"],
    ]),
  },
] as const;

export const publishedUnits = learningUnits.filter((unit) => unit.status === "PUBLISHED");
export const unitsForLevel = (levelSlug: string) => publishedUnits.filter((unit) => unit.levelSlug === levelSlug);
export const levelBySlug = (slug: string) => learningLevels.find((level) => level.slug === slug);
export const unitBySlugs = (levelSlug: string, unitSlug: string) =>
  publishedUnits.find((unit) => unit.levelSlug === levelSlug && unit.slug === unitSlug);
