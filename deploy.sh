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
  # PHP prints one marked line of base64 fields; bash writes them to a private temporary file,
  # so the password is never on screen or in the process list. This works even when the host's
  # `php` is a CGI build that ignores environment variables or prints HTTP headers.
  local cnf db_name db_line db_user db_pass db_host db_port
  cnf="$(mktemp)"
  chmod 600 "$cnf"
  trap 'rm -f "$cnf"' RETURN
  db_line="$(php -q <<'PHP' | grep '^DBCFG:' | tail -n 1

<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
// The resolved connection config (also handles DB_URL=mysql://user:pass@host/db).
$c = Illuminate\Support\Facades\DB::connection()->getConfig();
if (($c['username'] ?? '') === '') {
    fwrite(STDERR, "Laravel chưa có tên đăng nhập database. Kết nối: " . config('database.default')
        . ", driver: " . ($c['driver'] ?? '?') . ", database: " . ($c['database'] ?? '?') . "\n"
        . "Các khóa DB trong backend/.env: " . implode(', ', preg_grep('/DB|DATABASE/', array_map(
            fn ($l) => trim(explode('=', $l, 2)[0]), preg_grep('/=/', file('.env') ?: [])
        ))) . "\n");
    exit(1);
}
$b = fn ($v) => base64_encode((string) $v);
echo "\nDBCFG:" . implode(':', [
    $b($c['database'] ?? ''), $b($c['username'] ?? ''), $b($c['password'] ?? ''),
    $b($c['host'] ?? 'localhost'), $b((int) ($c['port'] ?? 3306)),
]) . "\n";
PHP
)" || true
  local f1 f2 f3 f4 f5
  IFS=: read -r f1 f2 f3 f4 f5 <<< "${db_line#DBCFG:}"
  db_name="$(printf '%s' "$f1" | base64 -d 2>/dev/null || true)"
  db_user="$(printf '%s' "$f2" | base64 -d 2>/dev/null || true)"
  db_pass="$(printf '%s' "$f3" | base64 -d 2>/dev/null || true)"
  db_host="$(printf '%s' "$f4" | base64 -d 2>/dev/null || true)"
  db_port="$(printf '%s' "$f5" | base64 -d 2>/dev/null || true)"
  if [ -z "$db_user" ]; then
    echo "❌ Không đọc được tài khoản database từ cấu hình Laravel (backend/.env). Không deploy."
    exit 1
  fi
  quote_cnf() { local v="${1//\\/\\\\}"; printf '"%s"' "${v//\"/\\\"}"; }
  {
    printf '[client]\n'
    printf 'user=%s\n' "$(quote_cnf "$db_user")"
    printf 'password=%s\n' "$(quote_cnf "$db_pass")"
    printf 'host=%s\n' "$(quote_cnf "${db_host:-localhost}")"
    printf 'port=%s\n' "${db_port:-3306}"
  } > "$cnf"
  unset db_pass f3
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
