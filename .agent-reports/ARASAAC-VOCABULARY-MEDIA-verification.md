# ARASAAC-VOCABULARY-MEDIA Verification

## Acceptance

Các acceptance mục trong tài liệu cùng tên đều đạt. Không tạo migration mới.

## Typecheck/lint

- `npm run build:shared`: PASS.
- `npm -w server run typecheck`: PASS.
- `npm -w client run typecheck`: PASS.
- `npm -w client run lint`: PASS.
- `npm run build`: PASS.
- `npm run check:repo`: PASS, 110 Express route khớp OpenAPI.

## Unit/integration/E2E

- `npm -w server run test`: PASS, 174 pass / 77 skip integration theo env.
- `npm -w client run test`: PASS, 60/60.
- `npm run test:integration`: PASS, 77/77.
- Targeted `v20b.integration.test.ts`: PASS, 2/2 sau bổ sung cache >100 và public assignment.
- `npm -w client run test:e2e:vocabulary-media`: PASS.
- Không chạy full E2E toàn hệ thống theo phạm vi user yêu cầu.

## Kiểm tra UI thủ công

Screenshot local: `test-results/arasaac-390x844.png` và
`test-results/arasaac-1366x768.png`. Cả hai viewport không overflow; pictogram dùng
contain, nền trong suốt hiển thị trên nền sáng và dialog giữ action rõ ràng.

Live ARASAAC ngày 30/07/2026:

| Query | Kết quả | Độ phù hợp tối đa 6 kết quả đầu | Search | Import/convert |
|---|---:|---|---:|---:|
| apple | 3 | 3/3 đúng nghĩa | 887 ms | 1122 ms |
| cat | 5 | 5/5 đúng nghĩa | 301 ms | 275 ms |
| bus | 4 | 4/4 đúng nghĩa | 291 ms | 278 ms |
| happy | 11 | 6/6 đúng cảm xúc | 303 ms | 557 ms |
| run | 9 | 6/6 đúng hành động | 302 ms | 549 ms |
| read | 5 | 5/5 liên quan đọc/kể | 300 ms | 567 ms |
| brush teeth | 4 | 4/4 đúng cụm từ | 304 ms | 529 ms |
| go to school | 1 | 1/1 đúng cụm từ | 281 ms | 527 ms |
| bank | 6 | 6/6 đúng nghĩa tài chính | 302 ms | 543 ms |

Tất cả game/thumbnail đo được lần lượt 500×500 và 320×320 WebP, giữ alpha; thumbnail
dùng contain nên không crop. Pixabay live trả sáu kết quả apple trong 2229 ms nhưng
trộn icon/logo/nhóm trái cây, sau đó trả 429 cho tám query còn lại. Kết quả này cho
thấy ARASAAC khả quan hơn cho minh họa từ vựng trong mẫu hiện tại, nhưng chưa đủ để
kết luận head-to-head rộng vì lượt Pixabay bị giới hạn.

## Tài liệu

Đã cập nhật OpenAPI, feature/security/deployment docs, env examples, Compose, workflow
deploy và CSP cho `static.arasaac.org`.

## Final verdict

PASS
