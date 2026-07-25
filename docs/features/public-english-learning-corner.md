# Góc học tiếng Anh miễn phí cùng cô Vy

> Status: **GLOBAL SUCCESS LỚP 1–9 RELEASED — PASS (25/07/2026)**
> Technical name: **Public English Learning Corner**  
> Target: public learning module sau V1  
> Primary route family: `/hoc/*`  
> Authentication: **không yêu cầu trong MVP**  
> Wireframe: [`../wireframes/19-public-english-learning-corner.png`](../wireframes/19-public-english-learning-corner.png)

## 1. Mục tiêu

Bổ sung một khu vực học tiếng Anh miễn phí trên `tienganhcovy.com` dành cho học
sinh từ mầm non/mẫu giáo đến lớp 9. Website vẫn giữ vai trò chính là giới thiệu
lớp tiếng Anh cô Vy và hỗ trợ phụ huynh liên hệ; khu vực `/hoc/*` là một trải
nghiệm học độc lập, công khai và không yêu cầu tài khoản.

MVP đầu tiên tập trung vào học từ vựng:

- chọn cấp/lớp và Unit hoặc chủ đề;
- học flashcard, xem nghĩa và nghe phát âm;
- luyện tập chọn nghĩa;
- xem kết quả và ôn lại từ sai;
- lưu tiến độ cục bộ trên đúng trình duyệt đang sử dụng;
- không đọc hoặc ghi dữ liệu quản trị lớp, học sinh, học phí hay lịch học;
- hoạt động tốt trên mobile 360–430 px và desktop.

Đây không phải LMS, hệ thống thi chính thức hoặc cổng tài khoản học sinh.

## 2. Đối tượng và level

Các level công khai:

| Nhóm | Level slug | Nhãn hiển thị |
|---|---|---|
| Mầm non | `mam-non` | Mầm non |
| Tiểu học | `lop-1` đến `lop-5` | Lớp 1 đến Lớp 5 |
| THCS | `lop-6` đến `lop-9` | Lớp 6 đến Lớp 9 |

Quy tắc:

- không mô hình hóa mầm non bằng số `0`;
- không có lớp 10–12 trong feature này;
- level chưa có nội dung published vẫn xuất hiện với trạng thái `Sắp có`;
- giao diện có thể đổi accent theo nhóm tuổi nhưng không tạo ba hệ thống theme
  tách biệt.

## 3. Phạm vi MVP

### 3.1 Trong MVP

1. CTA gọn trên Homepage dẫn tới `/hoc`.
2. Public learning hub tại `/hoc`.
3. Chọn level từ mầm non đến lớp 9.
4. Chọn Unit hoặc chủ đề từ vựng.
5. Học flashcard theo từng từ.
6. Nghe phát âm khi nội dung hoặc trình duyệt hỗ trợ.
7. Làm trắc nghiệm chọn nghĩa.
8. Xem tổng câu, số đúng/sai, điểm phần trăm và từ cần ôn.
9. Ôn lại từ sai.
10. Lưu tiến độ bằng `localStorage`.
11. CTA liên hệ cô Vy qua Zalo sau khi hoàn thành.
12. Dữ liệu học được bundle tĩnh trong frontend.

### 3.2 Ngoài MVP

- tài khoản học sinh hoặc phụ huynh;
- đồng bộ tiến độ giữa thiết bị;
- dashboard theo dõi từng học sinh;
- giao bài bằng mã lớp/mã bài;
- bảng xếp hạng hoặc streak server-side;
- chấm phát âm bằng AI/microphone;
- bài kiểm tra trình độ;
- CMS/admin CRUD bộ từ;
- import Excel;
- PWA/offline;
- API hoặc migration database mới.

Các mục ngoài MVP chỉ được triển khai bằng feature/ADR riêng.

## 4. Nguyên tắc tích hợp

- `/` tiếp tục là Homepage marketing.
- Homepage chỉ thêm một CTA hoặc section gọn, không thiết kế lại toàn bộ trang.
- Không khôi phục slide/carousel Homepage.
- Footer Homepage phải giữ nguyên chính xác:

```text
2026 — từ người hâm mộ cô Vy, with love ❤️
```

- `/hoc/*` không nằm trong `AdminLayout`.
- `/hoc/*` không dùng admin token và không gọi API quản trị.
- Không hiển thị hoặc suy diễn dữ liệu học sinh trong hệ thống quản trị.
- Nội dung learning MVP là dữ liệu public tĩnh trong frontend.
- `/hoc` indexable; `/admin/*` vẫn giữ `noindex` theo cơ chế hiện tại.
- Business rule và tài liệu source of truth có ưu tiên cao hơn wireframe.

## 5. Luồng người dùng

```text
Homepage
  -> Góc học miễn phí
  -> Chọn mầm non/lớp
  -> Chọn Unit/chủ đề
  -> Học flashcard
  -> Làm bài luyện tập
  -> Xem kết quả
  -> Ôn lại từ sai hoặc học Unit khác
```

Học sinh không cần nhập tên. Không thu thập dữ liệu định danh trong MVP.

## 6. Route đề xuất

| Route | Mục đích |
|---|---|
| `/hoc` | Learning hub và chọn level |
| `/hoc/:levelSlug` | Danh sách Unit/chủ đề của level |
| `/hoc/:levelSlug/:unitSlug` | Tổng quan Unit |
| `/hoc/:levelSlug/:unitSlug/flashcards` | Học flashcard |
| `/hoc/:levelSlug/:unitSlug/listen` | Nghe từ và chọn nghĩa |
| `/hoc/:levelSlug/:unitSlug/quiz` | Quiz chọn nghĩa/từ, tối đa 10 câu |
| `/hoc/:levelSlug/:unitSlug/result` | Kết quả lượt quiz gần nhất |
| `/hoc/:levelSlug/:unitSlug/review` | Ôn từ sai hoặc đã đánh dấu cần ôn |

Quy tắc:

- `levelSlug` chỉ nhận `mam-non` hoặc `lop-1` đến `lop-9`;
- `unitSlug` phải tồn tại và ở trạng thái published;
- route không hợp lệ hiển thị public not-found thân thiện;
- refresh trực tiếp trên mọi route phải hoạt động sau build/deploy;
- không phụ thuộc duy nhất vào React Router `location.state` cho kết quả gần nhất.

## 7. Màn hình và hành vi

### 7.1 Homepage CTA

Nội dung gợi ý:

- eyebrow: `GÓC HỌC MIỄN PHÍ`;
- heading: `Học tiếng Anh vui hơn cùng cô Vy`;
- mô tả ngắn về flashcard và luyện tập theo lớp;
- CTA: `Bắt đầu học`.

Không dùng số liệu người học, rating hoặc claim chưa được xác minh.

### 7.2 Learning hub — chọn level

- hero vui tươi, ngắn gọn;
- hiển thị ba nhóm: Mầm non, Tiểu học, THCS;
- mỗi level là một card lớn, touch target tối thiểu 44 x 44 px;
- level có nội dung published mới điều hướng được;
- level chưa có nội dung hiển thị `Sắp có`;
- nhớ level gần nhất trên thiết bị;
- không tạo cảm giác đây là màn Admin.

### 7.3 Danh sách Unit/chủ đề

Mỗi Unit hiển thị:

- tên Unit/chủ đề;
- số lượng từ;
- tiến độ cục bộ;
- trạng thái `Mới`, `Đang học` hoặc `Hoàn thành`;
- CTA mở Unit.

Không khóa Unit theo thứ tự trong MVP.

### 7.4 Tổng quan Unit

Hiển thị:

- tiêu đề và mô tả Unit;
- số từ;
- tiến độ gần nhất;
- CTA `Học flashcard`;
- CTA `Luyện tập`;
- CTA `Tiếp tục học` khi có tiến độ dở dang.

### 7.5 Flashcard

Mỗi card có:

- từ tiếng Anh;
- phiên âm nếu có;
- loại từ nếu có;
- hình minh họa nếu có;
- nghĩa tiếng Việt sau khi bấm `Hiện nghĩa`;
- câu ví dụ sau khi bấm `Ví dụ`;
- nút nghe khi audio khả dụng;
- điều hướng `Trước` và `Tiếp theo`;
- thao tác `Tôi đã biết` và `Cần ôn`.

Quy tắc:

- nghĩa không tự hiện khi mở card;
- không tự phát âm thanh;
- nút nghe có accessible label chứa từ đang học;
- thao tác chỉ cập nhật local progress;
- CTA luyện tập khả dụng từ tổng quan Unit và sau khi duyệt flashcard.

### 7.6 Luyện tập chọn nghĩa

MVP có một dạng câu hỏi:

```text
Từ tiếng Anh -> chọn một trong bốn nghĩa tiếng Việt
```

Quy tắc:

- tối đa 10 câu mỗi lượt;
- Unit dưới 10 từ dùng toàn bộ từ;
- mỗi từ xuất hiện tối đa một lần trong một lượt;
- mỗi câu có một đáp án đúng và ba đáp án nhiễu duy nhất;
- Unit published có ít nhất 4 từ;
- shuffle câu hỏi và đáp án;
- random phải seed/inject được trong test;
- chọn đáp án rồi bấm `Kiểm tra`;
- thông báo đúng/sai bằng text, icon và màu;
- không cho đổi đáp án sau khi câu đã chấm.

### 7.7 Kết quả

Hiển thị:

- tổng câu;
- số đúng;
- số sai;
- điểm phần trăm làm tròn số nguyên;
- danh sách từ trả lời sai;
- CTA `Ôn lại từ sai`;
- CTA `Học Unit khác`;
- CTA liên hệ Zalo.

```text
scorePercent = round(correctCount / totalQuestions * 100)
```

Không ghi nhận completion khi lượt làm chưa hoàn tất.

## 8. Visual direction

### 8.1 Mục tiêu

Learning module phải vui tươi, cute và giàu chất giáo dục vì phục vụ học sinh từ
mầm non đến lớp 9. Thiết kế không được quá em bé đối với học sinh THCS và không
được làm Admin trở nên màu mè theo.

### 8.2 Ngôn ngữ hình ảnh

- màu chính: lavender/purple;
- màu phụ: sky blue, mint, warm yellow, coral, soft pink;
- card bo góc khoảng 20–24 px;
- border pastel và shadow mềm;
- icon minh họa: sao, trăng, mây, cầu vồng, sách, bút chì, bảng chữ cái, sparkle;
- decoration dùng `aria-hidden`, `pointer-events: none`;
- không che nội dung hoặc gây horizontal overflow;
- không dùng animation liên tục;
- hiệu ứng chúc mừng chỉ ngắn và tôn trọng `prefers-reduced-motion`.

### 8.3 Accent theo nhóm tuổi

| Nhóm | Accent đề xuất | Độ trang trí |
|---|---|---|
| Mầm non–lớp 2 | vàng, hồng, sky blue | nhiều hình khối mềm, icon lớn |
| Lớp 3–5 | mint, blue, orange | sách/bút chì, card sinh động |
| Lớp 6–9 | purple, indigo, teal | gọn hơn, ít nhân vật hơn |

Đây là accent, không phải ba theme độc lập.

### 8.4 Typography và accessibility

- ưu tiên chữ dễ đọc, không dùng font trang trí cho nội dung dài;
- heading có thể dùng `text-wrap: balance`;
- paragraph có thể dùng `text-wrap: pretty`;
- contrast tối thiểu theo WCAG AA;
- trạng thái không chỉ phân biệt bằng màu;
- focus-visible rõ;
- keyboard navigation đầy đủ;
- heading tuần tự;
- progress có text thay thế, ví dụ `Câu 3 trên 10`.

## 9. Mô hình nội dung

Vị trí đề xuất:

```text
client/src/features/learning/
  content/
    vocabularyCatalog.ts
  components/
  pages/
  storage/
  quiz/
  types.ts
```

Kiểu dữ liệu tham chiếu:

```ts
export type LearningLevelSlug =
  | "mam-non"
  | "lop-1"
  | "lop-2"
  | "lop-3"
  | "lop-4"
  | "lop-5"
  | "lop-6"
  | "lop-7"
  | "lop-8"
  | "lop-9";

export type VocabularyWord = {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaningVi: string;
  exampleEn?: string;
  exampleVi?: string;
  imageUrl?: string;
  audioUrl?: string;
};

export type VocabularyUnit = {
  id: string;
  slug: string;
  levelSlug: LearningLevelSlug;
  unitNumber?: number;
  title: string;
  description?: string;
  status: "DRAFT" | "PUBLISHED";
  contentVersion: number;
  words: VocabularyWord[];
};
```

Ràng buộc Unit published:

- `id` và `slug` duy nhất;
- `levelSlug` hợp lệ;
- `contentVersion` là số nguyên dương;
- có ít nhất 4 từ;
- `word` và `meaningVi` không rỗng;
- `VocabularyWord.id` duy nhất trong Unit;
- nghĩa đủ phân biệt để tạo đáp án;
- media là local asset hoặc HTTPS đã duyệt;
- không đưa nội dung có bản quyền không được phép vào repository.

Catalog public hiện có:

- 10 level khả dụng từ `mam-non` đến `lop-9`;
- 2 Unit mầm non với 10 từ/Unit và 140 Global Success starter Unit với 6 từ/Unit;
- từ vựng starter được cô Vy tiếp tục review và tăng `contentVersion` khi sửa;
- language focus/ngữ pháp vẫn là draft, chưa public;
- nội dung tự biên soạn theo chủ đề, không phải học liệu chính thức của Nhà xuất bản.

## 10. Lưu tiến độ cục bộ

Storage key:

```text
covy-learning-progress:v1
```

Kiểu dữ liệu:

```ts
export type LearningProgressStore = {
  schemaVersion: 1;
  lastLevelSlug?: LearningLevelSlug;
  lastUnitSlug?: string;
  units: Record<string, {
    contentVersion: number;
    viewedItemIds: string[];
    rememberedItemIds: string[];
    reviewItemIds: string[];
    lastItemIndex: number;
    flashcardCompletedAt?: string;
    listenCorrect: number;
    listenTotal: number;
    quizAttempts: QuizAttempt[]; // tối đa 10 lượt gần nhất
    bestScore?: number;
    latestScore?: number;
    wrongItemIds: string[];
    completedAt?: string;
    reviewCompletedAt?: string;
    activeQuiz?: ActiveQuizSession; // resume sau refresh
    updatedAt: string;
  }>;
};
```

Quy tắc:

- JSON hỏng không làm crash trang;
- schema không hỗ trợ thì reset store;
- thay `contentVersion` chỉ reset đúng Unit;
- lỗi ghi storage không chặn trải nghiệm học;
- không lưu token, số điện thoại, dữ liệu phụ huynh hoặc admin;
- có hành động `Xóa tiến độ trên thiết bị này` trước khi phát hành rộng.

Tùy chọn tốc độ phát âm lưu riêng tại `covy-learning-settings:v1`, không thay đổi
schema progress. Giá trị mặc định `NORMAL` phát ở 0.88x; `SLOW` phát ở 0.6x.

## 11. Âm thanh

Ưu tiên:

1. `audioUrl` đã được kiểm duyệt;
2. browser `SpeechSynthesis` với locale tiếng Anh;
3. ẩn/disable nút nghe với mô tả phù hợp.

Cả audio asset và Web Speech phải tôn trọng tốc độ người học đã chọn. Không
autoplay và không yêu cầu microphone.

## 12. SEO, privacy và fallback

### SEO

- `/hoc` và trang level có title/description riêng;
- Unit có canonical URL ổn định;
- không index route kết quả tạm;
- không thêm rating/review/schema chưa được xác minh;
- phase đầu tối thiểu prerender `/hoc`;
- direct navigation `/hoc/*` phải hoạt động.

### Privacy

MVP không thu thập định danh học sinh. Analytics chỉ dùng event tổng hợp, không
gửi nickname, raw answer hoặc danh sách từ sai.

### Fallback

Có trạng thái rõ cho:

- level chưa có nội dung;
- Unit không tồn tại hoặc đã unpublish;
- dữ liệu Unit không hợp lệ;
- audio/media không khả dụng;
- localStorage bị chặn;
- URL cũ sau khi đổi slug.

Không hiển thị stack trace hoặc internal identifier ra public UI.

## 13. Kế hoạch triển khai

### V18A — Foundation

- types và catalog validator;
- seed tối thiểu 2 Unit;
- learning shell;
- route `/hoc`;
- chọn level mầm non/lớp 1–9;
- localStorage foundation;
- CTA gọn trên Homepage;
- public not-found/direct navigation;
- visual foundation cute;
- chưa bắt buộc quiz hoàn chỉnh.

### V18B — Unit và flashcard

- **IMPLEMENTED — PASS 24/07/2026**;
- danh sách và tổng quan Unit;
- flashcard, swipe và keyboard;
- audio asset/Web Speech fallback, không autoplay/overlap;
- luyện nghe deterministic và remembered/review local state;
- migration an toàn từ progress V18A và reset theo Unit.

### V18C — Quiz và kết quả

- **IMPLEMENTED — PASS 24/07/2026**;
- question generator;
- quiz UI;
- scoring;
- kết quả;
- ôn từ sai;
- persisted progress.

### V18D — Release quality

- **IMPLEMENTED — PASS 24/07/2026**;
- SEO/prerender;
- responsive toàn dải;
- accessibility;
- E2E/regression;
- release verification.

### Global Success lớp 1–9 — Public release

- **IMPLEMENTED — PASS 25/07/2026**;
- Hub mở đủ 10 level và danh sách 142 Unit published;
- grid Unit responsive 1/2/3 cột, quiz dùng số câu thực tế;
- prerender 154 trang public và sitemap production sinh trực tiếp từ catalog;
- 140 Unit starter có 6 từ cơ bản/Unit; nội dung vẫn cần giáo viên tiếp tục review;
- language focus/ngữ pháp chưa triển khai.

Không gộp admin CRUD, backend API hoặc login học sinh vào các task trên.

## 14. Acceptance cấp feature

1. Người dùng chưa đăng nhập mở `/hoc` bình thường.
2. `/hoc/*` không gọi API class/student/lesson/tuition/auth admin.
3. Có mầm non và lớp 1–9; không có lớp 10–12.
4. Level chưa có Unit published hiển thị `Sắp có`.
5. Refresh trực tiếp URL published thành công trên production build.
6. Flashcard không tự hiện nghĩa và không autoplay.
7. Quiz có một đáp án đúng và ba đáp án nhiễu duy nhất.
8. Kết quả đúng với các câu đã chấm.
9. Có thể ôn lại từ sai.
10. Progress phục hồi trên cùng thiết bị khi storage khả dụng.
11. Storage hỏng không làm crash trang.
12. Thay content version chỉ reset đúng Unit.
13. Viewport 360–430 px không có page-level horizontal scroll.
14. Feedback đúng/sai không chỉ dựa vào màu.
15. Homepage, contact, footer, public 404 và Admin không regression.
16. UI cute, nhiều màu nhưng vẫn dễ đọc với học sinh lớp 6–9.

## 15. Definition of Done

Feature chỉ được xem là hoàn thành khi:

- các acceptance tương ứng V18A–V18D đạt PASS;
- typecheck, lint, build, unit và E2E hiện có tiếp tục pass;
- production phục vụ direct route `/hoc/*`;
- không có migration hoặc auth change ngoài phạm vi;
- không dùng admin data/API trong public learning flow;
- nội dung seed được chủ website/cô Vy duyệt;
- tiếng Việt, phiên âm, nghĩa và ví dụ được rà soát;
- responsive được kiểm tra tại 360, 375, 390, 393, 400, 412, 430 và desktop;
- tài liệu feature, task, acceptance và wireframe đồng bộ;
- `docs/implementation/status.md` chỉ cập nhật sau khi code và verification hoàn tất.
