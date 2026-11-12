<?php

namespace App\Support;

/**
 * The user guide: one source for the "Hướng dẫn sử dụng" page and for the assistant's how-to answers.
 * Keep steps short (one action each). `keywords` are accent-free phrases people might type.
 */
class UserGuide
{
    public const SECTIONS = [
        [
            'id' => 'bat-dau',
            'icon' => 'compass',
            'title' => 'Bắt đầu: cách sắp xếp công việc',
            'summary' => 'Công việc được tổ chức theo 4 cấp: Dự án › Bảng › Cột › Công việc.',
            'steps' => [
                '**Dự án** gom nhiều bảng của cùng một mục tiêu (ví dụ "Ra mắt DANAVAGo").',
                '**Bảng** là nơi làm việc của một nhóm hay một mảng (ví dụ "Thiết kế", "Marketing").',
                '**Cột** là trạng thái: Chưa bắt đầu → Đang thực hiện → Chờ duyệt → Hoàn thành.',
                '**Công việc** là từng việc cụ thể, có người phụ trách, hạn và độ ưu tiên.',
            ],
            'keywords' => ['bat dau', 'cau truc', 'to chuc', 'su dung', 'dung app', 'phan mem', 'khai niem', 'cot la gi', 'bang la gi', 'du an la gi'],
        ],
        [
            'id' => 'du-an',
            'icon' => 'folder',
            'title' => 'Tạo và quản lý dự án',
            'summary' => 'Dự án giúp theo dõi tiến độ chung của nhiều bảng.',
            'steps' => [
                'Menu trái → **Dự án** → bấm **Tạo dự án**.',
                'Nhập tên, mô tả, trạng thái và thời hạn rồi bấm **Tạo dự án**.',
                'Trong dự án: **Chỉnh sửa** để đổi thông tin và chọn **Quản lý dự án**.',
                'Bấm **Màu & ảnh bìa** để đổi màu nhận diện và tải ảnh bìa.',
                'Mục **Tài liệu dự án**: kéo thả hồ sơ, kế hoạch, hợp đồng… (tối đa 20MB mỗi tệp) để mọi người trong dự án cùng xem và tải.',
                'Chủ dự án và quản lý dự án có **toàn quyền** trên mọi bảng trong dự án.',
            ],
            'keywords' => ['tao du an', 'du an moi', 'quan ly du an', 'tai lieu', 'tai lieu du an', 'up file', 'tai file', 'dinh kem du an', 'ho so du an', 'sua du an', 'xoa du an', 'anh bia', 'mau du an', 'tien do du an', 'nguoi quan ly'],
        ],
        [
            'id' => 'bang',
            'icon' => 'board',
            'title' => 'Tạo bảng và chuyển bảng sang dự án khác',
            'summary' => 'Mỗi bảng thuộc một dự án; có thể chuyển bảng bất cứ lúc nào.',
            'steps' => [
                'Mở một dự án → **Tạo bảng mới** (bảng có sẵn 4 cột).',
                'Hoặc vào **Dự án › Tất cả bảng** → **Tạo bảng mới** và chọn dự án.',
                'Chuyển bảng: rê chuột lên thẻ bảng → icon **thư mục có mũi tên**, hoặc trong bảng bấm **⋯ › Chuyển sang dự án khác**.',
                'Đổi tên, mô tả, ảnh nền: trong bảng → menu trái **Cài đặt bảng**.',
            ],
            'keywords' => ['tao bang', 'bang moi', 'chuyen bang', 'doi du an', 'anh nen', 'doi ten bang', 'xoa bang', 'cai dat bang'],
        ],
        [
            'id' => 'cong-viec',
            'icon' => 'task',
            'title' => 'Thêm công việc và giao việc',
            'summary' => 'Tạo việc trong cột, rồi giao người, đặt hạn và độ ưu tiên.',
            'steps' => [
                'Trong bảng Kanban, bấm **+ Thêm công việc** ở cuối cột (hoặc nút cam **Thêm việc** trên cùng).',
                'Bấm vào thẻ công việc để mở chi tiết.',
                'Chọn **người phụ trách**, **hạn hoàn thành**, **độ ưu tiên**, thêm mô tả, việc con, tệp đính kèm.',
                'Người được giao sẽ nhận thông báo.',
            ],
            'keywords' => ['them cong viec', 'tao cong viec', 'tao task', 'them viec', 'tao viec', 'giao cho', 'dat han', 'giao viec', 'nguoi phu trach', 'han hoan thanh', 'deadline', 'uu tien', 'viec con', 'dinh kem'],
        ],
        [
            'id' => 'keo-tha',
            'icon' => 'move',
            'title' => 'Cập nhật trạng thái công việc',
            'summary' => 'Kéo thẻ sang cột khác để đổi trạng thái.',
            'steps' => [
                'Giữ chuột vào thẻ công việc và **kéo sang cột** mới.',
                'Kéo vào **Hoàn thành** khi xong việc; tiến độ dự án tự cập nhật.',
                'Trang **Danh sách** cho phép đổi trạng thái bằng ô chọn, không cần kéo.',
                'Xem việc của mình ở menu **Công việc của tôi**.',
            ],
            'keywords' => ['keo tha', 'doi trang thai', 'chuyen cot', 'hoan thanh viec', 'danh dau xong', 'cong viec cua toi', 'cap nhat tien do'],
        ],
        [
            'id' => 'thanh-vien',
            'icon' => 'users',
            'title' => 'Mời thành viên và phân quyền',
            'summary' => 'Chỉ thành viên của bảng mới thấy bảng đó.',
            'steps' => [
                'Trong bảng, bấm icon **người có dấu +** trên thanh trên cùng (hoặc menu trái **Thành viên**).',
                'Tìm tên đồng nghiệp, chọn vai trò **Thành viên** hoặc **Quản trị viên** rồi mời.',
                'Quản trị viên bảng: sửa cài đặt, cột, thành viên. Chủ bảng: thêm quyền xóa bảng.',
                'Chủ dự án / quản lý dự án: toàn quyền mọi bảng trong dự án, không cần được mời.',
            ],
            'keywords' => ['moi thanh vien', 'them thanh vien', 'them nguoi', 'moi nguoi', 'moi vao bang', 'them vao bang', 'cho nguoi khac xem', 'moi dong nghiep', 'phan quyen', 'quyen', 'vai tro', 'quan tri vien', 'chu bang', 'chia se bang'],
        ],
        [
            'id' => 'tro-ly',
            'icon' => 'bot',
            'title' => 'Dùng trợ lý AI',
            'summary' => 'Hỏi về công việc, hoặc dán tin nhắn giao việc để tạo việc tự động.',
            'steps' => [
                'Bấm biểu tượng **robot** ở góc dưới phải.',
                'Hỏi tự nhiên: "Hôm nay tôi có việc gì?", "Dự án X tới đâu rồi?".',
                'Dán tin nhắn giao việc (mỗi việc một dòng, có **@tên**) → kiểm tra bảng và người → **Tạo công việc**.',
                'Có thể gửi **ảnh, PDF, Word, Excel** hoặc **ghi âm** bằng các nút dưới khung chat.',
            ],
            'keywords' => ['tro ly', 'chatbot', 'ai', 'robot', 'dan tin nhan', 'giao viec bang tin nhan', 'ghi am', 'gui anh', 'zalo'],
        ],
        [
            'id' => 'cham-cong',
            'icon' => 'clock',
            'title' => 'Chấm công',
            'summary' => 'Xác nhận giờ đi làm và tan làm mỗi ngày (đang chạy thử).',
            'steps' => [
                'Trang chủ hoặc menu **Chấm công** → bấm **Xác nhận đi làm** khi đến.',
                'Cuối ngày bấm **Xác nhận tan làm**.',
                'Xem lại ở **Xem lịch sử chấm công**.',
            ],
            'keywords' => ['cham cong', 'di lam', 'tan lam', 'check in', 'checkin', 'lich su cham cong'],
        ],
        [
            'id' => 'hieu-suat',
            'icon' => 'award',
            'title' => 'Điểm hiệu suất, nội quy và tổng kết',
            'summary' => 'Mỗi bảng có chấm điểm hiệu suất theo nội quy và trang tổng kết.',
            'steps' => [
                'Trong bảng → menu trái **Nội quy hiệu suất**: quản trị đặt cách tính điểm, thành viên xác nhận đã đọc.',
                '**Điểm hiệu suất**: xem điểm từng người theo kỳ.',
                '**Tổng kết**: ghi nhận kết quả khi kết thúc bảng/dự án.',
            ],
            'keywords' => ['hieu suat', 'diem', 'noi quy', 'tong ket', 'danh gia', 'kpi'],
        ],
        [
            'id' => 'thong-bao',
            'icon' => 'bell',
            'title' => 'Thông báo và Telegram',
            'summary' => 'Nhận báo khi được giao việc, sắp đến hạn, có bình luận.',
            'steps' => [
                'Bấm **chuông** trên thanh trên cùng để xem thông báo.',
                'Nhận thông báo qua Telegram: trong bảng → **Cài đặt bảng › Telegram**.',
            ],
            'keywords' => ['thong bao', 'chuong', 'telegram', 'nhan thong bao'],
        ],
        [
            'id' => 'giao-dien',
            'icon' => 'settings',
            'title' => 'Tài khoản và giao diện',
            'summary' => 'Đổi họ tên, giới tính, thông tin cá nhân, mật khẩu, giao diện sáng/tối.',
            'steps' => [
                'Đổi **họ tên, giới tính, số điện thoại, ngày sinh, ảnh đại diện**: menu trái **Hồ sơ cá nhân** → sửa thông tin → bấm **Lưu thay đổi**.',
                'Bấm **ảnh đại diện** góc trên phải → **Thông tin cá nhân** hoặc bật **Giao diện tối**.',
                'Đổi mật khẩu: menu trái **Cài đặt tài khoản**.',
                'Thu gọn menu trái: bấm nút trên đầu menu (chỉ còn icon).',
            ],
            'keywords' => ['doi mat khau', 'mat khau', 'giao dien toi', 'dark mode', 'che do toi', 'anh dai dien', 'thong tin ca nhan', 'thu gon menu', 'tai khoan', 'doi ten', 'doi ho ten', 'sua ten', 'ho ten', 'gioi tinh', 'ho so ca nhan', 'so dien thoai', 'ngay sinh'],
        ],
    ];

    public static function all(): array
    {
        return array_map(fn ($s) => array_diff_key($s, ['keywords' => 1]), self::SECTIONS);
    }

    /**
     * Sections that best match a question: phrase hits count most, then shared title words.
     *
     * @return array<int, array>
     */
    public static function search(string $question, int $limit = 2): array
    {
        // Whole-phrase matching on accent-free text ("ai" must not match inside "lai" or "tai").
        $q = ' ' . trim(preg_replace('/[^a-z0-9]+/', ' ', VietnameseText::fold($question))) . ' ';
        $words = VietnameseText::words($question);
        $scored = [];
        foreach (self::SECTIONS as $s) {
            $score = 0;
            foreach ($s['keywords'] as $k) {
                if (str_contains($q, ' ' . $k . ' ')) {
                    $score += 2 + substr_count($k, ' ');
                }
            }
            $score += count(array_intersect($words, VietnameseText::words($s['title']))) * 0.5;
            if ($score >= 2) {
                $scored[] = [$score, $s];
            }
        }
        usort($scored, fn ($a, $b) => $b[0] <=> $a[0]);

        return array_map(fn ($x) => array_diff_key($x[1], ['keywords' => 1]), array_slice($scored, 0, $limit));
    }
}
