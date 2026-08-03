# Release and production checklist

Git history giữ kết quả kiểm tra của từng revision. Checklist này chỉ chứa gate
phải lặp lại cho release/environment hiện tại.

## Repository gate

- [ ] Revision/tag đã được review và working tree sạch.
- [ ] Mandatory checks theo task level và release scope đã PASS.
- [ ] `npm run check:repo` không phát hiện artifact, private data hoặc source không
  hợp lệ.
- [ ] Nếu phát hành source package: `npm run package:source` và
  `npm run check:package` PASS.
- [ ] Không có `.env`, workbook thật, database dump, log, screenshot/trace/video
  kiểm thử hoặc build output trong staged diff/package.

## Production operator gate

- [ ] Public identity/contact/domain/media đã được chủ repository duyệt.
- [ ] GitHub Secrets, OAuth/provider flags và first-admin rotation được kiểm tra
  ngoài log.
- [ ] Backup pre-deploy và checksum hợp lệ; restore drill gần nhất đã được review.
- [ ] Docker images đúng full commit SHA; MySQL/API/Web/Caddy healthy.
- [ ] HTTPS, firewall, persistent volumes, log rotation và retention đã xác minh.
- [ ] Với vocabulary media: recovery set gồm cả MySQL và `vocabulary-media`.
- [ ] Query plan, RAM/IO/disk và tốc độ tăng volume đã đo trên dữ liệu đại diện.
- [ ] Known limitations và remaining risks được owner chấp nhận.

Unchecked operator item chặn production approval, không phủ định targeted local
verification của source revision.
