#!/usr/bin/env bash
# Deploy DANAVA WORK on cPanel: back up the database, then update with update.sh.
#
# Usage (on the server):   bash ~/danava-work/deploy.sh
#
# Before running: on the dev machine, build the frontend (npm run build in frontend/)
# and push the code + frontend/dist to GitHub, because the hosting has no Node.js.

# Everything runs inside main() so bash reads the whole file first:
# update.sh pulls new code, which may replace this file while it runs.
main() {
  set -Eeuo pipefail

  local project_dir backend_dir backup_dir stamp backup_file
  project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  backend_dir="$project_dir/backend"
  backup_dir="$HOME/backups"
  stamp="$(date +%Y%m%d_%H%M%S)"
  backup_file="$backup_dir/workspace_${stamp}.sql.gz"

  echo "💾 [1/3] Sao lưu database..."
  mkdir -p "$backup_dir"
  git -C "$project_dir" rev-parse HEAD > "$backup_dir/last_deployed_commit.txt"

  cd "$backend_dir"
  env_value() { grep "^$1=" .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }

  MYSQL_PWD="$(env_value DB_PASSWORD)" \
    mysqldump --single-transaction --quick -u "$(env_value DB_USERNAME)" "$(env_value DB_DATABASE)" | gzip > "$backup_file"

  # A real dump is far larger than an empty gzip; stop before touching anything if it failed.
  local size
  size=$(stat -c %s "$backup_file")
  if [ "$size" -lt 2048 ]; then
    echo "❌ File sao lưu quá nhỏ ($size byte): $backup_file"
    echo "   Không deploy để an toàn. Kiểm tra lại thông tin DB trong backend/.env."
    exit 1
  fi
  echo "✅ Đã sao lưu: $backup_file ($(du -h "$backup_file" | cut -f1))"

  echo "🚀 [2/3] Cập nhật code, thư viện, database, giao diện (update.sh)..."
  cd "$project_dir"
  bash update.sh

  echo "🧹 [3/3] Làm mới cache Laravel..."
  cd "$backend_dir"
  php artisan optimize:clear

  echo ""
  echo "🎉 Xong! Commit đang chạy: $(git -C "$project_dir" log --oneline -1)"
  echo "   Mở https://workspace.danava.com.vn và bấm Ctrl + F5 để tải giao diện mới."
  echo "   Sao lưu để khôi phục khi cần: $backup_file"
  echo "   (commit trước khi deploy: $(cat "$backup_dir/last_deployed_commit.txt"))"
}

main "$@"
exit
