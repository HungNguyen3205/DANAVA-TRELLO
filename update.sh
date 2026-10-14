#!/bin/bash
# Script tự động cập nhật hệ thống DANAVA WORK trên Hosting cPanel
set -e

echo "🚀 [1/3] Đang kéo mã nguồn mới nhất từ GitHub..."
git pull origin main

echo "🌐 [2/3] Đang cập nhật giao diện Frontend..."
TARGET_DIR="/home/khoaluan/workspace.danava.com.vn"

if [ -d "$TARGET_DIR" ]; then
    cp -r frontend/dist/* "$TARGET_DIR/"
    if [ -f "frontend/dist/.htaccess" ]; then
        cp frontend/dist/.htaccess "$TARGET_DIR/"
    fi
    echo "✅ Đã cập nhật Frontend vào $TARGET_DIR"
else
    echo "⚠️ Không tìm thấy thư mục $TARGET_DIR, bỏ qua copy."
fi

echo "⚙️ [3/3] Đang cập nhật Backend & Database..."
cd backend
php artisan migrate --force
php artisan config:cache
php artisan route:cache

echo "🎉 Hoàn tất! Hệ thống đã được cập nhật phiên bản mới nhất."
