# Observability

Ứng dụng dùng JSON log hiện có, không thêm metrics stack riêng cho V1. Mọi request có
`x-request-id`, method, path đã redact, status và duration; error log chỉ có error
class/code an toàn.

Vocabulary phát các event:

- `vocabulary_image_provider_failed`: provider + failure category;
- `vocabulary_assignment_published`: assignment ID và count;
- `vocabulary_public_access_failed`: category, không có code/token/name;
- `vocabulary_access_session_created`: audience type và attempts used;
- `vocabulary_attempt_completed`: attempt ID, graded count và score;
- `vocabulary_review_draft_created`: source/draft ID và count.

Không thêm raw access/session token, URL share, guest/student name, roster hoặc answer
vào log/analytics. Theo dõi rate 4xx/5xx, provider failure, attempt completion latency,
media disk/inode (cảnh báo 80%) và result endpoint p95.

## Kiểm tra dữ liệu vận hành

Chạy read-only trong maintenance window; không hard-delete lịch sử:

```sql
SELECT COUNT(*) FROM learning_access_sessions
WHERE expires_at < UTC_TIMESTAMP() AND revoked_at IS NULL;

SELECT COUNT(*) FROM learning_attempts
WHERE status='IN_PROGRESS'
  AND last_activity_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR);

SELECT COUNT(*) FROM learning_attempt_questions q
LEFT JOIN learning_attempts a ON a.id=q.attempt_id
WHERE a.id IS NULL;

SELECT COUNT(*) FROM learning_attempt_answers x
LEFT JOIN learning_attempt_questions q ON q.id=x.attempt_question_id
WHERE q.id IS NULL;
```

Expired session/abandoned attempt cleanup là backlog vận hành, không tự xóa vì result
là lịch sử nghiệp vụ. Orphan media chỉ được báo cáo và xử lý sau recovery window.
