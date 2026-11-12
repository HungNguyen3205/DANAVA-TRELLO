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
