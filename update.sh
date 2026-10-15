#!/usr/bin/env bash
# Script tự động cập nhật hệ thống DANAVA WORK trên Hosting cPanel
set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/home/khoaluan/workspace.danava.com.vn"
cd "$PROJECT_DIR"

echo "🚀 [1/5] Đang kéo mã nguồn mới nhất từ GitHub..."
git pull --ff-only origin main

echo "🏗️ [2/5] Đang build Frontend từ source của commit hiện tại..."
cd "$PROJECT_DIR/frontend"
if command -v npm >/dev/null 2>&1; then
    npm ci
    npm run build
else
    echo "⚠️ Hosting không có npm; sử dụng frontend/dist đã build sẵn trong Git."
fi

echo "📦 [3/5] Đang cập nhật PHP dependencies..."
cd "$PROJECT_DIR/backend"
if command -v composer >/dev/null 2>&1; then
    composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
else
    echo "⚠️ Hosting không có composer; giữ nguyên thư mục vendor hiện tại."
fi

echo "⚙️ [4/5] Đang đồng bộ cơ sở dữ liệu và làm mới cache Laravel..."
php artisan down --retry=15 || true
trap 'php artisan up || true' EXIT
php artisan storage:link || true
php sync_database.php

echo "🌐 [5/5] Đang phát hành giao diện mới..."
if [ ! -d "$TARGET_DIR" ]; then
    echo "❌ Không tìm thấy thư mục deploy: $TARGET_DIR"
    exit 1
fi

cp -a "$PROJECT_DIR/frontend/dist/." "$TARGET_DIR/"
php artisan up
trap - EXIT

echo "🎉 Cập nhật thành công hệ thống DANAVA WORK!"
