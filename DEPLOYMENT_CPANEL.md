# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG DANAVA-TRELLO LÊN CPANEL
**Tài liệu chuẩn hóa quy trình Deploy & Rollback an toàn cho Production**

---

## 1. YÊU CẦU MÔI TRƯỜNG TRÊN CPANEL

Trước khi triển khai, hãy đảm bảo tài khoản cPanel đáp ứng các thông số kỹ thuật sau:
- **PHP**: Phiên bản **8.2** hoặc **8.3** (Thiết lập tại cPanel -> *Select PHP Version*).
- **PHP Extensions bắt buộc**:
  - `pdo_mysql`, `mysqli`
  - `mbstring`, `fileinfo`, `ctype`, `json`, `xml`, `tokenizer`
  - `curl`, `zip`, `bcmath`, `intl`, `gd` (hoặc `imagick`)
- **Bộ nhớ PHP**: `memory_limit >= 256M` (khuyến nghị 512M khi chạy export/import Excel lớn).
- **Web Server**: Apache hoặc Nginx/LiteSpeed hỗ trợ `.htaccess` mod_rewrite.
- **Node.js**: Phiên bản 20.x LTS (nếu build frontend trực tiếp trên server qua SSH hoặc cPanel Setup Node.js App).
- **Quyền SSH Terminal**: Kích hoạt quyền SSH trong cPanel để thực thi lệnh Artisan & Composer.

---

## 2. KIẾN TRÚC THƯ MỤC TRÊN CPANEL

Để đảm bảo an toàn bảo mật tuyệt đối, **mã nguồn Backend và file `.env` tuyệt đối không được đặt trong `public_html`**.

```text
/home/username/
├── backups/                         # Nơi lưu trữ file sao lưu DB và mã nguồn
├── danava-trello/                   # Thư mục gốc dự án (nằm ngoài public_html)
│   ├── backend/                     # Laravel 11 Application
│   │   ├── .env                     # File cấu hình Production (bảo mật)
│   │   ├── app/
│   │   ├── database/
│   │   ├── storage/                 # Chmod 775
│   │   └── bootstrap/cache/         # Chmod 775
│   └── frontend/                    # Source React / Vite
│       └── dist/                    # Bundle production sau khi build
│
└── public_html/                     # Web Root công khai (hoặc subdomain app.danava.vn)
    ├── index.html                   # Entry point Frontend React
    ├── assets/                      # JS, CSS, Font bundles
    ├── api/                         # Symlink tới backend/public hoặc cấu hình VirtualHost
    ├── storage -> ../danava-trello/backend/storage/app/public
    └── .htaccess                    # Cấu hình rewrite HTML5 routing
```

---

## 3. QUY TRÌNH DEPLOY CHI TIẾT (STEP-BY-STEP)

Thực hiện theo đúng thứ tự 9 bước sau qua giao diện dòng lệnh SSH:

### BƯỚC 1: Bật chế độ bảo trì (Maintenance Mode)
Tránh xung đột dữ liệu khi người dùng thao tác trong quá trình migration:
```bash
cd /home/username/danava-trello/backend
php artisan down --render="errors::503" --secret="danava-deploy-bypass-token"
```
*(Bạn có thể truy cập kiểm tra qua URL `https://your-domain.com/danava-deploy-bypass-token`)*.

---

### BƯỚC 2: Sao lưu cơ sở dữ liệu và mã nguồn (MANDATORY BACKUP)
Luôn sao lưu trước bất kỳ thay đổi nào để sẵn sàng rollback nếu gặp sự cố.

```bash
# Tạo thư mục chứa backup nếu chưa có
mkdir -p /home/username/backups

# Lưu lại commit SHA hiện tại trước khi pull
PREV_COMMIT=$(git rev-parse HEAD)
echo "Commit truoc khi deploy: $PREV_COMMIT" > /home/username/backups/last_deployed_commit.txt

# 1. Backup Database MySQL
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mysqldump -u <DB_USERNAME> -p'<DB_PASSWORD>' <DB_NAME> > /home/username/backups/danava_db_${TIMESTAMP}.sql
gzip /home/username/backups/danava_db_${TIMESTAMP}.sql

# 2. Backup thư mục Frontend hiện hành
cp -r /home/username/public_html /home/username/backups/public_html_${TIMESTAMP}
```

---

### BƯỚC 3: Cập nhật mã nguồn từ Git (Git Pull)
Lấy phiên bản code mới nhất đã qua kiểm thử CI/Actions:

```bash
cd /home/username/danava-trello
git fetch origin main
git pull origin main
```
*Ghi nhận Commit SHA mới bằng lệnh: `git rev-parse HEAD`.*

---

### BƯỚC 4: Cài đặt và tối ưu hóa Composer Dependencies
Chỉ cài đặt package production, tối ưu hóa autoloading classmap:

```bash
cd /home/username/danava-trello/backend
composer install --no-dev --optimize-autoloader --no-interaction
```

---

### BƯỚC 5: Thực thi Database Migration
Áp dụng các migration mới vào cơ sở dữ liệu production:

```bash
cd /home/username/danava-trello/backend
php artisan migrate --force
```

Kiểm tra trạng thái migration để đảm bảo không có migration nào bị sót:
```bash
php artisan migrate:status
```

---

### BƯỚC 6: Xóa và tái tạo toàn bộ Cache hệ thống
Làm mới toàn bộ config, route, view và event cache:

```bash
cd /home/username/danava-trello/backend

# Xóa toàn bộ cache cũ
php artisan optimize:clear

# Tái tạo cache mới cho môi trường production
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

---

### BƯỚC 7: Xây dựng và Đồng bộ Frontend (Build / Copy)

#### Cách 1: Build trực tiếp trên server (Nếu server có cài Node.js 20+)
```bash
cd /home/username/danava-trello/frontend
npm ci
npm run build

# Sao chép bản build vào web root
rsync -av --delete dist/ /home/username/public_html/
```

#### Cách 2: Upload bản build từ Local / CI (Khuyến nghị cho Hosting cPanel giới hạn tài nguyên)
1. Chạy trên máy dev / CI pipeline:
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
2. Nén thư mục `frontend/dist` thành `dist.zip`.
3. Upload `dist.zip` lên cPanel qua File Manager hoặc SCP/SFTP vào `/home/username/public_html/`.
4. Giải nén đè vào `public_html/`.

#### Cấu hình `.htaccess` cho Frontend SPA (tại `public_html/.htaccess`):
Đảm bảo file `.htaccess` trong `public_html` có nội dung sau để hỗ trợ React Router:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Đảm bảo request tới /api được chuyển tiếp tới Laravel backend
  RewriteRule ^api/(.*)$ ../danava-trello/backend/public/index.php [L,QSA]
  
  # Frontend SPA fallback
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

### BƯỚC 8: Phân quyền Thư mục (File Permissions)
Đảm bảo tiến trình web server có quyền ghi vào `storage` và `bootstrap/cache`:

```bash
cd /home/username/danava-trello/backend
chmod -R 775 storage bootstrap/cache
php artisan storage:link
```

---

### BƯỚC 9: Tắt chế độ bảo trì và Kiểm tra (Smoke Test)
Mở lại website cho người dùng:

```bash
cd /home/username/danava-trello/backend
php artisan up
```

#### Checklist Smoke Test sau khi mở hệ thống:
1. Truy cập trang chủ đăng nhập: hiển thị đúng giao diện, không bị lỗi 404/500.
2. Đăng nhập với tài khoản nhân viên / admin: nhận token thành công.
3. Mở Bảng Kanban trực tiếp: hiển thị đúng các cột và danh sách task.
4. Kiểm tra kéo thả công việc (Drag & drop task): lưu vị trí và fractional order thành công.
5. Kiểm tra tính năng Xuất/Nhập Excel: tải file mẫu template không lỗi.
6. Kiểm tra Thùng rác (Trash): danh sách tải nhanh, khôi phục bình thường.

---

## 4. QUY TRÌNH ROLLBACK KHẨN CẤP (ROLLBACK PROCEDURE)

Nếu xảy ra sự cố nghiêm trọng sau khi deploy (lỗi trắng trang, crash database, 500 server error), hãy thực hiện ngay quy trình khôi phục sau:

### Bước R1: Đưa hệ thống về chế độ bảo trì
```bash
cd /home/username/danava-trello/backend
php artisan down
```

### Bước R2: Rollback mã nguồn về Commit trước đó
```bash
cd /home/username/danava-trello

# Lấy commit SHA trước đó từ file đã ghi nhận ở Bước 2
PREV_COMMIT=$(cat /home/username/backups/last_deployed_commit.txt)
git checkout $PREV_COMMIT
```

### Bước R3: Rollback Cơ sở Dữ liệu
Sử dụng file backup database đã sao lưu ở Bước 2:
```bash
gunzip -c /home/username/backups/danava_db_${TIMESTAMP}.sql.gz | mysql -u <DB_USERNAME> -p'<DB_PASSWORD>' <DB_NAME>
```

### Bước R4: Rollback Frontend
Khôi phục thư mục `public_html` từ bản sao lưu:
```bash
rm -rf /home/username/public_html/*
cp -r /home/username/backups/public_html_${TIMESTAMP}/* /home/username/public_html/
```

### Bước R5: Xóa và tái tạo Cache
```bash
cd /home/username/danava-trello/backend
composer install --no-dev --optimize-autoloader
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Bước R6: Mở lại hệ thống
```bash
cd /home/username/danava-trello/backend
php artisan up
```

---

## 5. THIẾT LẬP CRON JOB CPANEL (SCHEDULER & QUEUE)

Trong cPanel -> mục **Cron Jobs**, thêm cron định kỳ mỗi phút để chạy Laravel Scheduler (dọn dẹp thùng rác sau 30 ngày, gửi nhắc nhở deadline):

```bash
* * * * * cd /home/username/danava-trello/backend && /usr/local/bin/php artisan schedule:run >> /dev/null 2>&1
```
*(Thay thế `/usr/local/bin/php` bằng đường dẫn PHP 8.2 trên cPanel của bạn, ví dụ `/usr/local/bin/ea-php82`)*.
