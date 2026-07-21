# V13 Final UX and local operations

## Mục tiêu

Hoàn thiện Homepage và các luồng quản trị mobile trước independent full-system review,
đồng thời chốt vận hành local cho password, rate-limit và Vite port.

## Phạm vi

- Homepage: hero 3 media, spacing, intro, testimonial/contact/footer.
- Admin: Dashboard, học phí, học sinh, lớp, lịch và thuật ngữ end-user.
- Auth/local: password tối thiểu 6, reset-password, Retry-After và strict port 5173.
- Targeted/integration/E2E, viewport 360–430 và 1440, tài liệu cùng screenshot V2.

## Ngoài phạm vi

Không đổi contract, schema, migration hoặc business rule enrollment/lesson/tuition/
schedule/payment/export. Không thêm pagination học sinh hay date-picker dependency.
