/**
 * What the assistant says when someone opens a page: what the page is for, plus a few
 * questions they can tap. Shown once per page type per browser session.
 */
export interface PageIntro {
  /** Session key: the same kind of page is introduced only once. */
  key: string;
  title: string;
  text: string;
  /** [label shown on the chip, question sent to the assistant] */
  suggestions: [string, string][];
  /** Project page: the widget fills in the project's name. */
  projectId?: number;
}

const PAGES: Record<string, Omit<PageIntro, 'key'>> = {
  '/home': {
    title: 'Trang chủ',
    text: 'Đây là **trang chủ** của anh/chị: việc hôm nay, chấm công, các bảng vừa làm và việc cần chú ý.',
    suggestions: [['📋 Hôm nay tôi có việc gì?', 'Hôm nay tôi có việc gì?'], ['⚠️ Việc nào sắp trễ hạn?', 'Tôi có việc nào quá hạn hoặc sắp đến hạn không?'], ['🧭 Bắt đầu dùng thế nào?', 'Hướng dẫn bắt đầu sử dụng']],
  },
  '/dashboard': {
    title: 'Tổng quan',
    text: 'Trang **Tổng quan** tổng hợp số liệu công việc của anh/chị trên mọi bảng: đã xong, đang làm, quá hạn.',
    suggestions: [['📊 Tình hình công việc tuần này?', 'Tổng hợp tình hình công việc của tôi tuần này'], ['⚠️ Việc quá hạn', 'Tôi có việc nào quá hạn không?']],
  },
  '/projects': {
    title: 'Dự án',
    text: 'Trang **Dự án** liệt kê các dự án anh/chị tham gia, kèm tiến độ, hạn và số việc quá hạn. Bấm vào một dự án để xem các bảng bên trong.',
    suggestions: [['➕ Cách tạo dự án', 'Làm sao tạo dự án mới?'], ['📁 Các dự án đang tới đâu?', 'Tiến độ các dự án của tôi'], ['🎨 Đổi màu, ảnh bìa dự án', 'Làm sao đổi màu và ảnh bìa dự án?']],
  },
  '/boards': {
    title: 'Tất cả bảng',
    text: 'Trang **Tất cả bảng** gom mọi bảng anh/chị tham gia ở mọi dự án. Có thể gắn sao, tìm kiếm, hoặc chuyển bảng sang dự án khác.',
    suggestions: [['➕ Cách tạo bảng', 'Làm sao tạo bảng mới?'], ['🔀 Chuyển bảng sang dự án khác', 'Làm sao chuyển bảng sang dự án khác?']],
  },
  '/my-tasks': {
    title: 'Công việc của tôi',
    text: 'Trang **Công việc của tôi** gom mọi việc được giao cho anh/chị ở tất cả các bảng, lọc theo cần làm, sắp đến hạn, quá hạn.',
    suggestions: [['📋 Việc hôm nay', 'Hôm nay tôi có việc gì?'], ['⏰ Việc sắp đến hạn', 'Việc nào của tôi sắp đến hạn?'], ['✅ Cách đánh dấu xong việc', 'Làm sao cập nhật trạng thái công việc?']],
  },
  '/attendance': {
    title: 'Chấm công',
    text: 'Trang **Chấm công**: bấm xác nhận khi đi làm và tan làm, xem lại lịch sử theo tháng. (Đang chạy thử.)',
    suggestions: [['🕘 Chấm công hôm nay của tôi', 'Chấm công hôm nay của tôi'], ['❓ Cách chấm công', 'Hướng dẫn chấm công']],
  },
  '/attendance/report': {
    title: 'Thống kê chấm công',
    text: 'Trang **Thống kê chấm công** dành cho quản lý: xem giờ đi làm, đi trễ, về sớm của nhân viên theo tháng.',
    suggestions: [['❓ Cách đọc thống kê', 'Hướng dẫn chấm công']],
  },
  '/notifications': {
    title: 'Thông báo',
    text: 'Trang **Thông báo** lưu mọi thông báo: được giao việc, sắp đến hạn, có bình luận mới.',
    suggestions: [['🔔 Nhận thông báo qua Telegram', 'Làm sao nhận thông báo qua Telegram?']],
  },
  '/search': {
    title: 'Tìm kiếm',
    text: 'Trang **Tìm kiếm** tìm công việc, bảng theo từ khóa trên mọi bảng anh/chị tham gia.',
    suggestions: [['🔎 Tìm việc theo từ khóa', 'Tìm công việc liên quan đến báo giá']],
  },
  '/trash': {
    title: 'Thùng rác',
    text: '**Thùng rác** giữ các bảng, công việc đã xóa để khôi phục lại khi cần.',
    suggestions: [['♻️ Khôi phục thế nào?', 'Làm sao khôi phục bảng hoặc công việc đã xóa?']],
  },
  '/profile': {
    title: 'Hồ sơ cá nhân',
    text: 'Trang **Hồ sơ cá nhân**: ảnh đại diện, thông tin liên hệ và chức vụ của anh/chị.',
    suggestions: [['🖼️ Đổi ảnh đại diện', 'Làm sao đổi ảnh đại diện?']],
  },
  '/account/settings': {
    title: 'Cài đặt tài khoản',
    text: 'Trang **Cài đặt tài khoản**: đổi mật khẩu, giao diện, thông báo và (với quản trị) cài đặt trợ lý AI.',
    suggestions: [['🔑 Đổi mật khẩu', 'Làm sao đổi mật khẩu?'], ['🌙 Giao diện tối', 'Làm sao bật giao diện tối?']],
  },
  '/help': {
    title: 'Hướng dẫn sử dụng',
    text: 'Đây là **Hướng dẫn sử dụng**. Mục nào chưa rõ anh/chị cứ hỏi em, em giải thích ngắn gọn.',
    suggestions: [['🧭 Bắt đầu từ đâu?', 'Hướng dẫn bắt đầu sử dụng']],
  },
  '/admin/employees': {
    title: 'Quản lý nhân viên',
    text: 'Trang **Quản lý nhân viên** (quản trị): tạo tài khoản, khóa/mở khóa, phân quyền và gán phòng ban.',
    suggestions: [['👤 Cách tạo tài khoản nhân viên', 'Làm sao tạo tài khoản nhân viên?']],
  },
  '/admin/departments': {
    title: 'Phòng ban',
    text: 'Trang **Phòng ban** (quản trị): tạo phòng ban, chọn trưởng phòng và thành viên.',
    suggestions: [['🏢 Cách tạo phòng ban', 'Làm sao tạo phòng ban?']],
  },
};

const BOARD_VIEWS: Record<string, Omit<PageIntro, 'key'>> = {
  kanban: {
    title: 'Bảng Kanban',
    text: 'Đây là **bảng Kanban**: mỗi cột là một trạng thái. Kéo thẻ sang cột khác để cập nhật, bấm thẻ để xem chi tiết.',
    suggestions: [['➕ Cách thêm và giao việc', 'Làm sao thêm công việc và giao việc?'], ['📊 Bảng này tới đâu rồi?', 'Tiến độ bảng này thế nào?'], ['👥 Mời thành viên', 'Làm sao mời người vào bảng?']],
  },
  list: {
    title: 'Danh sách',
    text: 'Chế độ **Danh sách** xem mọi việc của bảng dạng bảng biểu, đổi trạng thái bằng ô chọn và nhập việc từ Excel.',
    suggestions: [['✅ Đổi trạng thái việc', 'Làm sao cập nhật trạng thái công việc?']],
  },
  calendar: {
    title: 'Lịch',
    text: 'Chế độ **Lịch** hiển thị công việc theo hạn hoàn thành; kéo việc sang ngày khác để đổi hạn.',
    suggestions: [['⏰ Việc sắp đến hạn', 'Việc nào của tôi sắp đến hạn?']],
  },
  dashboard: {
    title: 'Thống kê bảng',
    text: 'Trang **Thống kê** của bảng: khối lượng việc, tiến độ và việc quá hạn của từng thành viên.',
    suggestions: [['📊 Tóm tắt tiến độ', 'Tiến độ bảng này thế nào?']],
  },
  members: {
    title: 'Thành viên bảng',
    text: 'Trang **Thành viên**: mời người vào bảng và chọn vai trò (thành viên hoặc quản trị viên).',
    suggestions: [['👥 Cách mời và phân quyền', 'Làm sao mời người vào bảng?']],
  },
  performance: {
    title: 'Điểm hiệu suất',
    text: 'Trang **Điểm hiệu suất** chấm điểm từng thành viên theo kỳ, dựa trên nội quy của bảng.',
    suggestions: [['🏅 Điểm được tính thế nào?', 'Hướng dẫn điểm hiệu suất và nội quy']],
  },
  'performance-policy': {
    title: 'Nội quy hiệu suất',
    text: 'Trang **Nội quy hiệu suất**: quản trị đặt cách tính điểm, thành viên đọc và xác nhận.',
    suggestions: [['📜 Nội quy dùng để làm gì?', 'Hướng dẫn điểm hiệu suất và nội quy']],
  },
  review: {
    title: 'Tổng kết',
    text: 'Trang **Tổng kết**: ghi lại mục tiêu, kết quả và bài học khi kết thúc bảng hoặc giai đoạn.',
    suggestions: [['📝 Cách viết tổng kết', 'Hướng dẫn điểm hiệu suất và nội quy']],
  },
  settings: {
    title: 'Cài đặt bảng',
    text: 'Trang **Cài đặt bảng**: đổi tên, ảnh nền, dự án chứa bảng, thông báo Telegram hoặc xóa bảng.',
    suggestions: [['🖼️ Đổi ảnh nền bảng', 'Làm sao đổi ảnh nền bảng?'], ['🔀 Chuyển sang dự án khác', 'Làm sao chuyển bảng sang dự án khác?']],
  },
  trash: {
    title: 'Thùng rác của bảng',
    text: '**Thùng rác** của bảng giữ công việc, cột đã xóa để khôi phục khi cần.',
    suggestions: [['♻️ Khôi phục thế nào?', 'Làm sao khôi phục công việc đã xóa?']],
  },
};

const RESERVED = new Set(['home', 'dashboard', 'projects', 'boards', 'my-tasks', 'attendance', 'notifications', 'search', 'trash', 'profile', 'account', 'help', 'admin', 'login', 'w', 'b', 'workspaces']);

export function introFor(pathname: string): PageIntro | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  const project = path.match(/^\/projects\/(\d+)$/);
  if (project) {
    const id = Number(project[1]);
    return {
      key: `project-${id}`,
      projectId: id,
      title: 'Dự án',
      text: 'Đây là trang **dự án**: tổng quan tiến độ, thành viên và các bảng bên trong.',
      suggestions: [['📊 Dự án này đang tới đâu?', ''], ['➕ Cách tạo bảng trong dự án', 'Làm sao tạo bảng trong dự án?'], ['👥 Cách mời thành viên', 'Làm sao mời người vào bảng?']],
    };
  }

  if (PAGES[path]) return { key: `page:${path}`, ...PAGES[path] };

  const board = path.match(/^\/([^/]+)\/([a-z-]+)$/);
  if (board && !RESERVED.has(board[1]) && BOARD_VIEWS[board[2]]) {
    return { key: `board:${board[2]}`, ...BOARD_VIEWS[board[2]] };
  }
  return null;
}
