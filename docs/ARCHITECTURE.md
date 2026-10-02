# Kiến trúc và API

## Luồng màn hình

`/login` → `/` (danh sách không gian và bảng) → `/workspaces/:workspaceId` → `/boards/:boardId`.

Trang gốc có bảng yêu thích và gần đây của chính tài khoản, cùng các bảng nhóm theo không gian. Người dùng mới bắt đầu với trạng thái trống và tạo dữ liệu qua biểu mẫu. React Router bảo vệ route ở giao diện; Laravel kiểm tra quyền cho từng request để bảo vệ dữ liệu thực sự.

## Frontend

- `src/pages/LoginPage.tsx`: đăng nhập/đăng ký.
- `src/pages/WorkspacePage.tsx`: directory, tạo/sửa không gian, tạo bảng, thành viên.
- `src/pages/BoardPage.tsx`: Kanban, danh sách, bộ lọc, thao tác công việc/cột.
- `src/components/TaskEditor.tsx`: thông tin thẻ, checklist, bình luận.
- `src/components/kanban/`: dnd-kit kéo thả bằng chuột/bàn phím.
- `src/components/ui/Modal.tsx`: Radix Dialog, quản lý focus và Escape.
- `src/lib/api.ts`: gửi cookie/CSRF, chuẩn hóa lỗi HTTP; không chứa DB credential.
- `src/lib/useBoard.ts`: nạp bảng, cập nhật mỗi 30 giây, ghi dữ liệu có version.
- `src/contexts/`: tài khoản và theme. Chỉ theme được lưu localStorage.
- Lucide cho icon, Sonner cho thông báo; CSS tokens dùng chung cho sáng/tối.

Kéo thả bị khóa khi đang lọc để tránh hiểu sai thứ tự các thẻ bị ẩn. Modal công việc giữ snapshot và version tại thời điểm mở; khi server báo 409, bản nháp vẫn hiện để người dùng có thể sao chép trước khi tải lại. Việc bấm thêm checklist/bình luận chỉ cập nhật bản nháp; cần Lưu công việc để gửi server.

## Backend và dữ liệu

Laravel 13 + Sanctum session cookie cho SPA. Session nằm trong database, mật khẩu hash. Client lấy CSRF cookie từ `/sanctum/csrf-cookie`, rồi gửi `X-XSRF-TOKEN` cho thao tác ghi. Đăng nhập đổi session ID, đăng xuất hủy session.

| Bảng | Mục đích |
| --- | --- |
| users, sessions | Tài khoản và phiên đăng nhập |
| workspaces | Không gian, chủ sở hữu, tên, màu, mô tả |
| workspace_members | Thành viên và vai trò trong không gian |
| boards | Nhiều bảng trong mỗi không gian, version |
| board_preferences | Yêu thích, lần xem gần nhất theo tài khoản |
| board_columns | Các cột, thứ tự, trạng thái hoàn thành |
| tasks | Thẻ, cột, thứ tự, mô tả, ưu tiên, hạn, người phụ trách |
| task_collaborators | Người phối hợp của thẻ |
| checklist_items | Checklist có thứ tự và trạng thái |
| task_comments | Bình luận; tác giả/thời điểm do server gán |
| activity_logs | Người thực hiện và thời điểm thay đổi bảng |

Không gian → nhiều bảng → nhiều cột/thẻ. Các ID nghiệp vụ là UUID; user ID là số. `labels` là JSON trong hàng task; các thực thể còn lại có bảng/FK riêng. Migrations quản lý schema cho MySQL utf8mb4, không dùng một file JSON thay database.

`WorkspaceAccess` kiểm tra membership; `BoardData` dựng JSON tương thích giao diện. `BoardController` validate, lock, so version rồi reconcile các bảng quan hệ trong transaction. Nếu bất kỳ bước nào lỗi, toàn bộ lần lưu rollback. Không cho tái sử dụng ID từ bảng/công việc khác. Thêm/gỡ/đổi quyền thành viên làm tăng version các bảng; gỡ người sẽ xóa phân công/phối hợp của người đó.

API hiện ghi cả snapshot một bảng để tận dụng Kanban đã có; giới hạn mỗi bảng 2.000 thẻ, 100 cột, mỗi thẻ 200 checklist/500 bình luận. Đây là giới hạn payload kỹ thuật có thể thay đổi sau đo tải, không phải gói thuê bao. Sprint tối ưu sẽ tách endpoint ghi từng thẻ/cột, pagination và cập nhật realtime. Nội dung mô tả hoạt động do client gửi, tác giả/thời điểm do server xác thực: log hiện phục vụ lịch sử thao tác, chưa là audit bất biến cấp doanh nghiệp.

## Quyền

| Thao tác | Owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Đọc bảng/thành viên | Có | Có | Có | Có |
| Yêu thích/gần đây cá nhân | Có | Có | Có | Có |
| Tạo/sửa bảng/cột/thẻ/bình luận | Có | Có | Có | Không |
| Sửa không gian/quản lý thành viên | Có | Có | Không | Không |
| Gỡ/đổi quyền owner | Không | Không | Không | Không |

Thành viên thấy mọi bảng trong không gian đó. Chưa có board riêng tư theo nhóm con. Thêm thành viên yêu cầu email đã đăng ký; chưa gửi email mời.

## API

Mọi đường dẫn dưới đây có prefix `/api`. Ngoại trừ đăng ký/đăng nhập, cần cookie đăng nhập.

| Method | Path | Nội dung |
| --- | --- | --- |
| GET | /me | `{user}` hiện tại |
| POST | /auth/register | name, email, password, password_confirmation |
| POST | /auth/login | email, password |
| POST | /auth/logout | Hủy phiên |
| GET | /workspaces | `{workspaces:[...boards]}` thuộc tài khoản |
| POST | /workspaces | name, description?, color (#RRGGBB) |
| PATCH | /workspaces/{id} | name, description?, color |
| GET | /workspaces/{id}/members | Danh sách thành viên |
| PUT | /workspaces/{id}/members | email, role: admin/editor/viewer/remove |
| POST | /workspaces/{id}/boards | name, color; trả `{id}` |
| GET | /boards/{id} | `{id,workspace_id,version,role,data}` |
| PUT | /boards/{id} | `{version,data,activity?}`; trả snapshot mới |
| PUT | /boards/{id}/favorite | `{favorite:boolean}` |
| POST | /boards/{id}/visit | Ghi lần xem gần nhất |

`data` có `title`, `columns`, `tasks`, `users`, `activity` theo `frontend/src/types/index.ts`; server chỉ ghi title/columns/tasks. User/activity client không thể thay tác giả thật. Bình luận đã lưu không cho sửa tác giả/nội dung từ snapshot; bình luận mới được thêm khi lưu.

HTTP 401: chưa đăng nhập; 403: thiếu quyền sửa; 404: tài nguyên không tồn tại/không thuộc không gian của người dùng; 409: version cũ; 422: dữ liệu không hợp lệ. API đăng ký/đăng nhập có rate limit. Xem SETUP.md để cấu hình proxy/cookie.
