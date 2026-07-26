# Giao bài và trò chơi ôn từ vựng

> Status: **PLANNED — READY FOR IMPLEMENTATION BREAKDOWN**
> Technical name: **Vocabulary Assignments and Games**
> Primary teacher route family: `/admin/vocabulary/*`, `/admin/assignments/*`
> Primary student route family: `/play/*`
> Authentication: **giáo viên đăng nhập; học sinh không cần tài khoản**
> Responsive priority: **mobile-first 360–430 px; hỗ trợ tablet và desktop**
> Wireframes:
> - [`../wireframes/22-vocabulary-assignment-teacher-mobile.png`](../wireframes/22-vocabulary-assignment-teacher-mobile.png)
> - [`../wireframes/23-vocabulary-assignment-teacher-desktop.png`](../wireframes/23-vocabulary-assignment-teacher-desktop.png)
> - [`../wireframes/24-vocabulary-games-student-mobile.png`](../wireframes/24-vocabulary-games-student-mobile.png)
> - [`../wireframes/25-vocabulary-games-student-desktop.png`](../wireframes/25-vocabulary-games-student-desktop.png)
> - [`../wireframes/26-vocabulary-assignment-results-responsive.png`](../wireframes/26-vocabulary-assignment-results-responsive.png)

## 1. Mục tiêu

Bổ sung một tính năng để cô giáo có thể tạo bộ từ vựng, giao cho một lớp, một số
học sinh hoặc chia sẻ bằng link mở. Học sinh ôn từ qua các trò chơi ngắn, trực
quan và vui nhộn; kết quả được lưu trên server để giáo viên biết học sinh đã nhớ
từ nào và còn yếu từ nào.

Feature này mở rộng module `/hoc/*` hiện tại nhưng không thay thế nó:

- `/hoc/*`: nội dung công khai, học tự do, tiến độ cục bộ trên trình duyệt;
- `/play/*`: bài cô giáo giao, lưu tiến độ và kết quả trên server;
- `/admin/vocabulary/*`: quản lý chủ đề và bộ từ;
- `/admin/assignments/*`: tạo, giao và theo dõi bài.

Mục tiêu trải nghiệm:

```text
Giáo viên chọn lớp hoặc bỏ qua
  -> chọn chủ đề hoặc nhập từ
  -> hệ thống đề xuất Từ cơ bản trước
  -> hệ thống gợi ý hình, nghĩa, phát âm và trò chơi
  -> giáo viên duyệt nhanh
  -> gửi link/QR
  -> học sinh chạm, nghe và chơi
  -> giáo viên xem từ đã nhớ và từ cần ôn
```

## 2. Nguyên tắc sản phẩm

### 2.1 Giáo viên thao tác nhanh

Giáo viên không phải:

- upload thủ công ảnh cho từng từ;
- tự ghi âm từng từ;
- tự tạo từng câu hỏi;
- tự nghĩ đáp án nhiễu;
- cấu hình một danh sách dài trước khi giao bài.

Hệ thống phải hỗ trợ:

- chọn chủ đề để lấy danh sách từ có sẵn;
- chọn Unit từ catalog public hiện tại;
- dán nhiều từ từ Word hoặc Excel;
- tìm và chọn hình ngay trong hệ thống;
- gợi ý ảnh hàng loạt;
- tự sinh trò chơi từ cùng một bộ từ;
- preview dưới góc nhìn học sinh trước khi giao.

### 2.2 Học sinh nhỏ tuổi là trung tâm

- Không yêu cầu tài khoản, email hoặc mật khẩu.
- Một màn hình chỉ có một nhiệm vụ chính.
- Nút và lựa chọn lớn, vùng bấm tối thiểu 56 px trong game.
- Mầm non và lớp 1 ưu tiên hình ảnh và âm thanh, hạn chế chữ.
- Không bắt buộc kéo-thả chính xác; ưu tiên chạm đối tượng rồi chạm đích.
- Không hiển thị điểm phần trăm gây áp lực cho trẻ nhỏ.
- Trả lời sai được hướng dẫn thử lại, không dùng thông điệp nặng nề.
- Mỗi phiên chơi mục tiêu 3–7 phút.
- Motion ngắn, không liên tục, tôn trọng `prefers-reduced-motion`.

### 2.3 Mobile-first nhưng không mobile-only

- Giáo viên có thể tạo bài hoàn chỉnh trên điện thoại 360–430 px.
- Desktop tận dụng chiều rộng bằng layout hai hoặc ba cột, không chỉ kéo giãn
  giao diện mobile.
- Học sinh có thể chơi trên điện thoại, tablet hoặc máy tính.
- Desktop game vẫn giữ vùng chơi tập trung, không đưa sidebar Admin vào màn học.
- Không có page-level horizontal scroll ở bất kỳ breakpoint nào.

## 3. Đối tượng và cách truy cập

### 3.1 Giáo viên

Sử dụng tài khoản Admin hiện tại. V1 tiếp tục chỉ có một giáo viên/admin theo
business rule của repository.

### 3.2 Học sinh

Học sinh không có tài khoản. Hỗ trợ ba cách truy cập:

1. **Link cá nhân**: ưu tiên khi giáo viên gửi qua Zalo.
2. **QR cá nhân hoặc QR bài**: phù hợp tablet và học tại lớp.
3. **Mã bài + chọn avatar/tên**: dùng khi nhiều học sinh chia sẻ một thiết bị.

Không hiển thị danh sách toàn bộ học sinh nếu link không được phép truy cập lớp.
Token công khai phải ngẫu nhiên, không chứa `studentId` và có thể thu hồi.

## 4. Luồng tạo bài dành cho giáo viên

Wizard gồm năm bước logic. Trên mobile có thể trình bày thành các màn nối tiếp;
trên desktop dùng stepper bên trái và nội dung chính ở giữa.

### Bước 1 — Người nhận

Giáo viên chọn một trong ba chế độ:

- `CLASS`: giao cho một lớp đang hoạt động;
- `SELECTED_STUDENTS`: chọn một hoặc nhiều học sinh;
- `OPEN_LINK`: bất kỳ ai có link đều có thể chơi.

Có nút `Bỏ qua, chọn người nhận sau` khi giáo viên muốn soạn bộ từ trước.

Khi publish bài cho lớp, hệ thống snapshot danh sách học sinh tại thời điểm giao.
Việc chuyển lớp sau đó không làm thay đổi lịch sử bài cũ.

### Bước 2 — Chọn nguồn từ vựng

Bốn nguồn:

1. `TOPIC_CATALOG`: chọn chủ đề và nhận từ đề xuất;
2. `PUBLIC_UNIT`: sao chép Unit từ `/hoc/*`;
3. `EXISTING_SET`: dùng lại hoặc nhân bản bộ từ cũ;
4. `MANUAL`: nhập/dán danh sách từ.

Mặc định đưa `Chọn theo chủ đề` lên đầu vì đây là luồng nhanh nhất cho trẻ nhỏ.

### Bước 3 — Duyệt từ và hình

Mỗi từ có:

- từ tiếng Anh;
- nghĩa tiếng Việt;
- phiên âm;
- loại từ;
- câu ví dụ ngắn;
- ảnh minh họa tùy chọn;
- text dùng để phát âm;
- trạng thái `Từ cơ bản` hoặc `Mở rộng`;
- độ tuổi/lớp phù hợp.

Giáo viên có thể:

- bật/tắt từng từ;
- thêm từ riêng;
- đổi thứ tự;
- đổi nghĩa trong ngữ cảnh bài;
- tìm ảnh cho từng từ;
- dùng `Gợi ý ảnh cho tất cả`;
- preview nhanh flashcard.

### Bước 4 — Chọn lộ trình trò chơi

Thay vì chọn từng câu hỏi, giáo viên chọn một template:

- `Bé mới học`;
- `Nhớ mặt chữ`;
- `Ôn chính tả`;
- `Ôn trước kiểm tra`;
- `Tùy chỉnh`.

Hệ thống tự vô hiệu hóa trò không phù hợp. Ví dụ, từ không có ảnh không xuất
hiện trong trò nghe-chọn-hình.

### Bước 5 — Kiểm tra và giao bài

Hiển thị:

- tiêu đề;
- người nhận;
- số từ;
- lộ trình trò chơi;
- thời lượng ước tính;
- hạn hoàn thành;
- số lượt làm;
- chế độ phản hồi;
- preview mobile và desktop;
- nút `Giao bài`.

Sau khi publish:

- tạo link/QR;
- cho phép sao chép nội dung gửi Zalo;
- không tự gửi thông báo trong MVP;
- nội dung và người nhận được snapshot.

## 5. Chọn chủ đề và đề xuất từ

### 5.1 Quy tắc bắt buộc

Mỗi chủ đề phải có một catalog được biên soạn, gồm:

- `Từ cơ bản`: danh sách nền tảng, có thứ tự ưu tiên, được chọn sẵn;
- `Mở rộng`: từ bổ sung, không được chọn mặc định;
- độ tuổi/lớp phù hợp;
- nghĩa chính trong chủ đề;
- từ khóa tìm ảnh đã được làm rõ nghĩa;
- cờ cho biết từ có phù hợp trò dùng hình hay không.

Không dùng AI hoặc tìm kiếm tự do để quyết định toàn bộ `Từ cơ bản`. AI có thể
đề xuất thêm nhưng giáo viên phải duyệt và kết quả không được thay thế catalog
đã biên soạn.

### 5.2 Giao diện chọn chủ đề

Trên mobile:

- ô tìm kiếm luôn nhìn thấy;
- chip nhóm tuổi/lớp;
- card chủ đề hai cột;
- chủ đề gần đây và phổ biến ở trên;
- chạm card mở danh sách từ;
- sticky action `Dùng chủ đề này` nằm trên bottom navigation Admin.

Trên desktop:

- danh sách chủ đề bên trái;
- từ cơ bản và mở rộng ở giữa;
- preview bộ từ bên phải;
- tìm kiếm và bộ lọc không mở dialog nếu còn đủ không gian.

### 5.3 Cách đề xuất

Đầu vào:

- lớp hoặc nhóm tuổi;
- chủ đề;
- số từ mong muốn;
- các từ đã học gần đây nếu có;
- từ cần ôn lại nếu tạo bài từ kết quả cũ.

Quy trình:

1. lấy `Từ cơ bản` đúng chủ đề và age band;
2. giữ nguyên thứ tự `corePriority`;
3. chọn tối đa số lượng mục tiêu;
4. nếu còn thiếu, bổ sung từ `Mở rộng` theo `extensionPriority`;
5. loại trùng theo `normalizedWord + normalizedMeaning`;
6. đánh dấu từ thiếu ảnh hoặc nội dung chưa hoàn chỉnh;
7. không tự publish.

Nếu giáo viên không chọn lớp, hệ thống yêu cầu chọn một nhóm tuổi đơn giản:

- Mầm non–lớp 1;
- Lớp 2–3;
- Lớp 4–5;
- Lớp 6–9.

### 5.4 Catalog chủ đề khởi đầu

Đây là seed catalog tối thiểu. Nội dung production có thể bổ sung nhưng không
được bỏ nhóm `Từ cơ bản`.

#### 1. Màu sắc — `colors`

- Nhóm tuổi: Mầm non–lớp 2.
- Từ cơ bản: `red`, `blue`, `yellow`, `green`, `orange`, `purple`, `pink`,
  `black`, `white`, `brown`.
- Mở rộng: `gray`, `light blue`, `dark green`, `gold`, `silver`.

#### 2. Số đếm — `numbers-1-20`

- Nhóm tuổi: Mầm non–lớp 2.
- Từ cơ bản: `one`, `two`, `three`, `four`, `five`, `six`, `seven`, `eight`,
  `nine`, `ten`.
- Mở rộng: `eleven` đến `twenty`.

#### 3. Gia đình — `family`

- Nhóm tuổi: Mầm non–lớp 3.
- Từ cơ bản: `mother`, `father`, `parents`, `brother`, `sister`, `baby`,
  `grandmother`, `grandfather`.
- Mở rộng: `aunt`, `uncle`, `cousin`, `son`, `daughter`, `family`.

#### 4. Cơ thể — `body`

- Nhóm tuổi: Mầm non–lớp 3.
- Từ cơ bản: `head`, `eye`, `ear`, `nose`, `mouth`, `hand`, `arm`, `leg`,
  `foot`, `hair`.
- Mở rộng: `face`, `finger`, `tooth`, `shoulder`, `knee`, `toe`.

#### 5. Lớp học — `classroom`

- Nhóm tuổi: Mầm non–lớp 4.
- Từ cơ bản: `book`, `pen`, `pencil`, `ruler`, `eraser`, `bag`, `desk`,
  `chair`, `board`, `teacher`.
- Mở rộng: `notebook`, `crayon`, `scissors`, `glue`, `computer`, `classmate`.

#### 6. Đồ chơi — `toys`

- Nhóm tuổi: Mầm non–lớp 2.
- Từ cơ bản: `ball`, `doll`, `kite`, `car`, `robot`, `teddy bear`, `blocks`,
  `bike`.
- Mở rộng: `puzzle`, `train`, `yo-yo`, `skipping rope`, `drum`.

#### 7. Thú cưng — `pets`

- Nhóm tuổi: Mầm non–lớp 3.
- Từ cơ bản: `cat`, `dog`, `fish`, `bird`, `rabbit`, `hamster`, `turtle`.
- Mở rộng: `parrot`, `puppy`, `kitten`, `goldfish`, `pet`.

#### 8. Động vật nông trại — `farm-animals`

- Nhóm tuổi: Mầm non–lớp 3.
- Từ cơ bản: `cow`, `pig`, `chicken`, `duck`, `horse`, `sheep`, `goat`.
- Mở rộng: `rooster`, `donkey`, `calf`, `farm`, `farmer`.

#### 9. Động vật hoang dã — `wild-animals`

- Nhóm tuổi: Lớp 1–4.
- Từ cơ bản: `lion`, `tiger`, `elephant`, `monkey`, `bear`, `snake`, `zebra`,
  `giraffe`.
- Mở rộng: `crocodile`, `panda`, `kangaroo`, `fox`, `wolf`, `deer`.

#### 10. Trái cây — `fruits`

- Nhóm tuổi: Mầm non–lớp 3.
- Từ cơ bản: `apple`, `banana`, `orange`, `mango`, `grape`, `watermelon`,
  `strawberry`, `pineapple`.
- Mở rộng: `pear`, `peach`, `lemon`, `coconut`, `papaya`, `dragon fruit`.

#### 11. Đồ ăn và thức uống — `food-and-drinks`

- Nhóm tuổi: Lớp 1–4.
- Từ cơ bản: `rice`, `bread`, `egg`, `milk`, `water`, `juice`, `cake`,
  `chicken`, `fish`, `noodles`.
- Mở rộng: `soup`, `sandwich`, `pizza`, `salad`, `tea`, `coffee`, `ice cream`.

#### 12. Quần áo — `clothes`

- Nhóm tuổi: Lớp 1–4.
- Từ cơ bản: `shirt`, `T-shirt`, `dress`, `skirt`, `shorts`, `trousers`,
  `shoes`, `hat`, `jacket`, `socks`.
- Mở rộng: `coat`, `sweater`, `jeans`, `scarf`, `gloves`, `uniform`.

#### 13. Ngôi nhà — `home`

- Nhóm tuổi: Lớp 1–4.
- Từ cơ bản: `house`, `bedroom`, `bathroom`, `kitchen`, `living room`, `bed`,
  `table`, `door`, `window`, `garden`.
- Mở rộng: `dining room`, `balcony`, `sofa`, `lamp`, `wardrobe`, `garage`.

#### 14. Thời tiết — `weather`

- Nhóm tuổi: Lớp 1–5.
- Từ cơ bản: `sunny`, `rainy`, `cloudy`, `windy`, `hot`, `cold`, `warm`,
  `cool`.
- Mở rộng: `stormy`, `snowy`, `foggy`, `weather`, `temperature`, `rainbow`.

#### 15. Cảm xúc — `feelings`

- Nhóm tuổi: Mầm non–lớp 5.
- Từ cơ bản: `happy`, `sad`, `angry`, `scared`, `tired`, `hungry`, `thirsty`,
  `excited`.
- Mở rộng: `bored`, `surprised`, `worried`, `shy`, `proud`, `calm`.

#### 16. Hoạt động hằng ngày — `daily-routines`

- Nhóm tuổi: Lớp 2–6.
- Từ cơ bản: `wake up`, `brush my teeth`, `have breakfast`, `go to school`,
  `have lunch`, `do homework`, `play`, `have dinner`, `take a shower`,
  `go to bed`.
- Mở rộng: `get dressed`, `clean my room`, `watch TV`, `read a book`,
  `help my parents`, `exercise`.

#### 17. Hành động — `actions`

- Nhóm tuổi: Mầm non–lớp 4.
- Từ cơ bản: `run`, `walk`, `jump`, `sit`, `stand`, `eat`, `drink`, `read`,
  `write`, `sing`, `dance`, `swim`.
- Mở rộng: `clap`, `draw`, `listen`, `speak`, `open`, `close`, `throw`, `catch`.

#### 18. Phương tiện — `transport`

- Nhóm tuổi: Lớp 1–5.
- Từ cơ bản: `car`, `bus`, `bike`, `motorbike`, `train`, `plane`, `boat`,
  `taxi`.
- Mở rộng: `truck`, `ship`, `helicopter`, `subway`, `ambulance`, `fire engine`.

#### 19. Thiên nhiên — `nature`

- Nhóm tuổi: Lớp 2–6.
- Từ cơ bản: `sun`, `moon`, `star`, `sky`, `tree`, `flower`, `river`,
  `mountain`, `sea`, `rain`.
- Mở rộng: `forest`, `island`, `lake`, `waterfall`, `field`, `cloud`.

#### 20. Địa điểm trong thành phố — `places-in-town`

- Nhóm tuổi: Lớp 3–7.
- Từ cơ bản: `school`, `hospital`, `park`, `supermarket`, `market`, `bank`,
  `post office`, `library`, `restaurant`, `bus stop`.
- Mở rộng: `cinema`, `museum`, `pharmacy`, `police station`, `bakery`,
  `sports centre`.

Catalog production phải lưu dữ liệu cấu trúc thay vì parse trực tiếp danh sách
trong tài liệu này.

## 6. Tạo bộ từ thủ công

Hỗ trợ nhập dạng bảng và paste nhiều dòng:

```text
apple | quả táo
cat | con mèo
happy | vui vẻ
run | chạy
```

Quy tắc import nhanh:

- cột 1: từ tiếng Anh;
- cột 2: nghĩa tiếng Việt;
- cột 3–5 tùy chọn: phiên âm, loại từ, ví dụ;
- cho phép tab, dấu `|` hoặc paste trực tiếp từ bảng tính;
- preview lỗi theo dòng, không làm mất dữ liệu hợp lệ;
- không tự publish.

## 7. Tìm và chọn hình

### 7.1 Trải nghiệm

Mỗi từ có ô ảnh với CTA `Tìm ảnh`. Không yêu cầu giáo viên upload ảnh từng từ.

Khi mở tìm ảnh:

- query mặc định lấy từ tiếng Anh + nghĩa/chủ đề để làm rõ nghĩa;
- ô search có thể sửa;
- filter `Minh họa`, `Ảnh thật`, `Vector/Icon`;
- chỉ hiển thị nội dung safe-search;
- lưới ảnh lớn, chạm một lần để chọn;
- có preview flashcard;
- có `Không dùng ảnh cho từ này`.

Nút `Gợi ý ảnh cho tất cả` chạy ngoài transaction và tạo danh sách cần duyệt.
Không tự chọn vĩnh viễn mà không qua thao tác xác nhận của giáo viên.

### 7.2 Quy tắc tìm ảnh

Mỗi vocabulary item có thể lưu `imageSearchTerms` đã biên soạn:

```json
{
  "word": "bat",
  "meaningVi": "con dơi",
  "imageSearchTerms": ["bat animal", "cartoon bat animal"]
}
```

Đối với từ trừu tượng hoặc từ chức năng:

- cho phép không có ảnh;
- loại khỏi trò bắt buộc dùng hình;
- không dùng ảnh mơ hồ chỉ để đủ số lượng.

### 7.3 Kiến trúc provider

Backend dùng abstraction:

```ts
interface ImageSearchProvider {
  search(input: ImageSearchInput): Promise<ImageSearchResultPage>;
  importSelected(input: ImportSelectedImageInput): Promise<StoredMedia>;
}
```

Yêu cầu:

- API key chỉ nằm ở server;
- rate limit và cache kết quả tìm kiếm;
- lưu provider, source URL, attribution và license metadata;
- ảnh được chọn phải được import/resize sang storage do ứng dụng kiểm soát nếu
  điều khoản provider cho phép;
- không hotlink vĩnh viễn một URL preview có thể hết hạn;
- tạo thumbnail WebP cho danh sách và ảnh lớn cho game;
- alt text dựa trên nghĩa đã duyệt, không chỉ dùng tên file.

Provider cụ thể được chọn ở task triển khai sau khi kiểm tra điều khoản API.

## 8. Game engine

### 8.1 Tách mechanic và presentation

Không xây mỗi trò như một hệ thống độc lập. Chuẩn hóa mechanic:

```ts
type GameMechanic =
  | "EXPLORE_CARD"
  | "SELECT_ONE"
  | "MATCH_PAIRS"
  | "MEMORY_PAIRS"
  | "ORDER_TOKENS"
  | "BUILD_WORD"
  | "SORT_ITEMS"
  | "REPEAT_AUDIO";
```

Một mechanic có nhiều presentation:

```ts
type SelectOnePresentation =
  | "LISTEN_PICK_IMAGE"
  | "IMAGE_PICK_WORD"
  | "LISTEN_PICK_WORD"
  | "FEED_MONSTER"
  | "POP_BALLOON"
  | "OPEN_TREASURE"
  | "CHOOSE_TRAIN_CARRIAGE";
```

`FEED_MONSTER`, `POP_BALLOON` và `OPEN_TREASURE` dùng cùng contract chấm đáp án,
chỉ khác cách hiển thị.

### 8.2 Trò chơi ưu tiên cho MVP

#### A. Khám phá flashcard

- ảnh lớn;
- từ và nút nghe;
- chạm để hiện nghĩa;
- `Con nhớ rồi` và `Học lại nhé`;
- không tự phát âm khi tải trang.

#### B. Nghe và chạm hình

- phù hợp mầm non–lớp 3;
- mặc định 3 lựa chọn, có thể 2 cho trẻ rất nhỏ;
- ảnh rõ, không có nhiều vật thể gây nhiễu.

#### C. Nhìn hình chọn từ

- phù hợp lớp 1 trở lên;
- đáp án là nút lớn;
- hạn chế từ có độ dài quá chênh lệch làm lộ đáp án.

#### D. Ghép cặp bằng hai lần chạm

- chạm từ rồi chạm hình/nghĩa;
- không bắt buộc drag-and-drop;
- tự nối và khóa cặp đúng.

#### E. Lật thẻ ghi nhớ

- 6 thẻ cho mầm non;
- 8 thẻ cho lớp 1–2;
- tối đa 12 thẻ cho lớp lớn;
- cặp có thể là từ–hình hoặc từ–nghĩa.

#### F. Xếp chữ thành từ

- chạm chữ theo thứ tự;
- không kéo thả;
- chỉ bật khi age band phù hợp;
- có thể hiện ảnh hoặc phát âm thanh làm gợi ý.

#### G. Điền chữ còn thiếu

- phù hợp lớp 2 trở lên;
- 2–4 lựa chọn chữ;
- không áp dụng cho từ quá ngắn nếu câu hỏi trở nên vô nghĩa.

#### H. Ôn lại từ sai

- không phải một presentation riêng;
- tạo queue adaptive từ những từ sai lần đầu;
- lặp lại sau 2–3 câu bằng mechanic khác;
- kết quả vẫn lưu `firstAttemptCorrect` riêng.

### 8.3 Giai đoạn sau MVP

- Bingo hình ảnh;
- phân loại từ;
- khám phá bức tranh và tìm đồ vật;
- câu ngữ cảnh;
- ghi âm và nghe lại;
- AI chấm phát âm;
- multiplayer hoặc thi đấu trực tuyến.

Không đưa multiplayer, bảng xếp hạng hoặc AI phát âm vào MVP.

## 9. Template lộ trình trò chơi

### 9.1 Bé mới học

Dành cho mầm non–lớp 1:

```text
Khám phá flashcard
  -> Nghe và chạm hình
  -> Ghép cặp
  -> Lật thẻ
  -> Nhận sticker
```

### 9.2 Nhớ mặt chữ

Dành cho lớp 1–3:

```text
Flashcard
  -> Nhìn hình chọn từ
  -> Nghe chọn từ
  -> Ghép cặp
```

### 9.3 Ôn chính tả

Dành cho lớp 2 trở lên:

```text
Nghe chọn từ
  -> Điền chữ thiếu
  -> Xếp chữ
  -> Nghe và nhập từ nếu lớp phù hợp
```

### 9.4 Ôn trước kiểm tra

Dành cho lớp 4–9:

```text
Từ chọn nghĩa
  -> Nghĩa chọn từ
  -> Nghe chính tả
  -> Điền từ vào câu
  -> Ôn lại từ sai
```

## 10. Adaptive repetition

Mỗi từ cần xuất hiện ở ít nhất hai mechanic nếu thời lượng cho phép.

Quy tắc:

- sai lần đầu không lặp lại ngay câu kế tiếp;
- đưa lại sau 2–3 câu;
- lần lặp phải đổi presentation hoặc mechanic;
- lưu riêng kết quả lần đầu và kết quả sau hỗ trợ;
- UI học sinh chỉ hiển thị lời động viên;
- dashboard giáo viên vẫn đánh dấu từ cần ôn.

Phân loại mastery đề xuất:

- `MASTERED`: đúng lần đầu ở ít nhất 80% lần xuất hiện;
- `LEARNING`: có sai lần đầu nhưng hoàn thành sau hỗ trợ;
- `NEEDS_REVIEW`: sai lặp lại hoặc bỏ dở;
- `NOT_SEEN`: chưa gặp đủ dữ liệu.

Ngưỡng production phải được cấu hình, không hard-code rải rác trong UI.

## 11. Trải nghiệm học sinh

### 11.1 Màn bắt đầu

- mascot hoặc illustration theo age band;
- tên bài;
- ước tính thời gian;
- số từ;
- một nút lớn `Bắt đầu`;
- không có navigation Admin.

### 11.2 Trong game

- một yêu cầu chính;
- progress nhẹ dạng chấm hoặc thanh;
- nút nghe lại luôn cùng vị trí;
- lựa chọn lớn;
- không yêu cầu đọc hướng dẫn dài;
- tự chuyển câu sau khi phản hồi ngắn;
- có nút thoát nhỏ nhưng cần xác nhận nếu đang dở.

### 11.3 Phản hồi

Đúng:

- âm thanh ngắn;
- mascot vui;
- sao/sticker;
- text như `Chính xác!` hoặc `Giỏi lắm!`.

Sai:

- text như `Gần đúng rồi, thử lại nhé!`;
- không trừ sao;
- phát lại prompt nếu hữu ích;
- không dùng chỉ màu đỏ hoặc biểu tượng X.

### 11.4 Kết thúc

Trẻ nhỏ thấy:

- số sao/sticker;
- thông điệp hoàn thành;
- `Chơi lại`;
- `Ôn những từ khó`.

Điểm phần trăm, số câu sai và bảng chi tiết chỉ hiện trong dashboard giáo viên
hoặc cho nhóm lớp lớn khi template yêu cầu.

## 12. Responsive specification

### 12.1 Mobile 360–430 px

Teacher:

- nội dung một cột;
- stepper gọn dạng `Bước 2/5`;
- card chủ đề hai cột nếu đủ 360 px;
- word row hiển thị ảnh, từ và switch/chọn; chi tiết mở accordion;
- tìm ảnh mở full-screen dialog hoặc bottom sheet;
- primary action sticky trên bottom navigation;
- không thêm mục thứ sáu vào bottom navigation hiện tại;
- truy cập feature từ Dashboard, Class detail hoặc mục `Khác` sau khi navigation
  được thiết kế riêng.

Student:

- một game card chiếm phần lớn viewport;
- 2–3 đáp án lớn cho trẻ nhỏ;
- không có page scroll trong một câu hỏi nếu viewport phổ biến đủ chiều cao;
- safe-area bottom được tính cho nút;
- không dựa vào hover.

### 12.2 Tablet 768–1199 px

- teacher dùng hai cột khi hữu ích;
- image picker tối đa bốn ảnh mỗi hàng;
- student game có thể dùng 3–4 lựa chọn nhưng vẫn giữ vùng chơi tập trung;
- không kéo giãn text line quá dài.

### 12.3 Desktop từ 1200 px

Teacher:

- sidebar Admin hiện tại;
- stepper hoặc danh sách bước bên trái;
- nội dung chính ở giữa;
- preview/summary sticky bên phải;
- word list có thể dùng grid/table nhẹ nhưng vẫn phải responsive;
- image search mở dialog rộng với lưới 4–6 cột.

Student:

- game nằm giữa trong khung tối đa khoảng 960–1100 px;
- nền có decoration nhẹ nhưng không ảnh hưởng tập trung;
- lựa chọn có thể xếp ngang;
- hỗ trợ keyboard, nhưng touch/click vẫn là chính;
- không hiển thị sidebar Admin hoặc marketing header đầy đủ.

## 13. Route đề xuất

### 13.1 Giáo viên

| Route | Mục đích |
|---|---|
| `/admin/vocabulary` | Danh sách bộ từ |
| `/admin/vocabulary/new` | Tạo bộ từ |
| `/admin/vocabulary/:id` | Xem/sửa bộ từ |
| `/admin/assignments` | Danh sách bài đã giao |
| `/admin/assignments/new` | Wizard tạo bài |
| `/admin/assignments/:id` | Tổng quan và kết quả |
| `/admin/assignments/:id/edit` | Sửa bài nháp |

### 13.2 Học sinh

| Route | Mục đích |
|---|---|
| `/play/:publicCode` | Resolve link và màn bắt đầu |
| `/play/:publicCode/session/:sessionToken` | Tiếp tục phiên chơi |
| `/play/:publicCode/result/:sessionToken` | Kết quả thân thiện |

Các route `/play/*` phải có `noindex, nofollow`.

## 14. Domain model đề xuất

### 14.1 Topic catalog

```text
vocabulary_topics
- id
- slug
- title_vi
- description_vi
- age_band_from
- age_band_to
- icon_key
- display_order
- status
- created_at
- updated_at
```

```text
vocabulary_topic_words
- id
- topic_id
- word
- normalized_word
- meaning_vi
- phonetic
- part_of_speech
- example_en
- speech_text
- tier: CORE | EXTENDED
- core_priority nullable
- extension_priority nullable
- age_band_from
- age_band_to
- supports_image_game
- image_search_terms_json
- status
```

### 14.2 Bộ từ của giáo viên

```text
vocabulary_sets
- id
- teacher_user_id
- title
- description
- source_type: TOPIC_CATALOG | PUBLIC_UNIT | COPIED | MANUAL
- source_reference nullable
- age_band
- status: ACTIVE | ARCHIVED
- created_at
- updated_at
```

```text
vocabulary_items
- id
- vocabulary_set_id
- source_topic_word_id nullable
- display_order
- word
- normalized_word
- meaning_vi
- phonetic
- part_of_speech
- example_en
- speech_text
- tier: CORE | EXTENDED | CUSTOM
- media_id nullable
- supports_image_game
- created_at
- updated_at
```

### 14.3 Media

```text
vocabulary_media
- id
- provider
- provider_asset_id
- source_url
- attribution_text
- attribution_url
- license_metadata_json
- storage_path
- thumbnail_path
- alt_text
- width
- height
- created_at
```

### 14.4 Bài giao và snapshot

```text
learning_assignments
- id
- teacher_user_id
- vocabulary_set_id nullable
- title
- instruction
- audience_type: CLASS | SELECTED_STUDENTS | OPEN_LINK
- class_id nullable
- public_code
- status: DRAFT | PUBLISHED | CLOSED
- template_code
- age_band
- available_from nullable
- due_at nullable
- max_attempts nullable
- pass_score nullable
- answer_mode
- shuffle_questions
- published_at nullable
- created_at
- updated_at
```

```text
learning_assignment_items
- id
- assignment_id
- source_vocabulary_item_id nullable
- display_order
- word
- normalized_word
- meaning_vi
- phonetic
- part_of_speech
- example_en
- speech_text
- tier
- media_snapshot_json nullable
```

```text
learning_assignment_activities
- id
- assignment_id
- display_order
- mechanic
- presentation
- required
- config_json
```

```text
learning_assignment_recipients
- id
- assignment_id
- student_id nullable
- access_token_hash nullable
- assigned_at
- completed_at nullable
```

### 14.5 Phiên chơi và câu trả lời

```text
learning_attempts
- id
- assignment_id
- recipient_id nullable
- guest_name nullable
- attempt_number
- status: IN_PROGRESS | COMPLETED | ABANDONED
- started_at
- completed_at nullable
- correct_first_try_count
- correct_after_retry_count
- total_questions
- score_percent nullable
- reward_snapshot_json
```

```text
learning_attempt_questions
- id
- attempt_id
- assignment_item_id
- activity_id
- sequence_number
- mechanic
- presentation
- prompt_snapshot_json
- options_snapshot_json
- correct_answer_snapshot_json
- first_attempt_correct nullable
- final_correct nullable
- retry_count
```

Question queue phải được snapshot khi bắt đầu/tiếp tục phiên để reload không đổi
đáp án hoặc thứ tự giữa chừng.

## 15. Logical API proposal

### 15.1 Topic và vocabulary set

```http
GET    /api/v1/vocabulary/topics
GET    /api/v1/vocabulary/topics/{slug}
POST   /api/v1/vocabulary/topic-suggestions
GET    /api/v1/vocabulary/sets
POST   /api/v1/vocabulary/sets
GET    /api/v1/vocabulary/sets/{id}
PATCH  /api/v1/vocabulary/sets/{id}
POST   /api/v1/vocabulary/sets/{id}/duplicate
POST   /api/v1/vocabulary/sets/import-public-unit
```

### 15.2 Image search

```http
GET  /api/v1/media/image-search
POST /api/v1/media/images/import
```

Không gọi provider ảnh trực tiếp từ page.

### 15.3 Assignment giáo viên

```http
GET    /api/v1/learning-assignments
POST   /api/v1/learning-assignments
GET    /api/v1/learning-assignments/{id}
PATCH  /api/v1/learning-assignments/{id}
POST   /api/v1/learning-assignments/{id}/publish
POST   /api/v1/learning-assignments/{id}/close
POST   /api/v1/learning-assignments/{id}/duplicate
GET    /api/v1/learning-assignments/{id}/results
POST   /api/v1/learning-assignments/{id}/review-assignment
```

### 15.4 Public student API

```http
GET  /api/v1/public/learning-assignments/{publicCode}
POST /api/v1/public/learning-assignments/{publicCode}/access
POST /api/v1/public/learning-assignments/{publicCode}/attempts
GET  /api/v1/public/learning-attempts/{sessionToken}
POST /api/v1/public/learning-attempts/{sessionToken}/answers
POST /api/v1/public/learning-attempts/{sessionToken}/complete
```

Không trả đáp án đúng của toàn bộ câu hỏi trước khi học sinh trả lời. Public API
phải rate-limit, kiểm tra assignment state và không làm lộ danh sách lớp.

## 16. Dashboard kết quả

### 16.1 Tổng quan

- được giao;
- chưa bắt đầu;
- đang làm;
- đã hoàn thành;
- tỷ lệ hoàn thành;
- số từ đã nhớ;
- số từ cần ôn.

### 16.2 Theo học sinh

Hiển thị dạng card/list trên mobile và table nhẹ trên desktop:

- tên học sinh;
- trạng thái;
- lượt làm;
- kết quả lần đầu;
- kết quả sau hỗ trợ;
- từ cần ôn;
- lần hoạt động gần nhất.

### 16.3 Theo từ

Mỗi từ có:

- số học sinh đã gặp;
- tỷ lệ đúng lần đầu;
- tỷ lệ đúng sau hỗ trợ;
- mastery status;
- CTA `Giao lại từ này`.

CTA chính:

```text
Giao lại các từ cần ôn
```

Hệ thống tạo assignment draft mới, không tự publish.

## 17. Accessibility và child safety

- Touch target game tối thiểu 56 px; teacher UI tối thiểu 44 px.
- Contrast theo WCAG AA.
- Trạng thái đúng/sai không chỉ dùng màu.
- Tất cả ảnh có alt text; ảnh trang trí `aria-hidden`.
- Audio có nút phát lại và text fallback cho lớp lớn.
- Keyboard navigation hoạt động trên desktop.
- Không có quảng cáo, chat công khai hoặc nội dung do học sinh đăng.
- Search ảnh luôn dùng safe-search và giáo viên duyệt trước khi publish.
- Không yêu cầu tên đầy đủ cho `OPEN_LINK`; guest name là tùy chọn.
- Không thu microphone trong MVP.
- Không hiển thị bảng xếp hạng công khai.

## 18. Performance

- Lazy-load ảnh game và preload chỉ câu kế tiếp.
- Dùng thumbnail cho danh sách teacher.
- Không tải toàn bộ catalog ảnh vào wizard.
- Autosave draft có debounce.
- Lưu câu trả lời theo từng câu hoặc batch nhỏ để mất mạng ngắn không làm mất
  toàn bộ phiên.
- Có retry idempotent cho answer submission.
- Bundle game presentation phải route-split/lazy-load.

## 19. Phạm vi MVP đề xuất

### Trong MVP

1. Topic catalog với `Từ cơ bản` và `Mở rộng`.
2. Chọn lớp, học sinh hoặc link mở.
3. Tạo bộ từ từ chủ đề, public Unit, bộ cũ hoặc paste.
4. Search ảnh từng từ và gợi ý ảnh hàng loạt.
5. Flashcard.
6. Nghe chọn hình.
7. Nhìn hình chọn từ.
8. Ghép cặp bằng hai lần chạm.
9. Lật thẻ.
10. Xếp chữ cho age band phù hợp.
11. Ba presentation vui nhộn dùng lại `SELECT_ONE`: quái vật, kho báu, bong bóng.
12. Link và QR.
13. Tiến độ server-side.
14. Dashboard theo học sinh và theo từ.
15. Tạo draft ôn lại từ sai.
16. Mobile-first và desktop support.

### Ngoài MVP

- AI chấm phát âm;
- upload/ghi âm hàng loạt;
- multiplayer real-time;
- bảng xếp hạng;
- coin shop;
- parent/student account;
- push notification;
- tự động gửi Zalo;
- scene tìm đồ vật phức tạp;
- CMS nhiều giáo viên.

## 20. Trình tự triển khai đề xuất

### Phase A — Foundation

- migration topic/vocabulary/media;
- seed catalog chủ đề cơ bản;
- vocabulary set CRUD;
- topic suggestion API;
- image provider abstraction;
- teacher mobile-first vocabulary editor.

### Phase B — Assignment domain

- assignment draft/publish/snapshot;
- recipient snapshot và public token;
- wizard teacher responsive;
- link và QR.

### Phase C — Student game MVP

- game shell;
- question generator;
- flashcard, select-one, matching, memory, build-word;
- adaptive retry;
- autosave attempt.

### Phase D — Results and review

- aggregate result;
- mastery by word;
- responsive dashboard;
- create review assignment draft.

### Phase E — Polish and release

- accessibility;
- low-resource/mobile performance;
- responsive screenshots ở 360, 390, 430, 768 và 1440 px;
- security/rate-limit review;
- content review toàn bộ seed catalog;
- full regression.

## 21. Acceptance criteria cấp feature

1. Giáo viên có thể hoàn tất một bài từ chủ đề trên màn hình 360 px mà không có
   horizontal scroll.
2. Khi chọn một chủ đề, `Từ cơ bản` luôn xuất hiện trước và được chọn mặc định.
3. Từ mở rộng được phân biệt rõ, không tự chọn vượt quá target count.
4. Giáo viên có thể tìm và chọn ảnh mà không upload file thủ công.
5. Search ảnh có safe-search, source metadata và bước giáo viên xác nhận.
6. Giáo viên có thể bỏ ảnh khỏi một từ và hệ thống tự loại từ khỏi game cần ảnh.
7. Học sinh mở link cá nhân không phải đăng nhập hoặc nhập thông tin thừa.
8. Mỗi câu game mobile chỉ có một nhiệm vụ chính và lựa chọn có vùng bấm tối
   thiểu 56 px.
9. Sai lần đầu được ghi nhận riêng dù học sinh trả lời đúng sau hỗ trợ.
10. Reload giữa phiên không thay đổi question queue.
11. Giáo viên xem được kết quả theo học sinh và theo từng từ.
12. CTA giao lại từ sai tạo draft mới, không tự publish.
13. Desktop dùng layout tận dụng chiều rộng nhưng không thay đổi business flow.
14. `/play/*` có `noindex, nofollow` và không làm lộ danh sách lớp.
15. Feature không thay đổi business rule học phí, lịch học hoặc lesson recording.

## 22. Quyết định cần chốt trước khi code

- provider tìm ảnh và điều khoản lưu/cache cụ thể;
- storage cho media ở production;
- source phát âm: browser speech, generated audio hoặc hybrid;
- giới hạn số từ/bài theo age band;
- thời gian hết hạn public/access token;
- có cho guest tự nhập tên trong `OPEN_LINK` hay không;
- tên milestone implementation.

Các quyết định trên không cản trở việc tách task foundation và xây schema/catalog,
nhưng phải chốt trước khi publish production.
