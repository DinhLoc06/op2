# Lab 3.6 — Authentication, JWT, RBAC và Audit Log

Ứng dụng NestJS + TypeORM + MySQL cho Product, Coupon, Order và Payment, bổ sung tài khoản, JWT, phân quyền theo vai trò, địa chỉ giao hàng, quyền sở hữu đơn hàng và audit log.

## Chạy ứng dụng

Yêu cầu Node.js và MySQL. Tạo database `nestjs_db` (hoặc cấu hình tên database khác), sau đó chạy từ PowerShell:

```powershell
npm install
$env:DB_HOST = "localhost"
$env:DB_PORT = "3306"
$env:DB_USERNAME = "root"
$env:DB_PASSWORD = ""
$env:DB_DATABASE = "nestjs_db"
$env:JWT_SECRET = "replace-with-a-random-secret-at-least-32-characters"
npm run start:dev
```

Nếu database đã có sản phẩm/đơn hàng từ phiên bản trước, chạy migration một lần để tạo các bảng tài khoản, địa chỉ, refresh token, audit log và thêm các cột liên kết tài khoản còn thiếu:

```sh
npm run db:migrate:auth
```

Lệnh dùng `DATABASE_URL` trong môi trường hoặc `backend/.env`, chạy an toàn nhiều lần và không xóa dữ liệu hiện có. Migration Neon hiện tại đã được áp dụng.

`JWT_SECRET` là bắt buộc, tối thiểu 32 ký tự. TypeORM `synchronize` đang bật để phục vụ bài lab; không dùng cấu hình này trên production. Dữ liệu đăng ký đầu tiên được tạo với vai trò `CUSTOMER`. Để khởi tạo admin cho bài lab, đăng ký tài khoản trước rồi chạy trong phpMyAdmin:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Đăng nhập lại sau khi đổi vai trò để lấy token mới.

## API và quyền

Tất cả endpoint đều yêu cầu `Authorization: Bearer <accessToken>`, ngoại trừ `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh` và `GET /`.

| Nhóm endpoint                                              | CUSTOMER         | STAFF            | ADMIN            |
| ---------------------------------------------------------- | ---------------- | ---------------- | ---------------- |
| `GET /products`, `GET /products/:id`, `GET /categories`    | Đọc              | Đọc              | Đọc              |
| Thêm/sửa/xóa/nhập/xuất/khôi phục Product; tạo/xóa Category | —                | Có               | Có               |
| Tạo/sửa Coupon                                             | —                | Có               | Có               |
| `GET /orders/my`, xem đơn và thanh toán đơn của mình       | Có               | Có               | Có               |
| `GET /orders`, xử lý trạng thái/refund, thống kê           | —                | Có               | Có               |
| `GET/PATCH/DELETE /users`                                  | —                | —                | Có               |
| `GET /audit-logs` (mọi log)                                | —                | —                | Có               |
| `GET /audit-logs` (log của chính STAFF)                    | —                | Có               | —                |
| CRUD `/addresses`                                          | Chỉ địa chỉ mình | Chỉ địa chỉ mình | Chỉ địa chỉ mình |

### Authentication

- `POST /auth/register`: `{ "email": "a@example.com", "fullName": "Nguyen Van A", "password": "12345678" }`
- `POST /auth/login`: `{ "email": "a@example.com", "password": "12345678" }`
- `POST /auth/refresh`: `{ "refreshToken": "<refreshToken>" }` — refresh token được xoay vòng; token cũ không dùng lại được.
- `POST /auth/logout`: yêu cầu access token; body `{ "refreshToken": "<refreshToken>" }`.
- `GET /auth/me`: trả thông tin tài khoản hiện tại.
- `PATCH /auth/change-password`: `{ "currentPassword": "...", "newPassword": "new-password-123" }`; đổi mật khẩu vô hiệu hóa refresh token và access token đã cấp.

Password được hash bằng bcrypt. Role không được nhận từ nội dung đăng ký. Refresh token chỉ được lưu ở dạng SHA-256 hash.

### Address và Order

`POST /addresses`:

```json
{
  "receiverName": "Nguyen Van A",
  "receiverPhone": "0901234567",
  "addressLine": "12 Le Loi",
  "ward": "Hai Chau 1",
  "district": "Hai Chau",
  "province": "Da Nang",
  "isDefault": true
}
```

Tạo đơn tại `POST /orders` yêu cầu `addressId` của chính tài khoản:

```json
{
  "addressId": 1,
  "items": [{ "productId": 1, "quantity": 2 }],
  "couponCode": "WELCOME10"
}
```

Gửi `Idempotency-Key` trong header nếu cần chống tạo đơn trùng. Địa chỉ giao hàng được snapshot trên đơn; đơn mới lưu `userId`. Khách dùng `GET /orders/my`; xem đơn của người khác bị từ chối.
