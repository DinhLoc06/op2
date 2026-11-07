# Deploy lên Render

Project có Blueprint tại `render.yaml`, gồm API NestJS và storefront React/Vite. Cả hai được đặt ở Singapore; API dùng Neon PostgreSQL hiện có.

1. Đưa thư mục project lên một Git repository và kết nối repository đó với Render.
2. Trong Render, tạo **New > Blueprint** và chọn repository này.
3. Khi Render hỏi giá trị `DATABASE_URL`, nhập connection string Neon. Render tự tạo `JWT_SECRET`.
4. Kiểm tra hai dịch vụ `lab3-api` và `lab3-storefront`, sau đó áp dụng Blueprint để deploy.

Schema Neon đã được khởi tạo và có dữ liệu mẫu. Nếu cần thêm lại danh mục và sản phẩm, chạy từ thư mục `backend` sau khi build:

```sh
npm run build
npm run db:seed
```

Seeder bỏ qua tên sản phẩm đã tồn tại. Không bật `DB_SYNCHRONIZE` trên Render; schema được khởi tạo trước deploy.
