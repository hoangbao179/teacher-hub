# Teacher Admin tối giản và học phí theo tháng

## Mục tiêu

Tối giản Teacher Admin cho công việc hằng ngày của cô Vy: quản lý lớp/học sinh,
điểm danh, nhận xét tùy chọn, đánh dấu học phí theo tháng và đồng bộ sổ theo dõi
sang Google Sheet. Thay đổi không được redesign hoặc làm sai schedule engine hiện
có và không ảnh hưởng homepage, auth hay các tính năng học tiếng Anh công khai.

## Phạm vi giữ nguyên

- Class, enrollment và participant snapshot của lesson.
- Combined Class Groups và Combined Teaching Occurrence.
- Lịch học cố định, external teaching schedules, teacher busy slots.
- Nghỉ buổi, đổi lịch, học bù và các rule kiểm tra xung đột hiện hành.
- Database là source of truth; Google Sheet chỉ là projection.
- Google Sheet outbox, retry, idempotency và trạng thái phục vụ debug.
- Migration, bảng và dữ liệu tuition cycle/legacy import đã tồn tại trong lịch sử.
- Homepage, login, `/hoc`, books, vocabulary, assignments và learning features.

## Phạm vi thay đổi

### Điểm danh và nhận xét

Happy path từ Dashboard là một màn hình:

`Hôm nay -> chọn lớp/buổi -> điểm danh -> nhận xét nếu có -> Lưu`

- Danh sách participant của lesson được giữ làm nguồn xác định học sinh tham gia.
- Tất cả participant mặc định `PRESENT`; cô chỉ đổi học sinh nghỉ sang `ABSENT`.
- Contract ghi mới và chỉnh sửa chỉ nhận `PRESENT | ABSENT`.
- Enrollment có tuition mode `FREE` vẫn được điểm danh `PRESENT`; miễn học phí là
  billing concern, không phải attendance status.
- `studentNote`, nội dung bài học, bài tập về nhà và nhận xét chung đều nullable và
  không gây validation error khi để trống.
- Chỉnh sửa lesson đã hoàn thành được phép cập nhật attendance/comment khi không vi
  phạm các ràng buộc lịch sử còn áp dụng.
- Full flow kỹ thuật chỉ được giữ nếu còn cần cho buổi ngoài lịch, học bù hoặc chỉnh
  thông tin lịch; happy path không dùng wizard nhiều bước.

DB hiện có thể chứa attendance `FREE`. Migration không rewrite lịch sử. Runtime mới
không tạo thêm `FREE`; khi đọc lịch sử, `FREE` được trình bày như đã có mặt nhưng vẫn
giữ cờ loại khỏi học phí cũ để không làm sai dữ liệu đã phát sinh.

### Học phí theo tháng dương lịch

Tạo aggregate mới `MonthlyTuitionPayment` với dữ liệu tối thiểu:

- `id`, `enrollmentId`, `year`, `month`;
- `status`: `UNPAID | PAID`;
- `amount`: nullable integer VND;
- `paidAt`, `note`, timestamps;
- unique `(enrollmentId, year, month)`.

`studentId` và `classId` được lấy qua enrollment để tránh lưu dữ liệu trùng. API trả
đủ hai ID theo yêu cầu UI. Runtime mới không đọc hoặc ghi `tuition_cycles`,
`tuition_cycle_sessions`, receipts hay allocations.

Monthly board mặc định mở tháng hiện tại theo `Asia/Ho_Chi_Minh`, cho phép chuyển
tháng trước/sau. Mỗi row hiển thị học sinh, lớp, số có mặt, số vắng, tổng buổi hợp lệ
và trạng thái thu.

Quy tắc summary cho một enrollment/lớp/tháng:

- Chỉ dùng `lesson_sessions.status = COMPLETED` có `session_date` nằm trong tháng.
- Enrollment phải nằm trong participant snapshot của lesson.
- `PRESENT` tăng present và total; `ABSENT` tăng absent và total.
- Lesson `DRAFT` hoặc `CANCELLED` không được tính.
- Lesson phát sinh từ combined class vẫn được tính qua child lesson canonical.
- Buổi đổi lịch được tính theo ngày lesson thực tế; occurrence đã skip không có
  completed lesson nên không được tính.
- Học bù chỉ tính cho participant snapshot thực sự tham gia.
- Attendance `FREE` lịch sử được tính như present cho thống kê đi học, không được
  dùng để khôi phục hoặc suy luận cycle cũ.

Board có thể trả row `UNPAID` bằng phép left join dù chưa có payment record. Mark
`PAID` thực hiện upsert transactionally, lưu `paidAt` và audit log. `PAID` tiếp tục
bất biến theo rule hiện hành; không cung cấp thao tác đổi ngược về `UNPAID`.

`amount` không tự lấy từ giá gói tám buổi cũ vì hai khái niệm không tương đương.
Trường này là tùy chọn khi đánh dấu đã thu. Các tuition policy cũ được giữ trong DB
để bảo toàn lịch sử nhưng không được dùng bởi monthly runtime.

### Google Sheet

Giữ cơ chế outbox hiện tại:

1. Transaction lưu/chỉnh lesson cập nhật DB và enqueue logical event.
2. Google API không được gọi bên trong transaction.
3. Worker claim event, retry lỗi retryable và đánh dấu `DEAD` khi hết lượt.
4. Logical key/revision bảo đảm chỉnh cùng lesson cập nhật row cũ thay vì append
   duplicate.

Template mới là “Sổ theo dõi học tập”:

- tiêu đề và metadata học sinh/lớp/cập nhật gần nhất rõ ràng;
- cột hiển thị: ngày học, điểm danh, nhận xét của cô và nội dung nếu còn hữu ích;
- `PRESENT` hiển thị “Có mặt” với nền xanh nhạt;
- `ABSENT` hiển thị “Vắng” với nền đỏ hoặc hồng nhạt;
- ngày `dd/MM/yyyy`, wrap text, độ rộng cột hợp lý, freeze header;
- kỹ thuật ID/revision nằm ở cột hoặc sheet ẩn;
- layout có thể đọc trên mobile.

UI chỉ hiển thị `Đã đồng bộ`, `Đang chờ đồng bộ`, `Đồng bộ lỗi` và action `Thử
lại`. Chi tiết kỹ thuật vẫn tồn tại trong backend/log để vận hành.

### Loại bỏ Legacy Import

Loại bỏ khỏi runtime và public contract:

- route preview/apply và upload middleware chỉ phục vụ import;
- controller, service, repository, parser/reconciliation domain;
- client page, API helper và link từ Student Detail;
- shared contracts, container wiring, tests và OpenAPI/docs chỉ phục vụ import;
- dependency chỉ được gỡ nếu không còn consumer hợp lệ khác.

Không sửa migration cũ và không drop bảng lịch sử. Việc cleanup vật lý database
không thuộc task này.

### Cleanup tài sản và tài liệu

- Không xóa `docs/wireframes/**` vì repository policy yêu cầu giữ wireframe hiện có.
- Chỉ xóa screenshot/mockup/asset ngoài vùng trên khi không còn import, runtime hoặc
  tài liệu hiện hành tham chiếu.
- Giữ logo, favicon, homepage media, `/hoc` và learning assets.
- Cập nhật product spec, feature docs, OpenAPI, implementation status, user guide,
  README và AGENTS business rules để trạng thái current không còn mô tả cycle tám
  buổi hoặc Legacy Import là runtime active.
- Tạo đúng một consolidated Level 3 change report ở `docs/changes/2026-09/`.

## API và ranh giới module

Shared contract mới cung cấp:

- `AttendanceStatus = "PRESENT" | "ABSENT"` cho runtime request/response mới;
- `MonthlyTuitionStatus = "UNPAID" | "PAID"`;
- query board theo `year`, `month`, tùy chọn class/search;
- monthly row và mutation đánh dấu đã thu.

API tuition cycle cũ bị gỡ khỏi router. API monthly dự kiến:

- `GET /api/tuition/monthly?year=YYYY&month=M`;
- `PUT /api/tuition/monthly/:enrollmentId/:year/:month/paid`.

Controller chỉ parse/validate HTTP. Service giữ transaction và business rule.
Repository giữ SQL summary/upsert. Không đặt SQL trong controller.

## Migration và tương thích dữ liệu

Migration mới chỉ tạo bảng monthly payment và index/constraint cần thiết. Không drop
hoặc đổi bảng cycle/import/attendance cũ. Rollback ứng dụng là deploy lại runtime cũ;
runtime cũ bỏ qua bảng mới. Rollback migration vật lý chỉ được thực hiện nếu bảng
monthly chưa chứa dữ liệu cần giữ.

Không tự động backfill paid cycles sang tháng. Cycle có thể đi qua ranh giới tháng,
nên bất kỳ mapping tự động nào cũng có thể tạo payment sai. Dữ liệu cũ vẫn nằm trong
các bảng lịch sử để có thể xây công cụ tra cứu/migration riêng khi có rule được duyệt.

## Error handling

- Monthly query sai year/month trả validation error, không normalize âm thầm.
- Mark paid cho enrollment/month không hợp lệ hoặc enrollment miễn phí trả conflict.
- Replay cùng payload PAID là idempotent; mutation khác trên record PAID bị chặn.
- Google lỗi không rollback lesson; trạng thái chuyển pending/retry/dead như hiện tại.
- Xóa Legacy Import route trả 404 qua router chung, không để handler chết hoặc link UI.

## Kiểm thử

### Attendance

- participant mặc định PRESENT;
- đổi một học sinh sang ABSENT;
- comment null và comment có nội dung;
- chỉnh attendance/comment;
- runtime từ chối FREE nhưng đọc history cũ an toàn.

### Monthly tuition

- 6 present, 2 absent tạo `6/8`, absent `2`;
- tháng chín lesson tạo `7/9`;
- month boundary và timezone;
- cancelled/draft không tính;
- combined child lesson, reschedule và makeup participant tính đúng;
- mark PAID, idempotent replay và chặn sửa record PAID;
- enrollment FREE không tạo payment.

### Schedule regression

- combined classes;
- external teaching schedule;
- busy slots;
- reschedule;
- cancellation/skip.

### Google Sheet

- PRESENT, ABSENT và optional comment projection;
- edit cùng lesson update đúng row;
- retry khi provider lỗi;
- template title/header/format/hidden technical metadata.

### Cleanup

- legacy import route, page, contract và runtime reference không còn;
- asset/import path không bị gãy;
- targeted integration cho lesson, tuition, Google Sheet và schedule;
- vì là Level 3 có migration và shared contract xuyên workspace, chạy `check:full`
  sau targeted checks.

## Definition of Done

- Schedule engine và các luồng combined/external/busy/reschedule/cancellation còn
  nguyên behavior.
- Attendance happy path một màn hình, mặc định PRESENT và comment optional.
- Runtime không còn tạo/đọc/ghi cycle tám buổi hoặc Legacy Import.
- Tuition board hoạt động theo tháng và hiển thị present/total, absent, PAID/UNPAID.
- Google Sheet đẹp, dễ đọc và vẫn đồng bộ an toàn qua outbox.
- Dữ liệu lịch sử không bị xóa; migration có rollback plan.
- Tài liệu current-state và regression coverage phản ánh behavior mới.
- Targeted checks và full Level 3 verification đạt PASS trước khi commit cuối.

## Rủi ro còn lại có chủ đích

- Payment cycle lịch sử chưa được biểu diễn trong monthly UI vì không có mapping an
  toàn qua ranh giới tháng.
- Bảng/schema cũ vẫn chiếm dung lượng cho đến một cleanup database được duyệt riêng.
- Wireframe cũ vẫn được giữ theo repository policy dù không còn phản ánh UI mới.
