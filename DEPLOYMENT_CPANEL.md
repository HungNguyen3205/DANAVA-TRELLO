# 1) Sao lưu database (tự đọc tài khoản DB trong .env, không hỏi mật khẩu)
cd ~/danava-work/backend
mkdir -p ~/backups
git -C ~/danava-work rev-parse HEAD > ~/backups/last_deployed_commit.txt
DB_NAME=$(grep '^DB_DATABASE=' .env | cut -d= -f2- | tr -d '"')
DB_USER=$(grep '^DB_USERNAME=' .env | cut -d= -f2- | tr -d '"')
MYSQL_PWD=$(grep '^DB_PASSWORD=' .env | cut -d= -f2- | tr -d '"') \
  mysqldump -u "$DB_USER" "$DB_NAME" | gzip > ~/backups/workspace_$(date +%Y%m%d_%H%M%S).sql.gz
ls -lh ~/backups | tail -2

# 2) Deploy bằng script có sẵn
cd ~/danava-work
bash update.sh

# 3) Làm mới cache Laravel
cd ~/danava-work/backend
php artisan optimize:clear

# 4) (Chỉ cần làm 1 lần) Cho phép tải tệp tới 20MB: chỉ đổi 3 dòng giới hạn, giữ nguyên các cài đặt PHP khác
for d in ~/danava-work/backend/public ~/api-work.danava.com.vn; do
  [ -d "$d" ] || continue
  f="$d/.user.ini"; touch "$f"
  sed -i '/^[[:space:]]*\(upload_max_filesize\|post_max_size\|max_file_uploads\)[[:space:]]*=/d' "$f"
  printf 'upload_max_filesize = 25M\npost_max_size = 100M\nmax_file_uploads = 20\n' >> "$f"
  echo "Đã đặt giới hạn tải lên trong $f"
done
