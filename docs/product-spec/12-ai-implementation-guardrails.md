# 12. AI Implementation Guardrails

1. Không thêm user cho học sinh/phụ huynh.
2. Không thêm nhiều giáo viên trong V1.
3. Không biến lịch dự kiến thành buổi đã học tự động.
4. Không tính tiền theo phút/giờ; luôn theo gói 8 buổi billable.
5. Không cộng buổi Nghỉ hoặc Miễn phí.
6. Không xóa cứng lịch sử.
7. Không thay đổi cycle PAID mà không có thao tác unlock rõ ràng.
8. Không làm CMS cho Home.
9. Không triển khai notification/push/Zalo/Messenger trong V1.
10. Không cho một học sinh có hai enrollment ACTIVE.
11. Không suy ra yêu cầu mới từ text sai hoặc số liệu minh họa trong wireframe.
12. Nếu ảnh và tài liệu mâu thuẫn, ưu tiên Business Rules rồi Screen Specifications.
13. Mọi phép phân bổ cycle phải chạy theo ngày học thực tế.
14. Các API hoàn thành buổi/đánh dấu thu phải idempotent và transactional.
