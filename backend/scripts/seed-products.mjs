import { DataSource } from 'typeorm';
import { Address } from '../dist/addresses/entities/address.entity.js';
import { AuditLog } from '../dist/audit-logs/entities/audit-log.entity.js';
import { RefreshToken } from '../dist/auth/entities/refresh-token.entity.js';
import { Category } from '../dist/categories/entities/category.entity.js';
import { Coupon } from '../dist/coupons/entities/coupon.entity.js';
import { CouponUsage } from '../dist/coupons/entities/coupon-usage.entity.js';
import { IdempotencyKey } from '../dist/orders/entities/idempotency-key.entity.js';
import { OrderItem } from '../dist/orders/entities/order-item.entity.js';
import { OrderStatusHistory } from '../dist/orders/entities/order-status-history.entity.js';
import { Order } from '../dist/orders/entities/order.entity.js';
import { Payment } from '../dist/orders/entities/payment.entity.js';
import { Product } from '../dist/products/entities/product.entity.js';
import { User } from '../dist/users/entities/user.entity.js';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  entities: [Address, AuditLog, RefreshToken, Category, Coupon, CouponUsage, IdempotencyKey, OrderItem, OrderStatusHistory, Order, Payment, Product, User],
  synchronize: false,
});

const categories = [
  { name: 'Điện tử', description: 'Thiết bị điện tử cho công việc và giải trí.' },
  { name: 'Phụ kiện', description: 'Phụ kiện tiện ích cho góc làm việc và thiết bị cá nhân.' },
  { name: 'Gia dụng', description: 'Đồ dùng nhỏ gọn cho gia đình và văn phòng.' },
  { name: 'Thời trang', description: 'Trang phục và phụ kiện vải dùng hằng ngày.' },
  { name: 'Sách', description: 'Sách và sổ ghi chép dành cho học tập, sáng tạo.' },
];

const products = [
  { name: 'Loa Bluetooth mini', price: 690000, description: 'Loa Bluetooth nhỏ gọn, kết nối không dây, phù hợp bàn làm việc và phòng cá nhân.', category: 'Điện tử', quantity: 14 },
  { name: 'Webcam HD 1080p', price: 520000, description: 'Webcam Full HD với micro tích hợp cho họp trực tuyến và học tập.', category: 'Điện tử', quantity: 12 },
  { name: 'Tai nghe không dây', price: 790000, description: 'Tai nghe Bluetooth nhẹ, âm thanh rõ và hộp sạc nhỏ gọn.', category: 'Điện tử', quantity: 10 },
  { name: 'Lót chuột bàn phím cỡ lớn', price: 89000, description: 'Bề mặt vải mịn, đế chống trượt, vừa vặn cho bàn phím và chuột.', category: 'Phụ kiện', quantity: 30 },
  { name: 'Cáp sạc USB-C 1 m', price: 125000, description: 'Cáp sạc USB-C bọc dù, hỗ trợ sạc nhanh cho thiết bị tương thích.', category: 'Phụ kiện', quantity: 25 },
  { name: 'Giá đỡ điện thoại gấp gọn', price: 159000, description: 'Giá đỡ nhôm điều chỉnh góc nhìn, tiện dụng khi học tập và gọi video.', category: 'Phụ kiện', quantity: 16 },
  { name: 'Máy xay sinh tố mini', price: 390000, description: 'Máy xay cá nhân nhỏ gọn, tiện pha sinh tố tại nhà hoặc văn phòng.', category: 'Gia dụng', quantity: 8 },
  { name: 'Đèn bàn LED điều chỉnh độ sáng', price: 275000, description: 'Đèn bàn LED tiết kiệm điện với ba mức sáng cho học tập và làm việc.', category: 'Gia dụng', quantity: 11 },
  { name: 'Áo thun basic unisex', price: 189000, description: 'Áo thun cổ tròn phom cơ bản, chất cotton thoáng, dễ phối đồ.', category: 'Thời trang', quantity: 20 },
  { name: 'Túi tote canvas', price: 129000, description: 'Túi canvas quai chắc chắn, phù hợp đi học và mua sắm hằng ngày.', category: 'Thời trang', quantity: 18 },
  { name: 'Clean Code — Mã sạch', price: 320000, description: 'Sách tham khảo về cách viết mã dễ đọc, dễ bảo trì và có cấu trúc tốt.', category: 'Sách', quantity: 6 },
  { name: 'Sổ tay lập trình', price: 85000, description: 'Sổ ghi chú khổ A5 dành cho ý tưởng, sơ đồ và ghi chép kỹ thuật.', category: 'Sách', quantity: 20 },
];

await dataSource.initialize();
try {
  const categoryRepo = dataSource.getRepository(Category);
  const productRepo = dataSource.getRepository(Product);
  const categoryIds = new Map();
  for (const category of categories) {
    let record = await categoryRepo.findOneBy({ name: category.name });
    if (!record) record = await categoryRepo.save(categoryRepo.create(category));
    categoryIds.set(category.name, record.id);
  }

  let added = 0;
  let skipped = 0;
  for (const product of products) {
    const exists = await productRepo.createQueryBuilder('product')
      .where('LOWER(product.name) = LOWER(:name)', { name: product.name })
      .getOne();
    if (exists) { skipped += 1; continue; }
    await productRepo.save(productRepo.create({ ...product, categoryId: categoryIds.get(product.category) }));
    added += 1;
  }
  console.log(JSON.stringify({ categories: categoryIds.size, productsAdded: added, productsSkipped: skipped }));
} finally {
  await dataSource.destroy();
}
