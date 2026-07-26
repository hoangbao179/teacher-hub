# API guidelines

Response thành công:

```json
{"data": {}}
```

Response lỗi:

```json
{"error":{"code":"VALIDATION_ERROR","message":"..."}}
```

- Route protected dùng Bearer JWT.
- Client không gửi userId authoritative.
- Endpoint mutation cần state guard và transaction khi ảnh hưởng học phí.
- Public API V1 chỉ cần nội dung Home tĩnh; không CMS.

Vocabulary V20B đã bổ sung public media read-only; assignment/game public API của
V20C–V20E vẫn **PLANNED**.
Các route public phải được đăng ký rõ ràng trước
`router.use("/api", requireAuth)`; không nới auth cho toàn bộ `/api`. Route V20
chỉ dùng prefix `/api`, DTO dùng `@teacher/shared`, public limiter tách login
limiter và response không trả roster/đáp án chưa chấm.
