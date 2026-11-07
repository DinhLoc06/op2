# Triển khai backend trên Wispbyte

1. Tạo server với image Node.js.
2. Upload **nội dung bên trong thư mục `backend`** vào thư mục gốc của server.
3. Trong trang **Startup**, đặt lệnh khởi động:

   ```sh
   npm install --omit=dev && npm run start:prod
   ```

   Nếu panel yêu cầu **Main File**, chọn `server.js` ở thư mục gốc.

4. Khai báo các biến trong **Startup > Environment variables** (không upload `.env` công khai):

   - `PORT`: cổng Wispbyte cấp cho web server (ví dụ `13924`).
   - `FRONTEND_ORIGIN`: origin frontend, hiện là `https://os.dak.edu.vn`.
   - `DATABASE_URL`: chuỗi kết nối Neon.
   - `DB_SYNCHRONIZE`: đặt `false` khi database đã có bảng/dữ liệu.
   - `JWT_SECRET`: chuỗi bí mật ngẫu nhiên, tối thiểu 32 ký tự.

5. Start hoặc Restart trong **Console**, rồi kiểm tra URL Wispbyte cấp. Route `/` phải trả về `Hello World!`.

Ứng dụng lắng nghe trên `0.0.0.0` và ưu tiên biến `PORT`, phù hợp với container Wispbyte.
