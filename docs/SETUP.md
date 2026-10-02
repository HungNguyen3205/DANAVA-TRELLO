# Cài đặt trên Windows và MySQL/Navicat

## 1. Chuẩn bị

- PHP 8.3 trở lên, Composer 2; PHP CLI và PHP web phải dùng cùng phiên bản/extension.
- Node.js 22.12 trở lên, npm.
- MySQL 8 đang chạy. Navicat chỉ là ứng dụng quản trị, vẫn cần cài MySQL Server.
- Kiểm tra `php -v`, `php --ini`, `php -m`, `composer --version`, `node -v`.
- PHP cần: PDO, pdo_mysql, mbstring, openssl, tokenizer, ctype, fileinfo, curl, xml, dom. Test SQLite cần pdo_sqlite; Composer giải nén nhanh hơn khi có zip.

Lấy nhánh mới trong repo đã clone:

```powershell
git fetch origin
git switch --track origin/feat/laravel-mysql-workspaces
```

Nếu nhánh đã có trên máy, dùng `git switch feat/laravel-mysql-workspaces` rồi `git pull`. Lưu/commit thay đổi cá nhân trước khi chuyển nhánh; không cần xóa dự án cũ.

## 2. Tạo database qua Navicat

1. New Connection → MySQL. Host `127.0.0.1`, port mặc định `3306`, tài khoản MySQL trên máy.
2. Test Connection. Nếu lỗi, kiểm tra MySQL Server đã chạy và đúng mật khẩu.
3. New Query, chạy:

```sql
CREATE DATABASE danava_work CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Có thể dùng New Database của Navicat với cùng charset/collation. Laravel migration sẽ tạo các bảng, không cần nhập SQL schema thủ công.

## 3. Backend

```powershell
cd D:\NamHung\Projects\Code\Trello\backend
Copy-Item .env.example .env
composer install
php artisan key:generate
```

Chỉnh `.env` bằng thông tin MySQL đã Test Connection thành công:

```dotenv
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=danava_work
DB_USERNAME=root
DB_PASSWORD="mat_khau_mysql_cua_ban"
SESSION_DRIVER=database
SESSION_DOMAIN=null
SANCTUM_STATEFUL_DOMAINS=localhost:5173,localhost:8000,127.0.0.1:5173,127.0.0.1:8000
```

Không commit `.env`. Tài khoản MySQL chỉ nằm ở backend. `root` phù hợp môi trường local; khi triển khai dùng tài khoản riêng có quyền đúng database.

```powershell
php artisan config:clear
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8000
```

`http://localhost:8000/` trả JSON tên API. `migrate` là lệnh bình thường; không dùng `migrate:fresh` trên dữ liệu thật vì sẽ xóa bảng.

## 4. Frontend

Mở terminal khác:

```powershell
cd D:\NamHung\Projects\Code\Trello
npm run setup:frontend
npm run dev
```

Truy cập `http://localhost:5173`. Vite proxy `/api` và `/sanctum` sang backend, nên mặc định **không cần** tạo `.env` frontend. Nếu đổi cổng API, copy `frontend/.env.example` thành `frontend/.env`, sửa `API_PROXY_TARGET`, rồi khởi động lại Vite. Để `VITE_API_BASE_URL` rỗng khi dùng proxy.

Sử dụng cùng hostname xuyên suốt phiên; đừng đăng nhập tại `localhost` rồi chuyển sang `127.0.0.1`.

## 5. Thử luồng thực tế

1. Đăng ký tài khoản A → tạo không gian → tạo hai bảng.
2. Trong bảng, thêm công việc với người phụ trách, nhãn, checklist và bình luận; lưu.
3. Tải lại trang và đăng xuất/đăng nhập: dữ liệu phải còn.
4. Qua Navicat, refresh Tables: xem `workspaces`, `boards`, `tasks`, `checklist_items`, `task_comments`.
5. Trong cửa sổ riêng, đăng ký tài khoản B. A thêm email B vào Thành viên của không gian.
6. Thử B ở quyền chỉ xem, sau đó quyền chỉnh sửa; B không được nhìn thấy không gian khác chưa được thêm.
7. Mở cùng bảng trong hai tab, mở hai bản nháp rồi lưu tab 1. Lưu tab 2 phải báo xung đột, không ghi đè. Sao chép nội dung muốn giữ trước khi chọn đóng bản nháp/tải lại.

Không chỉnh trực tiếp dữ liệu nghiệp vụ bằng Navicat khi người dùng đang sửa bảng: chỉnh tay không cập nhật version/log như API. Dùng Navicat để kiểm tra, backup và khôi phục có kế hoạch.

## 6. Kiểm thử tự động

Frontend tại gốc: `npm test`, `npm run lint`, `npm run build`.
Backend tại `backend/`: `php artisan test` (SQLite in-memory, không dùng dữ liệu local).

Muốn chạy MySQL, tạo **database riêng dùng để test** `danava_work_test` rồi từ thư mục backend:

```powershell
$env:DB_CONNECTION="mysql"
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_DATABASE="danava_work_test"
$env:DB_USERNAME="root"
$env:DB_PASSWORD="mat_khau_mysql_cua_ban"
php artisan config:clear
php vendor/bin/phpunit
```

`RefreshDatabase` sẽ xóa/tạo lại bảng trong database test. Sau khi test, đóng terminal đó để các biến môi trường test không ảnh hưởng việc chạy ứng dụng. Có thêm GitHub Actions kiểm thử MySQL 8 khi nhánh được push (nếu repository bật Actions).

Kiểm tra trong môi trường thực hiện nhánh: build/lint frontend, 4 bài kiểm thử UI DOM, 11 kiểm tra kéo thả và 9 bài PHPUnit/86 assertions bằng SQLite đã đạt. Môi trường chặn socket nên chưa chạy được MySQL server hoặc Chrome để xác nhận trực quan; kết quả MySQL/kiểm tra desktop-mobile cần xác nhận ở CI hoặc máy local.

## 7. Các lỗi thường gặp

| Lỗi | Cách xử lý |
| --- | --- |
| Không tìm được thư viện React/Vite | Chạy `npm run setup:frontend` tại gốc; dependency nằm trong `frontend/node_modules` |
| `php`/`composer` không được nhận diện | Cài runtime và thêm PATH, mở lại terminal |
| `could not find driver` | Bật `pdo_mysql` hoặc `pdo_sqlite` cho PHP CLI đang dùng |
| `Access denied`/`Connection refused` | Kiểm tra MySQL Server, port và DB_USERNAME/DB_PASSWORD bằng Navicat |
| `No application encryption key` | `php artisan key:generate`, `php artisan config:clear` |
| `Base table ... sessions ... not found` | Chạy `php artisan migrate` đúng database |
| 419/CSRF | Dùng một hostname, chạy cả API và Vite, xóa cookie cũ rồi đăng nhập lại; kiểm tra SANCTUM_STATEFUL_DOMAINS |
| 401 | Phiên hết hạn, đăng nhập lại |
| 403/404 khi mở bảng | Tài khoản thiếu quyền hoặc đã bị gỡ khỏi không gian |
| 409 khi lưu | Có thay đổi mới; giữ nội dung cần thiết rồi tải lại bảng để sửa trên phiên bản mới |
| `No such file ... image(...).png` trong ChatGPT | Tệp ảnh tham chiếu đã mất ở thư mục tạm; gửi lại ảnh. Lỗi này không phải lỗi MySQL hay Laravel |

## 8. Triển khai sau này

Build frontend bằng `npm run build`, phục vụ `frontend/dist` cùng domain với API; reverse proxy `/api`, `/sanctum` đến Laravel, còn các route frontend fallback `index.html`. Document root Laravel phải là `backend/public`. Không public cả repo/vendor/.env.

Thiết lập `APP_ENV=production`, `APP_DEBUG=false`, HTTPS, `SESSION_SECURE_COOKIE=true`, APP_URL và SANCTUM_STATEFUL_DOMAINS đúng domain, secret APP_KEY riêng. Chạy `composer install --no-dev --optimize-autoloader`, `php artisan migrate --force`, `php artisan config:cache`. Backup MySQL trước migration. Cấu hình deploy cụ thể/SMTP/reset mật khẩu/monitoring là phần sprint sau.
