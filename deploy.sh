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

  # Find the database account for the backup. The password goes into a private temporary
  # option file, never on screen or in the process list.
  #  1) Ask Laravel (handles quotes, DB_URL and config cache). The PHP code is written to a file
  #     and run as `php file`, like artisan: the host's php (CGI build) mishandles stdin scripts,
  #     environment variables and STDERR. PHP prints one marked line of base64 fields.
  #  2) If that fails, read DB_* straight from backend/.env.
  local cnf php_file php_out db_line db_name db_user db_pass db_host db_port
  cnf="$(mktemp)"
  php_file="$backend_dir/.deploy-db-config.php"
  chmod 600 "$cnf"
  trap 'rm -f "$cnf" "$php_file"' RETURN
  cat > "$php_file" <<'PHP'
<?php
chdir(__DIR__);
require __DIR__ . '/vendor/autoload.php';
$app = require __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
// The resolved connection config (also handles DB_URL=mysql://user:pass@host/db).
$c = Illuminate\Support\Facades\DB::connection()->getConfig();
$b = fn ($v) => base64_encode((string) $v);
echo "\nDBCFG:" . implode(':', [
    $b($c['database'] ?? ''), $b($c['username'] ?? ''), $b($c['password'] ?? ''),
    $b($c['host'] ?? 'localhost'), $b((int) ($c['port'] ?? 3306)),
]) . "\n";
PHP
  chmod 600 "$php_file"
  php_out="$(php -q "$php_file" 2>&1)" || true
  rm -f "$php_file"
  db_line="$(printf '%s\n' "$php_out" | grep '^DBCFG:' | tail -n 1 || true)"
  local f1 f2 f3 f4 f5
  IFS=: read -r f1 f2 f3 f4 f5 <<< "${db_line#DBCFG:}"
  db_name="$(printf '%s' "$f1" | base64 -d 2>/dev/null || true)"
  db_user="$(printf '%s' "$f2" | base64 -d 2>/dev/null || true)"
  db_pass="$(printf '%s' "$f3" | base64 -d 2>/dev/null || true)"
  db_host="$(printf '%s' "$f4" | base64 -d 2>/dev/null || true)"
  db_port="$(printf '%s' "$f5" | base64 -d 2>/dev/null || true)"

  if [ -z "$db_user" ]; then
    echo "⚠️ Laravel không trả về tài khoản DB, đọc trực tiếp backend/.env."
    env_value() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//; s/^[[:space:]]+|[[:space:]]+$//g; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/' | tr -d '\r'; }
    db_name="$(env_value DB_DATABASE || true)"
    db_user="$(env_value DB_USERNAME || true)"
    db_pass="$(env_value DB_PASSWORD || true)"
    db_host="$(env_value DB_HOST || true)"
    db_port="$(env_value DB_PORT || true)"
  fi
  if [ -z "$db_user" ]; then
    echo "❌ Không đọc được tài khoản database (backend/.env cần DB_USERNAME). Không deploy."
    echo "   Kết quả khi hỏi Laravel:"
    printf '%s\n' "$php_out" | grep -v '^DBCFG:' | head -n 20 | sed 's/^/   | /'
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
