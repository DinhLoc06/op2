# Lab 3

- `backend/`: REST API NestJS, PostgreSQL/Neon, cấu hình chạy trên Wispbyte.
- `frontend/`: ứng dụng cửa hàng React + Vite, kèm màn hình quản trị theo vai trò.

## Backend

```powershell
cd backend
npm install
npm run build
npm run start:prod
```

File `backend/.env` chứa cấu hình cục bộ và không được Git theo dõi. Dùng `backend/.env.example` làm mẫu khi khai báo biến môi trường trên Wispbyte.

## Frontend

```sh
cd frontend
npm install
npm run dev
```

Frontend gọi API theo `VITE_API_URL`. Cấu hình local hiện tại trỏ tới `http://127.0.0.1:16361` (backend port trong `backend/.env`). Cấu hình `FRONTEND_ORIGIN` ở backend để cho phép origin frontend.
