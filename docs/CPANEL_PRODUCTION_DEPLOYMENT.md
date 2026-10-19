# HƯỚNG DẪN TRIỂN KHAI VÀ DEPLOY PRODUCTION TRÊN CPANEL
**Dự án:** DANAVA WORK  
**Domain:** `workspace.danava.com.vn`  
**Môi trường:** PHP 8.2 | MySQL 8 | Laravel 12 | React 19 / Vite 8 | Node.js 22

---

## 1. Các bước chuẩn bị trước khi Deploy (Pre-deployment)

1. **Ghi lại commit SHA hiện tại đang chạy ổn định:**
   ```bash
   git rev-parse HEAD > /home/user/danava_work_last_stable_commit.txt
   ```
2. **Sao lưu Database MySQL production:**
   ```bash
   mysqldump -u danava_db_user -p danava_work_prod > /home/user/backups/db_backup_$(date +%Y%m%d_%H%M%S).sql
   ```
3. **Sao lưu file môi trường `.env` và thư mục upload:**
   ```bash
   cp /path/to/backend/.env /home/user/backups/.env_backup_$(date +%Y%m%d_%H%M%S)
   cp -r /path/to/backend/storage/app/public /home/user/backups/storage_public_$(date +%Y%m%d_%H%M%S)
   ```
4. **Kiểm tra yêu cầu hệ thống server cPanel:**
   * **PHP Version:** `8.2.x` (Kiểm tra trong *cPanel -> Select PHP Version* hoặc lệnh `php -v`).
   * **PHP Extensions:** `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `gd`, `zip`, `intl`, `curl`.
   * **Composer:** Phiên bản 2.x (`composer --version`).
   * **Dung lượng ổ đĩa:** Đảm bảo trống tối thiểu 5GB (`df -h`).
5. **Bật chế độ bảo trì hệ thống (Maintenance Mode):**
   ```bash
   php artisan down --render="errors::503" --secret="danava-deploy-bypass-token"
   ```

---

## 2. Quy trình Deploy Backend (Laravel 12)

Thực hiện tuần tự trong thư mục `backend/`:

```bash
# 1. Cài đặt các gói phụ thuộc PHP (chỉ cài production dependencies, tối ưu autoload)
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction

# 2. Chạy migration an toàn (Database transaction)
php artisan migrate --force

# 3. Tạo symlink cho thư mục lưu trữ file (storage -> public)
php artisan storage:link

# 4. Xóa cache cũ và build cache cấu hình, route, view
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 5. Khởi động lại Queue worker
php artisan queue:restart
```

---

## 3. Quy trình Deploy Frontend (React 19 / Vite 8)

### Trường hợp A: Server cPanel có Node.js >= 22
Thực hiện trong thư mục `frontend/`:
```bash
npm ci
npm run lint
npm run test
npm run build
```
Toàn bộ file build tĩnh trong `frontend/dist/` sẽ được dùng để phục vụ người dùng.

### Trường hợp B: Server cPanel không có Node.js 22 (Khuyến nghị chuẩn CI/CD)
1. Tận dụng **GitHub Actions CI Pipeline** (chạy trên Node 22).
2. Tải artifact `dist.zip` đã được build và test pass từ commit đã merge vào `main`.
3. Giải nén vào thư mục web root của subdomain `workspace.danava.com.vn`.

---

## 4. Cấu hình Queue Worker và Cron Scheduler trên cPanel

Do hệ thống sử dụng Queue cho tác vụ nền (Gửi thông báo Telegram, Dispatch Email, Quét Task đến hạn):

### A. Scheduler (Cron Job mỗi phút)
Thêm vào **cPanel -> Cron Jobs**:
```cron
* * * * * cd /home/username/public_html && php artisan schedule:run >> /dev/null 2>&1
```

### B. Queue Worker (Chạy nền xử lý việc)
Nếu cPanel không có tiện ích Supervisor Daemon, cấu hình cron chạy worker theo chu kỳ 1 phút với cờ `--stop-when-empty`:
```cron
* * * * * cd /home/username/public_html && php artisan queue:work database --stop-when-empty --tries=3 --timeout=120 >> /dev/null 2>&1
```

*Lưu ý:* Sau mỗi lần deploy code mới, lệnh `php artisan queue:restart` sẽ ra tín hiệu cho các worker tự tải lại code mới an toàn.

---

## 5. Cấu hình `.htaccess` (SPA Rewrite & Security)

File `.htaccess` đặt tại thư mục web root công khai (phục vụ `workspace.danava.com.vn`):

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # 1. Bảo vệ các tệp nhạy cảm (không cho phép truy cập trực tiếp từ web)
    RewriteRule ^(\.env|\.git|composer\.(json|lock)|package(-lock)?\.json|phpunit\.xml) - [F,L,NC]
    RewriteRule ^storage/logs/.*$ - [F,L,NC]

    # 2. Định tuyến API đến Laravel Backend
    RewriteRule ^api/(.*)$ backend/public/index.php [L,QSA]

    # 3. Định tuyến file storage công khai
    RewriteRule ^storage/(.*)$ backend/public/storage/$1 [L]

    # 4. Phục vụ tài nguyên tĩnh của Frontend (JS, CSS, hình ảnh, icon)
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]

    # 5. SPA Fallback: Mọi route client ({public_id}/kanban, /login, /me/dashboard) trở về index.html
    RewriteRule ^ index.html [L]
</IfModule>

# Cấu hình bảo mật HTTP Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
    Header set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

---

## 6. Đưa hệ thống Online trở lại (Post-deployment)

```bash
php artisan up
```

Kiểm tra:
* Mở trình duyệt ẩn danh truy cập `https://workspace.danava.com.vn`.
* Đăng nhập tài khoản System Admin và tài khoản nhân viên.
* Kiểm tra tải trang Kanban, websocket/polling, tải file và thông báo.

---

## 7. Quy trình Rollback khẩn cấp (Emergency Rollback Plan)

Khi phát hiện sự cố nghiêm trọng sau release:

1. **Bật chế độ bảo trì ngay lập tức:**
   ```bash
   php artisan down --secret="danava-emergency-key"
   ```
2. **Khôi phục Code về Commit SHA ổn định đã ghi lại:**
   ```bash
   git checkout <COMMIT_SHA_TRƯỚC_ĐÓ>
   ```
3. **Khôi phục Frontend:**
   * Giải nén lại thư mục `dist` của commit cũ.
4. **Khôi phục Database (Nếu migration mới bị lỗi hoặc làm hỏng dữ liệu):**
   ```bash
   mysql -u danava_db_user -p danava_work_prod < /home/user/backups/db_backup_YYYYMMDD_HHMMSS.sql
   ```
   *LƯU Ý:* Chỉ chạy `php artisan migrate:rollback` nếu migration đó là migration độc lập không có rủi ro mất dữ liệu mới của người dùng trong khoảng thời gian vừa release.
5. **Xóa và tái tạo cache:**
   ```bash
   php artisan optimize:clear
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   php artisan queue:restart
   ```
6. **Mở lại ứng dụng:**
   ```bash
   php artisan up
   ```
