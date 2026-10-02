# Kế hoạch phát triển theo sprint nhỏ

Mỗi sprint nên khoảng 3–5 ngày làm việc cho một người; đây là khung chia việc, chưa phải cam kết thời gian. Hoàn tất tiêu chí nghiệm thu rồi mới sang phần phụ thuộc tiếp theo. Mỗi sprint có phần frontend và backend để phát triển độc lập nhưng tích hợp liên tục.

**Nhánh hiện tại triển khai nền tảng/MVP của sprint 0–4.** Các mục mở rộng phía dưới là backlog, không phải tính năng đã có. Chữ “sprint” ở đây trước hết là đợt phát triển; chức năng quản lý sprint ngay trong ứng dụng được tách riêng ở sprint 8.

## Sprint 0 — Tách dự án và thiết lập dữ liệu

- Frontend: React/Vite trong `frontend/`, routing, API client, theme, dialog/icon/toast chung.
- Backend: Laravel trong `backend/`, MySQL migration, `.env.example`, cấu hình Sanctum.
- Nghiệm thu: clone mới, cài dependency, migrate, chạy được hai server theo README; không hardcode DB credential.
- Hiện tại: đã có cấu trúc, migration, cấu hình local và tài liệu.

## Sprint 1 — Tài khoản và phiên đăng nhập

- Frontend: đăng ký/đăng nhập/đăng xuất, trạng thái tải và lỗi, route yêu cầu đăng nhập.
- Backend: validate tài khoản, hash mật khẩu, session database, CSRF, rate limit đăng nhập.
- Nghiệm thu: refresh vẫn đăng nhập; logout mất phiên; khách gọi API không được xem dữ liệu; email trùng/sai mật khẩu có thông báo.
- Hiện tại: đã có MVP. Việc tiếp theo: quên/reset mật khẩu qua SMTP, xác minh email, chỉnh hồ sơ, đổi mật khẩu và test CSRF trên deployment thật.

## Sprint 2 — Trang không gian làm việc giống bố cục ảnh

- Frontend: sidebar không gian, cards của bảng, yêu thích/gần đây, tìm bảng, tạo không gian/bảng, màn hình trống, mobile.
- Backend: workspace/board quan hệ 1–n, membership owner tự tạo, favorite/visit riêng cho tài khoản.
- Nghiệm thu: một tài khoản tạo hai không gian, mỗi không gian hai bảng; mở đúng bảng, reload không mất dữ liệu, yêu thích không lẫn giữa người dùng.
- Hiện tại: đã có MVP. Việc tiếp theo: tải ảnh bìa thật, archive/restore bảng, xác nhận xóa không gian, phân trang khi có nhiều bảng.

## Sprint 3 — Cột và công việc cốt lõi

- Frontend: CRUD thẻ, kéo thả cột/thẻ, chi tiết thẻ, danh sách, lọc người/ưu tiên/hạn, nhãn, checklist.
- Backend: lưu thẻ/cột có thứ tự, validation, FK, transaction, optimistic version để chống ghi đè.
- Nghiệm thu: kéo thẻ qua cột trống rồi refresh; đổi cột hoàn thành phải đổi số liệu đúng; không xóa cột có thẻ; tab cũ không ghi đè tab mới.
- Hiện tại: đã có MVP. Việc tiếp theo: API riêng cho từng thao tác, undo, archive thẻ, copy/move giữa bảng, đo hiệu năng với bảng lớn.

## Sprint 4 — Cộng tác và quyền

- Frontend: danh sách thành viên, thay quyền, gỡ người, phụ trách/phối hợp, bình luận, lịch sử thao tác.
- Backend: owner/admin/editor/viewer; kiểm tra mọi request; gỡ người dọn assignment; tác giả comment/log theo phiên thật.
- Nghiệm thu: viewer không ghi dữ liệu dù gọi API trực tiếp; người ngoài không đọc bảng; member bị gỡ mất quyền; không thể gán task cho người ngoài workspace.
- Hiện tại: đã có MVP, thêm người bằng email đã đăng ký; cập nhật bảng qua polling 30 giây.
- Việc tiếp theo: email mời có token/hạn dùng/chấp nhận, WebSocket, phát hiện người đang xem, thao tác bình luận riêng, log thay đổi chi tiết do server sinh.

## Sprint 5 — Tệp đính kèm và thông báo (chưa triển khai)

- Frontend: upload/xem/tải/xóa file có tiến độ; hộp thông báo; liên kết đến thẻ.
- Backend: storage local/S3, kiểm tra loại/dung lượng/quyền tải, bảng attachments, notification và queue email.
- Nghiệm thu: người ngoài không tải được file riêng; retry upload không tạo bản trùng; xóa thẻ xử lý file đúng; thông báo không gửi lặp.

## Sprint 6 — Lịch, tiến độ và tìm kiếm (chưa triển khai)

- Frontend: lịch theo deadline, bộ lọc nâng cao, công việc của tôi, dashboard tiến độ theo không gian.
- Backend: endpoint báo cáo có quyền, index/filter/pagination, deadline theo timezone nhất quán.
- Nghiệm thu: số liệu khớp thẻ thực tế, không tính thẻ hoàn thành là quá hạn, dữ liệu không lẫn workspace, truy vấn đáp ứng mục tiêu hiệu năng đã đo.

## Sprint 7 — Kiểm thử, backup và triển khai (đã có test nền tảng, còn triển khai)

- Frontend: E2E browser desktop/mobile, bàn phím/focus, loading/error/empty, kiểm tra màu/độ tương phản.
- Backend: MySQL integration test, test race/authorization, log lỗi, backup/restore, monitoring, CI/CD.
- Nghiệm thu: build/test xanh, cài được từ máy sạch, HTTPS/cookie production hoạt động, khôi phục backup được, hướng dẫn bàn giao đầy đủ.
- Không mở dữ liệu thật cho đội ngũ trước khi nghiệm thu cấu hình deployment, backup và tài khoản.

## Sprint 8 — Quản lý sprint trong ứng dụng (tùy nhu cầu, chưa triển khai)

- Frontend: backlog, tạo sprint có ngày bắt đầu/kết thúc/mục tiêu, kéo thẻ vào sprint, bắt đầu/kết thúc sprint, xử lý việc chưa xong.
- Backend: bảng `sprints`, `tasks.sprint_id`, trạng thái planned/active/completed, quy tắc đóng sprint và lịch sử chuyển việc.
- Nghiệm thu: thẻ không thuộc hai sprint cùng lúc; kết thúc sprint giữ lịch sử và chuyển việc chưa xong đúng; báo cáo chỉ đọc dữ liệu có quyền.

## Quy tắc hoàn tất một sprint

1. API + UI của tính năng đều hoạt động với database; không dùng dữ liệu giả để đánh dấu hoàn tất.
2. Có tiêu chí kiểm thử lỗi/quyền, không chỉ đường đi thành công.
3. Đã kiểm tra tải lại trang, trạng thái trống, lỗi kết nối, kích thước mobile.
4. Migration/README/API thay đổi được cập nhật cùng commit.
5. Branch/PR nhỏ theo chức năng; không gộp toàn bộ backlog vào một lần phát triển.
