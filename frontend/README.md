# Nexo storefront

Frontend React + Vite cho cửa hàng đa danh mục và bảng quản trị của Lab 3. Giao diện lấy danh mục và sản phẩm trực tiếp từ API, phù hợp dữ liệu Điện tử, Phụ kiện, Gia dụng, Thời trang và Sách.

## Chạy local

```sh
npm install
npm run dev
```

Backend local trong workspace đang chạy ở cổng `16361`; sao chép `.env.example` thành `.env.local` để frontend gọi đúng API. Nếu backend dùng địa chỉ khác, cập nhật URL trong file đó:

```env
VITE_API_URL=http://127.0.0.1:16361
```

Đặt `FRONTEND_ORIGIN` ở backend thành origin frontend (ví dụ `http://localhost:5173`) để bật CORS. Khi triển khai, dùng URL backend Wispbyte trong `VITE_API_URL` và thêm origin frontend vào `FRONTEND_ORIGIN`.

## Tính năng

- Cửa hàng responsive, tìm kiếm và lọc danh mục, giỏ hàng lưu trên trình duyệt, địa chỉ giao hàng, mã ưu đãi, đặt đơn và thanh toán.
- Đăng ký, đăng nhập, tự làm mới access token và quản lý thông tin tài khoản.
- Khu vực STAFF/ADMIN cho thống kê, sản phẩm, tồn kho, đơn hàng và mã ưu đãi; ADMIN có thêm quản lý vai trò/trạng thái người dùng và nhật ký hoạt động.

Tài khoản mới được cấp vai trò `CUSTOMER`. Dùng quy trình khởi tạo ADMIN trong `backend/README.md` để bật các màn quản trị.
