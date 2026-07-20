# Deployment architecture

Khuyến nghị một VPS:

- `web`: Nginx static, 32–64MB RAM.
- `api`: Node, connection pool 5.
- `mysql`: buffer pool 256MB.

Không thêm Redis, queue hoặc worker trong V1. Backup MySQL hằng ngày và giữ tối thiểu 7 bản.

Dù web/api là hai container, source vẫn là một repository/workspace và deploy bằng một compose file.
