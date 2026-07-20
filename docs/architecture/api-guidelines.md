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
