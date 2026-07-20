# Frontend architecture

- React Router cho public/admin routes.
- MUI theme và component primitive.
- API access qua `client/src/api/client.ts`.
- Auth bootstrap chỉ tin token đã được `GET /api/auth/me` xác thực; protected
  routes chờ bootstrap và API 401 xóa session tập trung.
- Admin shell có bottom navigation mobile-first.
- Trang list dùng card thay vì table ngang.

Viewport nghiệm thu: 360, 375, 390, 430px; không horizontal scroll.

Wizard ghi buổi học M2C dùng `/admin/lessons/new` và
`/admin/lessons/:id/edit`, chia 4 bước:

1. thông tin buổi;
2. điểm danh;
3. nội dung/bài tập;
4. xác nhận.

Mỗi lần tiếp tục ghi draft lên server qua `client/src/api/lessons.ts`; reload một
draft khôi phục participant, attendance và content đã lưu. UI cảnh báo khi rời
trang có thay đổi local, chặn duplicate submit và giữ primary action phía trên
bottom navigation ở viewport 360–430px.

M4B tuition pages call `client/src/api/tuition.ts`. List responses preserve API
pagination metadata through `apiEnvelope`; pages never calculate authoritative
payment state. Detail/payment primary actions remain above bottom navigation,
and all cycle items use mobile cards rather than a wide table.
