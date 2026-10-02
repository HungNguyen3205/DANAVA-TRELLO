# DANAVA WORK

Ứng dụng phân bổ công việc theo luồng **Đăng nhập → Không gian làm việc → Bảng Kanban → Công việc**.

Dự án được tách thành hai phần độc lập:

| Thư mục | Công nghệ | Trách nhiệm |
| --- | --- | --- |
| `frontend/` | React 19, TypeScript, Vite, React Router | Đăng nhập, danh sách không gian/bảng, Kanban, biểu mẫu |
| `backend/` | PHP 8.3+, Laravel 13, Sanctum | Session đăng nhập, phân quyền, API, transaction, MySQL |
| `docs/` | Tài liệu dự án | Cài đặt, kiến trúc, API và kế hoạch sprint |

**MySQL lưu dữ liệu. Navicat là công cụ kết nối và quản lý MySQL**, không phải dịch vụ lưu trữ riêng. Frontend không chứa thông tin đăng nhập database.

## Chạy dự án trên Windows

Cài PHP 8.3+ (có `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `curl`, `xml`, `dom`), Composer 2, Node.js 22.12+ và MySQL 8. Xem [hướng dẫn Windows + Navicat](docs/SETUP.md) nếu cần cấu hình từng bước.

Trong Navicat, kết nối MySQL và chạy:

```sql
CREATE DATABASE danava_work CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Terminal thứ nhất, tại thư mục dự án:

```powershell
cd backend
Copy-Item .env.example .env
composer install
php artisan key:generate
```

Sửa `backend/.env`: `DB_HOST`, `DB_PORT`, `DB_DATABASE=danava_work`, `DB_USERNAME`, `DB_PASSWORD` theo MySQL của bạn. Sau đó:

```powershell
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

Terminal thứ hai, tại thư mục dự án:

```powershell
npm run setup:frontend
npm run dev
```

Mở **http://localhost:5173**, chọn **Đăng ký**, tạo tài khoản rồi tạo không gian đầu tiên. Không có tài khoản mặc định hoặc dữ liệu giả tự lưu. Giữ cả hai terminal đang chạy. Linux/macOS dùng `cp .env.example .env` thay cho `Copy-Item`.

## Có trong nhánh này

- Đăng ký, đăng nhập, đăng xuất bằng session cookie + CSRF qua Sanctum.
- Trang đầu lấy bố cục từ ảnh tham chiếu: thanh không gian, bảng yêu thích, bảng gần đây, bảng theo từng không gian.
- Tạo/sửa không gian, tạo/đổi tên bảng; mỗi không gian có nhiều bảng riêng.
- Thêm tài khoản đã đăng ký vào không gian; quyền chủ sở hữu, quản trị, chỉnh sửa, chỉ xem.
- Tạo/sửa/xóa công việc, người phụ trách/người phối hợp, ưu tiên, nhãn, hạn, checklist, bình luận.
- Kéo thả cột/thẻ, thêm/sửa/xóa cột trống, đánh dấu cột hoàn thành; Kanban và danh sách; tìm kiếm/bộ lọc.
- Yêu thích và gần đây lưu theo từng tài khoản; giao diện sáng/tối, bố cục mobile.
- Dữ liệu quan hệ trong MySQL, kiểm tra quyền phía server, chống sửa chéo bảng và phiên bản chống ghi đè.
- Tự tải lại bảng mỗi 30 giây khi tab đang mở; chưa có WebSocket realtime.

Các phần chưa làm như email mời, quên mật khẩu, tệp đính kèm, lịch, thông báo, lưu trữ bảng và sprint nghiệp vụ có backlog cụ thể trong [kế hoạch sprint](docs/SPRINTS.md). Đây là nền tảng MVP để phát triển tiếp, không tuyên bố đã hoàn thiện toàn bộ tính năng Trello.

## Kiểm thử

```powershell
npm run build
npm run lint
npm test
cd backend
php artisan test
```

Frontend kiểm thử DOM các luồng chính và quy tắc kéo thả. Backend mặc định chạy PHPUnit bằng SQLite in-memory; cần bật `pdo_sqlite`. Có cấu hình chạy cùng bộ kiểm thử trên MySQL test riêng trong [SETUP.md](docs/SETUP.md). Không chạy test vào database đang sử dụng.

## Tài liệu

- [Cài đặt, Navicat và xử lý lỗi](docs/SETUP.md)
- [Kiến trúc, dữ liệu, quyền và API](docs/ARCHITECTURE.md)
- [Sprint nhỏ: frontend, backend và tiêu chí nghiệm thu](docs/SPRINTS.md)

Nhánh này thay lớp lưu Supabase trước đây bằng Laravel/MySQL. Dữ liệu Supabase cũ **chưa được tự động nhập** vào MySQL; cần làm bước chuyển đổi riêng nếu đã có dữ liệu thực tế. Nhánh cũ vẫn được giữ để đối chiếu.
