# AGENTS.md — Teacher Class Hub

File này là hướng dẫn mặc định cho Codex/Cursor/AI agent khi làm việc trong repository.

## 1. Repository reality

Đây là npm workspaces monorepo:

- `server/`: Express + MySQL, CommonJS build.
- `client/`: React + Vite + MUI, ES modules.
- `shared/`: source of truth cho contracts/DTO/enums dùng chung.
- `docs/`: source of truth cho nghiệp vụ và kiến trúc.

Không copy DTO giữa `server` và `client`. Import từ `@teacher/shared`.

## 2. Source-of-truth priority

Khi có mâu thuẫn, dùng thứ tự:

1. `docs/product-spec/03-business-rules.md`
2. tài liệu feature trong `docs/features/`
3. acceptance criteria trong `docs/product-spec/09-acceptance-tests.md`
4. contracts trong `shared/src/contracts/`
5. migration/schema và source hiện tại
6. wireframe

Wireframe là tham chiếu UX, không phải nguồn business logic. Ảnh AI có thể chứa text/số liệu không nhất quán.

## 3. V1 business boundaries

- Chỉ một giáo viên/admin.
- Học sinh không phải user.
- Một học sinh chỉ có tối đa một enrollment `ACTIVE`.
- Lớp 1 kèm 1 và lớp nhóm dùng cùng domain model.
- Học phí theo gói 8 buổi, không theo số giờ.
- Chỉ attendance `PRESENT` và `countsForTuition=true` mới cộng chu kỳ.
- `ABSENT` không cộng; `FREE` có học nhưng không cộng.
- Học sinh `tuitionMode=FREE` không tạo chu kỳ học phí.
- Giờ thực tế chỉ để theo dõi/export, không quy đổi số buổi.
- Dữ liệu nhập muộn phải xử lý theo ngày học thực tế.
- Chu kỳ đủ 8 tự chuyển `PAYMENT_DUE`.
- Thanh toán toàn bộ; V1 không thanh toán một phần.
- Chu kỳ `PAID` bị khóa; chỉnh sửa phải có flow mở khóa rõ ràng, không âm thầm sửa.
- Đóng lớp/ngừng học là đổi trạng thái, không xóa lịch sử.
- Không triển khai notification, Zalo/Messenger API, payment gateway, CMS, nhiều giáo viên trong V1 nếu user không mở scope.

## 4. Architecture rules

Backend layering:

- Controller: parse input, auth, HTTP mapping.
- Service: business rules, transaction orchestration.
- Repository: SQL và row mapping.
- Không đặt SQL trong controller.
- Không gọi API ngoài trong DB transaction.

Frontend:

- API calls ở `client/src/api/`.
- Page không gọi `fetch` trực tiếp.
- Mobile-first 360/375/390/430px.
- Không dùng bảng rộng cho luồng thao tác mobile; dùng cards/lists.
- Bottom navigation là navigation chính cho admin mobile.

Database:

- Tiền lưu `BIGINT` VND.
- Thời lượng lưu phút nguyên.
- Ngày học lưu `DATE`, giờ lưu `TIME`.
- Hiển thị theo `Asia/Ho_Chi_Minh`.
- Không xóa cứng dữ liệu đã phát sinh học phí.

## 5. Change discipline

Trước thay đổi không nhỏ:

1. Đọc docs liên quan.
2. Đọc shared contract liên quan.
3. Đọc controller/service/repository/schema liên quan.
4. Chọn diff nhỏ nhất đúng nghiệp vụ.
5. Cập nhật docs nếu đổi rule/API/schema/deploy.
6. Chạy verification phù hợp.

Không:

- refactor rộng ngoài task;
- tự thêm dependency nặng;
- log password/JWT/secret;
- tin `studentId`, `userId` từ client nếu server có context authoritative;
- tuyên bố build/test thành công nếu chưa chạy.

## 6. Verification

Sau thay đổi shared: build shared + typecheck server/client.

Sau backend/schema:

```bash
npm -w server run typecheck
npm -w server run build
```

Sau frontend:

```bash
npm -w client run typecheck
npm -w client run lint
npm -w client run build
```

Toàn repo:

```bash
npm run verify
```

Kiểm tra UTF-8 sau khi sửa docs tiếng Việt:

```bash
rg "Ã|Ä|á»|áº|Â|�" docs AGENTS.md .cursor server shared client
```
