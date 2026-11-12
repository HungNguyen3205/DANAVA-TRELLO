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

  # Ask Laravel for the database connection it really uses (handles quotes, spaces and config cache).
  # The password goes into a private temporary file (never on screen or in the process list).
  local cnf db_name
  cnf="$(mktemp)"
  chmod 600 "$cnf"
  trap 'rm -f "$cnf"' RETURN
  db_name="$(CNF="$cnf" php <<'PHP'
<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$c = config('database.connections.' . config('database.default'));
$q = fn ($v) => '"' . addcslashes((string) $v, "\"\\") . '"';
file_put_contents(getenv('CNF'), "[client]\nuser=" . $q($c['username'] ?? '') . "\npassword=" . $q($c['password'] ?? '')
    . "\nhost=" . $q($c['host'] ?? 'localhost') . "\nport=" . (int) ($c['port'] ?? 3306) . "\n");
echo $c['database'] ?? '';
PHP
)"
  if [ -z "$db_name" ]; then
    echo "❌ Không đọc được tên database từ cấu hình Laravel (backend/.env). Không deploy."
    exit 1
  fi

  # --no-tablespaces: shared hosting users usually lack the PROCESS privilege it would need.
  mysqldump --defaults-extra-file="$cnf" --single-transaction --quick --no-tablespaces "$db_name" | gzip > "$backup_file"
  rm -f "$cnf"

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
