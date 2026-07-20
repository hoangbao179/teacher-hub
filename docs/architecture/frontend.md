# Frontend architecture

- React Router cho public/admin routes.
- MUI theme và component primitive.
- API access qua `client/src/api/client.ts`.
- Admin shell có bottom navigation mobile-first.
- Trang list dùng card thay vì table ngang.

Viewport nghiệm thu: 360, 375, 390, 430px; không horizontal scroll.

Wizard ghi buổi học nên chia 4 bước:

1. thông tin buổi;
2. điểm danh;
3. nội dung/bài tập;
4. xác nhận.
