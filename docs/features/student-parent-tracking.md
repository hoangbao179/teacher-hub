# Theo dõi học sinh và chia sẻ với phụ huynh

Tài liệu này là source of truth cho thiết kế V16B–V16E của luồng:

```text
Legacy Excel
→ Preview
→ Apply vào database
→ Tạo Google Sheet cho học sinh
→ Đồng bộ lesson
→ Đồng bộ học phí
→ Chia sẻ cho phụ huynh
```

Các phần ghi **Hiện hành** mô tả source đang chạy. Các phần ghi **PLANNED** là
trạng thái đích, chưa có runtime code, schema, credential hay Google integration.
Database Teacher Hub luôn là source of truth; Google Sheet chỉ là bản trình bày
một chiều cho phụ huynh.

## 1. Baseline đã xác minh

| Khả năng | Trạng thái hiện hành |
| --- | --- |
| Legacy Excel | V16B giữ preview V16A và có Apply multipart: server đọc/parse/reconcile lại, kiểm tra SHA và structured decisions rồi ghi atomic vào MySQL; binary tạm luôn bị xóa. |
| Attendance | Lưu riêng theo `lesson_session_participants`/enrollment; mỗi participant có tối đa một `lesson_attendances`. Không có attendance chung cho cả lớp. |
| Lesson | `lesson_sessions` có `content`, `homework`, `general_comment` dành cho phụ huynh và `note` nội bộ; `lesson_attendances.student_note` là ghi chú riêng. |
| Tuition cycle | `tuition_cycles` vẫn dùng `enrollment_id` làm anchor tương thích, nhưng recalculation V16B khóa và nhóm attendance theo student xuyên enrollment. Chỉ `PRESENT` tăng đếm; chuyển lớp cùng giá tiếp tục cycle dở. |
| Google | V16C tạo Sheet; V16D có transactional outbox và worker cập nhật lesson một chiều. Không dùng permissions API. |
| Student Detail | Bề mặt chính hiển thị lớp/học phí và trạng thái sổ bằng ba nhãn thân thiện: Đã đồng bộ, Đang chờ đồng bộ, Có lỗi đồng bộ. Mở sổ và sao chép liên kết là CTA chính; số liệu hàng đợi, lỗi chi tiết và recovery nằm trong Công cụ nâng cao. |

Vì vậy việc giữ cycle dở xuyên enrollment và một Sheet ổn định theo student là
thay đổi domain **PLANNED**, cần migration/API/runtime riêng trong các task sau;
không được đọc các quy tắc đích dưới đây như mô tả chức năng đã chạy.

V16B trả thêm row-resolution lifecycle, structured decision, audit theo dòng và
endpoint Apply. V16C dựng Sheet từ canonical DB. V16D đồng bộ lesson sau commit;
tuition sync và sharing tự động vẫn thuộc V16E **PLANNED**.

## 2. Mô hình đích và ranh giới trách nhiệm

- V16B (**IMPLEMENTED**) ghi dữ liệu chuẩn hóa vào MySQL trong transaction; không gọi Google.
- V16C (**IMPLEMENTED**) tạo và quản lý một Google Sheet của từng student.
- V16D (**IMPLEMENTED; manual Google smoke pending**) phát sự kiện bằng transactional
  outbox, đồng bộ lesson sau commit và cung cấp retry/resync/status cho admin.
- V16E đồng bộ tuition và chia sẻ Viewer.
- External API không bao giờ được gọi bên trong transaction MySQL.
- Retry Google chỉ phát lại dữ liệu đã commit; không apply import hoặc mutation
  nghiệp vụ lần thứ hai.
- `CREATING` dưới 10 phút được xem là đang chạy. Sau 10 phút, admin có thể retry;
  retry luôn tìm resource theo `appProperties` trước khi tạo nên không sinh file trùng.
- Không đồng bộ hai chiều. Thay đổi thủ công trên Sheet không ghi về Teacher Hub
  và có thể bị lần resync sau ghi đè trong vùng do hệ thống quản lý.

## 3. Vòng đời Google Sheet — IMPLEMENTED V16C

- Mỗi student có tối đa một Google Sheet `ACTIVE`.
- Sheet thuộc tài khoản Google của cô Vy và gắn với `student_id`, không gắn với
  class hoặc enrollment.
- URL/spreadsheet ID ổn định xuyên suốt quá trình học.
- Tên file gồm tên học sinh và lớp hiện tại; thao tác tạo lại nội dung cập nhật tên nếu
  học sinh đã chuyển lớp nhưng vẫn giữ nguyên URL.
- Không tạo Sheet mới khi học sinh lên lớp, chuyển lớp/nhóm, đổi lịch, tạm nghỉ
  hoặc quay lại.
- Khi lên lớp/chuyển lớp: đóng enrollment cũ, tạo enrollment mới và giữ lịch sử; các dòng
  quá trình học tập mới mang tên lớp mới.
- Một cycle dở của student được tiếp tục qua enrollment theo quy tắc tại mục 7;
  không reset âm thầm chỉ vì chuyển lớp.
- Chỉ thay Sheet khi file lỗi, giáo viên chủ động archive, có yêu cầu riêng tư,
  hoặc một migration thủ công được xác nhận rõ. Thay thế phải giữ audit và trạng
  thái file cũ, không tạo hai Sheet `ACTIVE`.

Student Detail giải thích rõ dữ liệu buổi học được nhập trong Teacher Hub rồi đồng
bộ một chiều sang sổ phụ huynh. Khi chưa có Sheet, card chỉ mời tạo Google Sheet;
khi đã ACTIVE, card ưu tiên mở sổ, sao chép liên kết và thời điểm đồng bộ gần nhất.
Retry creation, regenerate, resync, archive và chi tiết lỗi không bị xóa nhưng chỉ
hiện trong `Công cụ nâng cao`.

## 4. Template Google Sheet — IMPLEMENTED V16C

### `Quá trình học tập`

Một dòng cho mỗi lesson + student participant. Các cột nghiệp vụ đồng nhất với sheet
`Quá trình học tập` trong file Excel tải xuống, theo thứ tự:

1. `Teacher Hub Lesson ID` — ẩn.
2. Ngày học.
3. Lớp.
4. Loại buổi.
5. Giờ dự kiến bắt đầu.
6. Giờ dự kiến kết thúc.
7. Trạng thái.
8. Nội dung buổi học.
9. Bài tập về nhà.
10. Nhận xét học sinh.

Cột `Nội dung buổi học` rộng 300 px và `Nhận xét học sinh` rộng 200 px. Đây cùng với
`Học phí` là hai sheet hiển thị, đồng nhất với file Excel tải xuống. Template không tạo
sheet `Tổng quan` hoặc `Ôn từ vựng`; `_TeacherHub` chỉ là sheet kỹ thuật bị ẩn.

### `Học phí`

Một dòng cho mỗi cycle của student, theo thứ tự:

1. `Tuition Cycle ID` — ẩn.
2. Chu kỳ.
3. Năm học.
4. Lớp.
5. Từ ngày.
6. Đến ngày.
7. Số buổi tính phí.
8. Số buổi nghỉ.
9. Tổng lịch học.
10. Mức học phí.
11. Trạng thái.
12. Ngày thu.
13. Hình thức thanh toán.

Nếu cycle đi qua nhiều enrollment/class, cột Lớp phải trình bày rõ các lớp liên
quan hoặc lớp tại thời điểm bắt đầu; không được sửa lịch sử thành lớp hiện tại.

### `_TeacherHub`

Sheet ẩn và protected, lưu `schemaVersion`, `studentId`, `spreadsheetId`, mapping
lesson → row, mapping tuition cycle → row và `lastSyncedAt`. Không lưu access token,
refresh token, client secret hoặc bất kỳ secret nào.

## 5. Lesson, attendance và nhận xét — IMPLEMENTED V16D

Một group lesson chỉ có một lesson chung với nội dung, bài tập và nhận xét chung.
Mỗi student participant có attendance, billable và nhận xét riêng. Không dùng một
attendance record chung cho cả lớp.

Trạng thái đích tối thiểu:

| Trạng thái | Có học | Tính phí | Ghi chú |
| --- | --- | --- | --- |
| `PRESENT` | Có | Có | Quy tắc hiện hành. |
| `ABSENT` | Không | Không | Quy tắc hiện hành. |
| `FREE` | Có | Không | Quy tắc hiện hành. |

UI đích mặc định mọi học sinh trả phí là có mặt, có `Tất cả có mặt`, `Tất cả nghỉ`,
cho giáo viên chỉnh ngoại lệ, thu gọn nhận xét riêng và chỉ nhập nội dung/bài tập/
nhận xét chung một lần.

### Nhận xét chung

- Lưu một lần tại `lesson_sessions.general_comment`; `lesson.note` tiếp tục là nội bộ.
- Chỉ áp dụng cho student `PRESENT` hoặc `FREE` trong lesson đó.
- Student `ABSENT` vẫn thấy ngày, nội dung và bài tập nhưng mặc định không nhận
  general performance comment.

### Nhận xét riêng

- Lưu theo lesson + student và chỉ xuất hiện trong Sheet của đúng student.
- Với student `ABSENT`, chỉ hiển thị ghi chú riêng liên quan việc nghỉ nếu có.
- Action phải mang nhãn đầy đủ `Dùng làm nhận xét chung cho cả lớp`. Khi xác nhận,
  sao chép nội dung hiện tại sang `lesson.generalComment`; không tạo note riêng cho
  mọi student, không ghi đè note riêng khác, và xóa note nguồn nếu nó trùng hoàn
  toàn general comment. Không dùng nhãn mơ hồ “Áp dụng cho tất cả”.

## 5.1. Transactional outbox và worker — IMPLEMENTED V16D

- Mutation của lesson `COMPLETED` upsert khóa logic
  `(student_id, lesson_id, event_type)` trong cùng transaction MySQL; rollback
  business data cũng rollback event. Student không có Sheet `ACTIVE` không tạo event.
- Worker claim batch bằng transaction ngắn và `SKIP LOCKED`, gọi Google sau commit,
  rồi chỉ đánh dấu thành công nếu revision chưa đổi. Lock stale được reclaim.
- Retry dùng mốc 1 phút, 5 phút, 900 giây, 1 giờ rồi exponential có giới hạn;
  lỗi vĩnh viễn chuyển `DEAD` và chỉ lưu message đã rút gọn.
- Worker đọc snapshot canonical mới nhất, tìm row bằng `Teacher Hub Lesson ID` rồi
  append/update/remove đúng row. Chỉ cập nhật `Quá trình học tập` và timestamp
  `_TeacherHub`; không sửa tab `Học phí`.
- `POST /api/students/:studentId/google-sheet/resync` chỉ upsert event cho toàn bộ
  lesson đã hoàn thành, không gọi Google trong request và có audit.

Khi import legacy, nhận xét trong file từng student mặc định là nhận xét riêng.
Nếu nhiều file của cùng lesson có text giống hệt, preview chỉ gợi ý gộp; người dùng
phải xác nhận và hệ thống không tự gộp âm thầm.

## 6. Matching và apply legacy — IMPLEMENTED V16B

### Trạng thái xử lý từng dòng

Mỗi dòng nguồn có đúng một trạng thái xử lý tại một thời điểm:

| Trạng thái | Ý nghĩa | Điều kiện trước Apply |
| --- | --- | --- |
| `VALID` | Dòng đã hợp lệ từ parser/reconciliation và không cần admin thao tác. | Được đưa vào tập accepted tự động. |
| `NEEDS_REVIEW` | Có nhiều cách hiểu hợp lệ hoặc cần admin xác nhận nghiệp vụ. | Phải có structured decision để thành `RESOLVED` hoặc `SKIPPED`. |
| `BLOCKED` | Dữ liệu dòng chưa thể tạo mutation hợp lệ. | Phải được sửa thành dữ liệu hợp lệ rồi thành `RESOLVED`, hoặc được `SKIPPED`. |
| `RESOLVED` | Admin đã cung cấp structured decision đầy đủ và kết quả đã validate. | Được đưa vào tập accepted. |
| `SKIPPED` | Admin quyết định không import dòng với lý do rõ ràng. | Không ghi business table; vẫn ghi audit. |

Trong V16B, “accepted rows” là tập `VALID + RESOLVED`; `ACCEPTED` không phải một
trạng thái thứ sáu. Apply bị disabled khi còn bất kỳ dòng `NEEDS_REVIEW` hoặc
`BLOCKED`. Không có action “force import raw invalid row” hoặc cách đổi trạng thái
chỉ để vượt validation.

Một dòng lỗi không bắt buộc hủy cả file nếu lỗi đó là row-level, admin có quyền
skip và đã nhập lý do hợp lệ. Ngược lại, file-level error không được giải quyết
bằng skip row. Các lỗi như file quá lớn/sai signature, workbook không đọc được,
thiếu cấu trúc bắt buộc, file không khớp student đang chọn hoặc metadata toàn file
không đáng tin cậy phải chặn cả file trước bước row resolution.

### Structured decision và action

Decision phải tham chiếu import ID, source sheet, source row, issue code, action,
payload đã validate, actor và timestamp. Tùy issue, UI chỉ đưa ra các action phù hợp:

- sửa ngày;
- map academic period/class;
- chọn attendance `PRESENT`, `ABSENT` hoặc `FREE`;
- ghép lesson hiện có;
- tạo lesson mới;
- giữ nội dung hiện tại;
- dùng nội dung import;
- chỉnh thủ công;
- bỏ qua dòng.

Payload attendance ngoài ba trạng thái trên không được validate. Duplicate và
near-match luôn cần decision ghép lesson hiện có, tạo lesson mới hoặc bỏ qua; không
tự merge. Conflict content/homework cần decision giữ nội dung hiện tại, dùng nội
dung import hoặc chỉnh thủ công; quyết định của file sau không được âm thầm thắng.

Mọi decision, kể cả sửa/map/merge/content/attendance/skip, phải có audit before/
after hoặc payload có cấu trúc, issue code, `decidedBy` và `decidedAt`. Riêng dòng
`SKIPPED`, audit bắt buộc giữ source sheet, source row, raw values hoặc sanitized
snapshot, issue code, skip reason, decided by và decided at. Ưu tiên sanitized
snapshot đủ tái kiểm tra; raw values chỉ được giữ trong vùng restricted theo chính
sách dữ liệu riêng tư.

Bulk decision dùng tiêu chí tương đương riêng theo từng issue, không so sánh toàn
bộ `normalizedValues`: attendance theo loại nguyên nhân và lựa chọn điểm danh;
student mismatch theo tên trong workbook và student đích; time theo raw time đã
normalize hoặc `mappingId` cùng giờ đề xuất; correction ngày không bulk; issue tài
chính chỉ bulk trong cùng block/group nghiệp vụ. UI phải hiển thị đúng số dòng thực
sự chịu ảnh hưởng và hỏi xác nhận trước khi thay đổi cả dòng hiện tại. Bulk chỉ là
thao tác rút gọn trên UI; Apply vẫn validate structured decision của từng row.

### Apply transaction

- Apply chỉ nhận snapshot resolution không còn `NEEDS_REVIEW`/`BLOCKED` và phải
  chống stale decision bằng version/hash phù hợp.
- Tất cả dòng accepted (`VALID + RESOLVED`) được ghi business tables trong một
  transaction MySQL. Metadata import và audit của các dòng `SKIPPED`/decision cũng
  được lưu nhất quán với lần Apply đó.
- Dòng `SKIPPED` không tạo lesson, participant, attendance, tuition item/cycle hoặc
  outbox Google; vì vậy không ảnh hưởng bộ đếm học phí và không xuất hiện trên
  Google Sheet khi các checkpoint sync chạy sau này.
- Lỗi kỹ thuật ở bất kỳ database mutation hoặc audit write nào rollback toàn bộ;
  không có partial apply. Sau rollback, retry dùng cùng resolution snapshot và
  idempotency key, không bỏ qua validation.

### Nhận diện file và idempotency

- File phải khớp student đang chọn bằng dữ liệu workbook đã chuẩn hóa; không suy
  student chỉ từ filename. Không khớp thì chặn apply và yêu cầu review.
- Lưu original filename đã sanitize, size, SHA-256, import status và applied time.
- Cùng student + cùng SHA-256 đã apply phải trả kết quả idempotent, không tạo dữ
  liệu hay audit nghiệp vụ lần hai.
- Binary mặc định chỉ tồn tại tạm và bị xóa; metadata/audit được giữ lâu dài.

### Lesson matching

Sheet `Quá trình học tập` là nguồn chuẩn của lesson. Lesson learning-only vẫn được
import theo attendance thể hiện trong workbook dù thiếu dòng đối chiếu ở `Học phí`;
trường hợp này không tạo `ATTENDANCE_AMBIGUOUS`, không tự gán `FREE` và không tạo
cycle/khoản nợ. Có thể giữ note audit “Không có dữ liệu học phí đối chiếu”.

Hai sheet không bắt buộc cập nhật đồng thời. Dòng billable chỉ có trong `Học phí`
được gom thành một nhóm xác nhận `CREATE_MINIMAL_LEGACY_LESSONS`; khi xác nhận, hệ
thống tạo lesson `PRESENT + BILLABLE` với ngày/giờ và để trống nội dung, bài tập,
nhận xét. Nếu bỏ qua nhóm thì không tạo lesson, không đưa attendance vào cycle và
không kéo dài class/enrollment/policy runtime.

`FREE` chỉ được tạo từ marker `FREE` explicit trên chính dòng. Marker `PAID` sau đúng
tám dòng billable chốt cycle đầu thành `PAID`; mọi dòng billable phía sau vẫn tham gia
cycle kế tiếp ở trạng thái chưa thu. `TOTAL HOURS` được nhận như `TOTAL`; `UNPAID`
explicit không cần xác nhận lại, còn block có cả `PAID` và `UNPAID` phải review.

Time parser nhận phút một chữ số như phút thực (`h5` = `:05`), giờ thiếu phút như
`20-22h`, và dấu câu cuối. Dạng 12 giờ vẫn cần confirmation. Gợi ý giờ thiếu chỉ dựa
trên dòng hợp lệ gần trước/sau trong cùng ngữ cảnh; hai phía khác nhau, quá xa, raw
mơ hồ hoặc duration trên sáu giờ thì không tự đề xuất/lưu. Năm ngoài 2000–2100 bị
chặn thay vì tự sửa.

Exact match ưu tiên khóa `(classId, lesson date, scheduled start, scheduled end)`.
Content, homework hoặc comment không phải khóa chính. Near match không tự merge;
preview yêu cầu user chọn dùng lesson hiện hữu hay tạo lesson lịch sử mới.

Khi nhiều file student lần lượt mô tả cùng group lesson:

- exact match dùng lại lesson và thêm participant/attendance riêng;
- content/homework khác nhau được đưa ra review, không ghi đè theo “file sau thắng”;
- nhận xét giống nhau chỉ được gợi ý chuyển thành general comment;
- không làm lộ nội dung hoặc note riêng của student khác.

### Ma trận case bắt buộc

| Case | Kết quả bắt buộc |
| --- | --- |
| Đúng student, chưa import | Cho review rồi apply một lần. |
| Cùng student + cùng SHA đã apply | Trả idempotent; không ghi lần hai. |
| Không khớp student | Chặn apply. |
| Workbook kéo dài qua 01/06 | Mặc định giữ một grade/class context từ lesson đầu đến lesson cuối; chỉ tách khi workbook thể hiện rõ hoặc user chủ động chọn. |
| Student 1–1 | Dùng cùng domain lesson/participant như group. |
| Group import từ nhiều file | Exact lesson dùng chung; attendance/note riêng. |
| Exact lesson match | Merge participant theo lựa chọn đã review. |
| Near duplicate | Bắt buộc user quyết định. |
| `PRESENT` | Billable và tăng sequence. |
| `ABSENT` | Có lịch sử, không billable. |
| `FREE` | Có lịch sử, không billable. |
| 8 billable → `PAID` → dòng thường → `TOTAL` | Tám buổi đầu là cycle `PAID`; dòng thường sau marker trong cùng clean block là `FREE`, vẫn giữ history và không vào cycle. |
| `TOTAL` → block mới có 3 billable | Kết thúc phạm vi post-paid FREE; block mới tạo cycle `3/8 UNPAID`. |
| `PAID` mơ hồ hoặc conflict | Giữ payment review; không tự đổi dòng sau marker thành `FREE`. |
| Raw tuition date không hợp lệ | Giữ source row/raw value trong Preview và chặn Apply đến khi sửa file rồi tải lại. |
| Chỉ có trong `Học phí` | Xác nhận một lần theo nhóm để tạo lesson thiếu nhận xét, hoặc skip nếu nhóm không thuộc cycle đã thu. |
| `TOTAL HOURS \| UNPAID` | Kết thúc block và ghi nhận explicit chưa thu, không hỏi lại nếu không có conflict. |
| Đủ 8 billable | Cycle đạt `PAYMENT_DUE` hoặc trạng thái payment đã xác nhận. |
| Cycle dở | Giữ đúng tiến độ theo student. |
| Đã thu | Chỉ tạo `PAID` khi evidence/resolution đã được review; giữ bất biến sau apply. |
| Học phí chưa rõ | Không tự quyết định; giữ trạng thái review. |
| Content/homework khác giữa file cùng lesson | Hiển thị conflict; không ghi đè âm thầm. |
| Comment giống nhau | Chỉ gợi ý general comment. |
| Đã/chưa có ACTIVE Sheet | Import DB không phụ thuộc Google; outbox/resync xử lý sau. |
| Lên lớp | Giữ cùng Sheet và cycle dở theo student. |
| Import lịch sử sau khi có Sheet | Apply DB một lần rồi sync delta/resync từ DB. |
| Retry lỗi Google | Không apply DB lần hai. |

## 7. Cycle tám buổi theo student — IMPLEMENTED V16B

Cycle được tính riêng cho từng student, không theo class và trong thiết kế đích
không bị chia chỉ vì thay enrollment. Đây là delta so với schema hiện hành đang
gắn cycle với enrollment.

- Chỉ `PRESENT` tăng bộ đếm.
- `ABSENT` và `FREE` không tăng.
- Không chia cứ tám dòng Excel; chỉ nhóm tám attendance billable theo thứ tự ngày
  học chuẩn, tôn trọng ranh giới `PAID` bất biến.
- Ví dụ có 10 lịch học gồm 8 `PRESENT`, 2 `ABSENT`: cycle hoàn thành tại lịch thứ
  10; hai buổi nghỉ vẫn có trong lịch sử nhưng không có sequence number.
- Lên lớp/chuyển class ở 5/8 thì enrollment cũ đóng, enrollment mới mở và cycle
  tiếp tục từ 6/8. Không reset cycle hoặc Sheet.
- Nếu tuition mode/giá không đổi, mặc định đề xuất tiếp tục cycle hiện tại.
- Nếu giá hoặc hình thức học thay đổi giữa cycle, hệ thống không tự quyết định;
  giáo viên phải chọn tiếp tục cycle hiện tại hoặc quyết toán cycle cũ và mở cycle
  mới. Cách tính quyết toán cụ thể còn là quyết định mở tại mục 11.

## 8. Workbook gốc

- Workbook cũ chỉ là migration source, không phải file cho phụ huynh.
- Không upload workbook cũ vào thư mục chia sẻ phụ huynh.
- Sau apply lưu filename, size, SHA-256, status, applied time; mặc định không lưu
  binary lâu dài.
- Google Sheet mới được dựng từ dữ liệu chuẩn hóa trong DB, không convert nguyên
  trạng workbook cũ.

## 9. Bảo mật và riêng tư

- Mỗi Sheet chỉ chứa dữ liệu của một student; group lesson không mang dữ liệu
  định danh hoặc note của student khác sang Sheet.
- Sheet mặc định `Restricted`; parent mặc định `Viewer`.
- Không đưa internal note, bank/payment data không cần thiết, outbox error hoặc
  DB ID hiển thị cho parent.
- Technical IDs chỉ ở cột/sheet ẩn và protected.
- Không log token/secret. Credential/token được mã hóa và lưu ngoài Sheet; không
  nằm trong client-readable storage.
- Quyền chia sẻ bị thu hồi hoặc thay đổi phải có audit và có thể retry an toàn.

## 10. Failure, transaction và vận hành

- V16B commit toàn bộ import MySQL hoặc rollback toàn bộ; không gọi Google.
- V16D/V16E ghi outbox trong cùng transaction với mutation nghiệp vụ. Worker gọi
  Google sau commit, dùng event ID/idempotency key và upsert theo hidden mapping.
- Google timeout/429/5xx giữ DB thành công, đánh dấu retryable và retry có backoff.
  Lỗi auth/quyền đánh dấu cần admin can thiệp; không retry vô hạn.
- Lỗi 404 được phân biệt theo resource: folder gốc là `ROOT_FOLDER_MISSING`, file
  học sinh là `SPREADSHEET_MISSING`; UI không báo nhầm file mất thành folder mất.
- Resync luôn đọc canonical DB và tái tạo vùng hệ thống quản lý; không đọc Sheet
  làm nguồn nghiệp vụ.
- Regenerate chỉ xóa/cập nhật conditional formatting và protection do Teacher Hub
  quản lý trong vùng template; rule/protection người dùng tự tạo được giữ nguyên.
- Admin thấy trạng thái sync, thời điểm cuối, lỗi đã diễn giải và action retry/
  resync; không thấy token, raw provider payload hay stack trace.

## 11. Quyết định còn mở

| Quyết định | Đề xuất mặc định |
| --- | --- |
| Giá thay đổi giữa cycle dở được quyết toán thế nào | Giữ snapshot cũ nếu giáo viên chọn tiếp tục; nếu chọn chốt, yêu cầu amount/method/reason rõ và mở cycle mới từ attendance sau ngày hiệu lực. Không tự chọn. |
| Có lưu binary workbook trong restricted archive không | Không lưu mặc định; chỉ thêm archive có retention/access audit khi có yêu cầu vận hành rõ. |
| Parent không có Google account dùng sharing mode nào | Giữ `Restricted`; yêu cầu một Google account hoặc quy trình chia sẻ thủ công đã xác minh. Không bật “anyone with link” mặc định. |

Các quy tắc một Sheet theo student, URL ổn định, DB source of truth, sync một chiều,
attendance riêng, không tự gộp comment, không reset cycle và không gọi Google trong
V16B đã được chốt, không thuộc danh sách quyết định mở.
