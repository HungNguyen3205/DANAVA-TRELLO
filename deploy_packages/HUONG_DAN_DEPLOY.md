# HƯỚNG DẪN TRIỂN KHAI DỰ ÁN LÊN AZDIGI (CPANEL / DIRECTADMIN / VPS)

Các gói triển khai đã được tạo tự động tại thư mục:
`D:\NamHung\Projects\Code\Trello\deploy_packages\`
1. **frontend_dist.zip** (Gói web giao diện React SPA đã build + kèm sẵn file `.htaccess`)
2. **backend_app.zip** (Gói mã nguồn Laravel đã loại bỏ rác/vendor/.env nặng)

---

### BƯỚC 1: TẠO DATABASE TRÊN AZDIGI
1. Đăng nhập vào cPanel của dịch vụ AZDIGI.
2. Tìm mục **MySQL Databases**:
   - Tạo Database mới, ví dụ: `u123_trello`
   - Tạo User mới, ví dụ: `u123_trellouser` cùng Mật khẩu mạnh.
   - Thêm User vào Database và tích chọn **ALL PRIVILEGES**.

---

### BƯỚC 2: CẤU HÌNH SUBDOMAIN CHO BACKEND LARAVEL
1. Trong cPanel, vào mục **Domains** -> **Create A New Domain** (hoặc **Subdomains**):
   - Nhập tên miền cho API, ví dụ: `api.tenmiencuaban.com`
   - **CỰC KỲ QUAN TRỌNG**: Đặt Document Root trỏ vào thư mục `public` của Laravel:
     `api_backend/public` (thay vì chỉ `api_backend`).
2. Vào **File Manager**, tìm thư mục `api_backend`:
   - Bấm **Upload** và tải file `backend_app.zip` lên.
   - Chuột phải vào `backend_app.zip` -> chọn **Extract** (Giải nén) ngay tại `api_backend`.
   - Tạo một file tên `.env` trong thư mục `api_backend` với nội dung mẫu sau:

```env
APP_NAME="Danava Work"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://api.tenmiencuaban.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u123_trello
DB_USERNAME=u123_trellouser
DB_PASSWORD=dien_mat_khau_database_o_buoc_1

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=public
```

3. Mở mục **Terminal** trong cPanel (hoặc SSH vào server), gõ các lệnh sau:
```bash
cd api_backend
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
```

---

### BƯỚC 3: UPLOAD FRONTEND LÊN HOSTING
1. Vào **File Manager** -> mở thư mục web chính của tên miền frontend (thường là `public_html`).
2. Bấm **Upload** và tải file `frontend_dist.zip` lên.
3. Giải nén (`Extract`) file `frontend_dist.zip` trực tiếp vào `public_html`.
   *(Kiểm tra đảm bảo các file `index.html`, thư mục `assets/` và `.htaccess` nằm ngay trong `public_html`)*.

---

### BƯỚC 4: BẬT SSL MIỄN PHÍ (HTTPS)
1. Trong cPanel, tìm mục **SSL/TLS Status** hoặc **Let's Encrypt SSL**.
2. Chọn tên miền chính và subdomain `api.` rồi bấm **Run AutoSSL** (hoặc Issue Let's Encrypt).
3. Sau khi có SSL, truy cập web để kiểm tra và đăng nhập sử dụng.
