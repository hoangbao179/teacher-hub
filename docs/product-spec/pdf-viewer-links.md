# PDF từ liên kết Google Drive Viewer — yêu cầu sản phẩm

## Mục tiêu và phạm vi

Người dùng dán link Viewer mở được trong cửa sổ ẩn danh, nhấn **Tạo PDF**, nhận
PDF để in. Không yêu cầu Owner/Editor, upload ảnh, đăng nhập quản trị hoặc checkbox
xác nhận quyền tải. PDF chỉ chứa ảnh là kết quả đạt yêu cầu: không cần OCR,
searchable text, vector, bookmark hay giữ metadata/chữ ký số của bản gốc.

Link cần đăng nhập Google ngoài phạm vi v1. Không thu cookies, mật khẩu, session
Drive hoặc tự thêm OAuth. Quyền xem không đồng nghĩa quyền tải/in/copy. Phải xét
`capabilities.canDownload` hoặc bằng chứng quyền tương đương trong đúng ngữ cảnh
người truy cập; không suy quyền từ role Viewer hay nút giao diện đơn lẻ.
[Hướng dẫn Google](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
yêu cầu kiểm tra khả năng tải trước khi tải/xuất.

Khi owner/admin hạn chế tải/in/copy, phải báo rõ và yêu cầu bản nguồn hoặc quyền
hợp lệ; không dùng screenshot/tile/scrape, endpoint ẩn, replay cookies hay né
CAPTCHA để vượt hạn chế. Trường hợp từng được yêu cầu là Viewer khóa Print vẫn
còn khoảng cách về yêu cầu/quyền; không âm thầm đổi thành happy path đã đạt.

## Chất lượng và tài liệu dài

- Đủ trang, đúng thứ tự, đúng chiều/tỷ lệ, không toolbar, thiếu/trùng/cắt mép;
  trang trắng có chủ đích phải giữ. Chữ Việt nhỏ, dấu và bảng nét mảnh cần đọc rõ
  trên bản in. Native ≥200 DPI hiệu dụng; mục tiêu 200–300 DPI không phải cam kết
  mọi preview có 300 DPI hoặc bản scan gốc đủ chi tiết.
- Tối đa 200 trang ở v2; nguồn trực tiếp tối đa 20 MiB, kết quả tối đa 150 MiB.
  Giới hạn độc lập. JPEG thích ứng 90/85/80, mục tiêu mềm 500 KB/trang; không giảm
  dưới 200 DPI, bỏ trang hay đảo thứ tự để đạt dung lượng.
- V2 dùng phần nhỏ, checkpoint bền vững, recovery sau đóng trang/Worker lỗi; UI
  hiển thị số trang, tiến độ và tải khi hoàn tất. V1 giữ 40 trang/20 MiB khi chưa
  kích hoạt v2. Việc nâng cap cần review tài nguyên/streaming/timeout/chi phí.
- V2 nhận tối đa 1 link/batch, 3 job active và 20 lượt tạo job/giờ theo owner,
  gồm manual retry, dùng chung public/private và job v1. Gửi lại đúng idempotency
  không tạo job mới. Chỉ 1 Worker thực thi cùng lúc theo cấu hình mục tiêu; quota
  tiếp nhận không phải tốc độ hoàn thành. Operator có thể hạ giới hạn.

## Điều kiện nghiệm thu

Khi xác định được tên nguồn từ response direct hợp lệ hoặc tiêu đề Viewer công
khai sau khi tài liệu mở thành công, giữ tên theo job và dùng cho lịch sử/tải PDF.
Không lấy được tên vẫn xử lý bình thường, fallback theo Drive ID. Job cũ không
cần backfill; không mở thêm nguồn hay quyền truy cập. Form nêu rõ lịch sử và tên
tài liệu public dùng chung giữa thiết bị. Tải native chỉ báo đã gửi yêu cầu cho
trình duyệt bằng thông báo tạm thời, không khẳng định tải hoàn tất.

| Trường hợp | Kết quả yêu cầu |
| --- | --- |
| Viewer khác Owner, mở ẩn danh, được phép tải/in | PDF hợp lệ, đủ trang, tải được để in; bắt buộc E2E thực tế |
| File owned, public và cho tải | Thành công là bằng chứng riêng, không thay test Viewer khác Owner |
| Preview mở được nhưng cấm tải/in/copy | Dừng an toàn, nêu hạn chế và cách xin quyền; không chụp để vượt khóa |
| Link cần Google login | Báo chưa hỗ trợ/cần đăng nhập; không mượn session |
| Link có resourcekey hoặc dạng Drive khác | Hỗ trợ đúng với quyền hợp lệ qua thiết kế/test riêng, hoặc giải thích chưa hỗ trợ; không âm thầm bỏ key |
| Workspace native, HTML login/confirmation/CAPTCHA | Không ghi nhận thành PDF thành công giả |
| Quá link, >20 MiB nguồn, >200 trang v2 hoặc vượt cap output | Từ chối rõ ràng, không nới cap tự động |
| 3/35/>50/200 trang; trắng/ngang/chữ Việt nhỏ/ảnh màu | Kiểm đủ trang, thứ tự, tỷ lệ, nét in, bytes, tài nguyên và thời gian |
| Đóng trình duyệt, restart Worker, mất checkpoint/result response | Tiếp tục từ trạng thái bền vững, không cần tab đang mở |
| Retry, replay, outage Tasks/GCS/Gateway | Không thành công giả, không tạo job ngoài ý muốn, không lộ secret |
| Thiết bị thứ hai, ticket đã dùng/hết hạn, job quá TTL | Tải hợp lệ khi còn quyền; từ chối ticket replay/hết hạn và job hết hạn |

## Khoảng cách implementation cần giữ rõ

Parser chỉ chấp nhận đúng hai dạng `/file/d/ID/view` không query và `/open?id=ID`,
nên resourcekey chưa hỗ trợ. Source thử direct rồi fallback Viewer và chưa xác
minh Drive capabilities; nhánh active không chặn Print disabled. Không đổi yêu
cầu quyền ở trên để hợp thức hóa implementation. Checkbox đã bỏ;
`rightsConfirmedAt` còn trong DB/DTO chỉ là tương thích, không chứng minh quyền.

Đọc [tổng quan source](../features/pdf-worker.md) và
[trạng thái hiện hành](../implementation/status.md) để biết bằng chứng còn thiếu.
Fixture offline/FakeCloud, health hoặc capabilities 200 trang đều không thay E2E
Viewer được phép tải, review quyền, Cloud Run thật và nghiệm thu bản in.
