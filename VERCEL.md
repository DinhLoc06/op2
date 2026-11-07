# Deploy lên Vercel

Repo gồm hai project trong cùng monorepo. Import repo `DinhLoc06/op2` hai lần trên Vercel, mỗi lần chọn root directory tương ứng:

| Project | Root Directory | Framework |
| --- | --- | --- |
| API | `backend` | NestJS |
| Storefront | `frontend` | Vite |

## 1. Deploy API

Tạo project Vercel từ repo, đặt Root Directory là `backend`, rồi thêm các biến môi trường Production:

- `DATABASE_URL`: Neon connection string.
- `DB_SYNCHRONIZE`: `false`.
- `JWT_SECRET`: chuỗi ngẫu nhiên dài tối thiểu 32 ký tự.
- `FRONTEND_ORIGIN`: domain production storefront, ví dụ `https://<frontend-project>.vercel.app`.

`backend/vercel.json` đặt Function region ở Singapore (`sin1`) gần Neon.

## 2. Deploy storefront

Tạo project thứ hai từ cùng repo, đặt Root Directory là `frontend`. Đặt biến môi trường Production:

- `VITE_API_URL`: URL API project, ví dụ `https://<api-project>.vercel.app`.

Deploy frontend sau khi API đã có URL. Sau đó cập nhật `FRONTEND_ORIGIN` trên API nếu cần và redeploy API.

Schema và dữ liệu mẫu trong Neon đã được khởi tạo. Vercel hỗ trợ các app NestJS qua Functions; trong monorepo, mỗi thư mục app được cấu hình thành một project riêng.
