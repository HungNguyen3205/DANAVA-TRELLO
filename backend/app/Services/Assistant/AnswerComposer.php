<?php

namespace App\Services\Assistant;

/**
 * Builds a formatted (Markdown) Vietnamese answer from retrieved data when Gemini is
 * not available. The wording depends entirely on what the retriever found for this
 * person and this question, not on canned replies.
 */
class AnswerComposer
{
    /** How the person asking is addressed: "anh", "chị" or "anh/chị". */
    private string $xh = 'anh/chị';

    public function compose(array $ctx, string $assistantName): string
    {
        $this->xh = $ctx['nguoi_hoi']['xung_ho'] ?? 'anh/chị';
        $name = $ctx['nguoi_hoi']['ten_goi'] ?? '';
        $topics = $ctx['chu_de'] ?? [];
        $parts = [];

        $specific = !empty($ctx['bang_duoc_hoi']) || !empty($ctx['nguoi_duoc_hoi']) || !empty($ctx['ket_qua_tim_kiem']) || !empty($ctx['du_an']);
        if (in_array('chao_hoi', $topics, true) && !$specific) {
            return $this->greeting($ctx, $assistantName);
        }
        if (!empty($ctx['huong_dan'])) {
            return $this->guide($ctx['huong_dan']);
        }
        if (in_array('huong_dan', $topics, true)) {
            $parts[] = $this->howTo();
        }

        foreach ($ctx['bang_duoc_hoi'] ?? [] as $board) {
            $parts[] = $this->board($board);
        }
        if (!empty($ctx['du_an'])) {
            $parts[] = "### 📁 Các dự án của {$this->xh}\n" . implode("\n", array_map(fn ($b) => $this->projectLine($b), $ctx['du_an']));
        }
        foreach ($ctx['nguoi_duoc_hoi'] ?? [] as $person) {
            $parts[] = $this->person($person);
        }
        // Skip my task list when the question is only about attendance.
        if (isset($ctx['viec_cua_toi']) && $topics !== ['cham_cong']) {
            $parts[] = $this->myTasks($ctx['viec_cua_toi'], $ctx['tong_quan_cua_toi']);
        }
        if (!empty($ctx['ket_qua_tim_kiem']['cong_viec']) && empty($ctx['bang_duoc_hoi']) && empty($ctx['nguoi_duoc_hoi'])) {
            $parts[] = $this->search($ctx['ket_qua_tim_kiem']);
        }
        if (isset($ctx['cham_cong_cua_toi'])) {
            $parts[] = $this->attendance($ctx['cham_cong_cua_toi'], 'Chấm công tháng ' . $ctx['cham_cong_cua_toi']['thang'] . ' của ' . $this->xh);
        }

        $parts = array_values(array_filter($parts));
        if (!$parts) {
            $parts[] = $this->overview($ctx['tong_quan_cua_toi']);
        }

        $intro = $name !== '' ? "Dạ {$this->xh} **{$name}**, em gửi thông tin ạ:\n\n" : '';

        return $intro . implode("\n\n", $parts);
    }

    private function greeting(array $ctx, string $assistantName): string
    {
        $s = $ctx['tong_quan_cua_toi'];
        $name = $ctx['nguoi_hoi']['ten_goi'] ?? '';
        $lines = ["Em chào {$this->xh} **{$name}** 👋 Em là **{$assistantName}** đây ạ."];
        $lines[] = '';
        $lines[] = '**Hôm nay của ' . $this->xh . ':**';
        $lines[] = "- 📋 Việc đang mở: **{$s['viec_chua_xong']}**";
        if ($s['han_hom_nay']) {
            $lines[] = "- ⏰ Hạn hôm nay: **{$s['han_hom_nay']}**";
        }
        if ($s['qua_han']) {
            $lines[] = "- ⚠️ Quá hạn: **{$s['qua_han']}**";
        }
        $lines[] = '- 🕘 Chấm công: ' . $this->attendanceToday($s['cham_cong_hom_nay']);

        return implode("\n", $lines) . "\n\nAnh/chị cứ hỏi em về bảng, dự án, đồng nghiệp hoặc dán tin nhắn giao việc nhé.";
    }

    private function overview(array $s): string
    {
        $lines = ['### 📊 Tổng quan công việc của ' . $this->xh];
        $lines[] = "- Việc đang mở: **{$s['viec_chua_xong']}**";
        $lines[] = "- Hạn hôm nay: **{$s['han_hom_nay']}**";
        $lines[] = '- Quá hạn: ' . ($s['qua_han'] ? "**{$s['qua_han']}** ⚠️" : '**0** ✅');
        $lines[] = "- Khẩn cấp: **{$s['khan_cap']}**";
        $lines[] = '- Chấm công hôm nay: ' . $this->attendanceToday($s['cham_cong_hom_nay']);

        return implode("\n", $lines) . "\n\nEm chưa tìm thấy thông tin cụ thể cho câu hỏi này. Anh/chị thử nêu **tên bảng, tên người** hoặc **từ khóa công việc** giúp em nhé.";
    }

    private function myTasks(array $data, array $summary): string
    {
        $title = "### 📋 Việc của {$this->xh} ({$data['pham_vi']})";
        if (!$data['danh_sach']) {
            return $title . "\nKhông có công việc nào trong phạm vi này ✅";
        }
        $lines = [$title];
        foreach ($data['danh_sach'] as $t) {
            $lines[] = $this->taskLine($t);
        }
        if ($summary['viec_chua_xong'] > count($data['danh_sach']) && $data['pham_vi'] === 'tất cả việc đang mở') {
            $lines[] = "\n_Đang hiện " . count($data['danh_sach']) . "/{$summary['viec_chua_xong']} việc gần hạn nhất._";
        }

        return implode("\n", $lines);
    }

    private function board(array $b): string
    {
        $progress = $b['tong_viec'] ? round($b['da_xong'] * 100 / $b['tong_viec']) : 0;
        $lines = ["### 🗂️ {$b['ten']}" . (!empty($b['du_an']) ? " · 📁 {$b['du_an']}" : '')];
        $lines[] = "- Tiến độ: **{$b['da_xong']}/{$b['tong_viec']}** việc hoàn thành (**{$progress}%**)";
        if ($b['qua_han']) {
            $lines[] = "- Quá hạn: **{$b['qua_han']}** việc ⚠️";
        }
        $lines[] = '- Theo cột: ' . implode(' · ', array_map(fn ($c) => "{$c['cot']} **{$c['so_viec']}**", $b['theo_cot']));
        if ($b['viec_can_chu_y']) {
            $lines[] = "\n**Việc cần chú ý:**";
            foreach ($b['viec_can_chu_y'] as $t) {
                $lines[] = $this->taskLine($t);
            }
        }

        return implode("\n", $lines);
    }

    /** One project: overall progress over its boards, then one line per board. */
    private function projectLine(array $p): string
    {
        $boards = $p['cac_bang'] ?? [];
        $total = array_sum(array_column($boards, 'tong_viec'));
        $done = array_sum(array_column($boards, 'da_xong'));
        $late = array_sum(array_column($boards, 'qua_han'));
        $progress = $total ? round($done * 100 / $total) : 0;
        $due = !empty($p['han']) ? ' · hạn ' . $this->date($p['han']) : '';
        $extra = $late ? " · ⚠️ {$late} quá hạn" : '';
        $line = "- **{$p['ten']}**: {$progress}% ({$done}/{$total}){$due}{$extra}";
        foreach ($boards as $b) {
            $line .= "
  - {$b['ten']}: {$b['da_xong']}/{$b['tong_viec']} việc";
        }

        return $line;
    }

    private function person(array $p): string
    {
        $lines = ["### 👤 {$p['ten']}" . ($p['chuc_vu'] ? " · _{$p['chuc_vu']}_" : '')];
        $tasks = $p['viec_dang_mo_trong_cac_bang_chung'];
        if (!$tasks) {
            $lines[] = 'Không có việc đang mở trong các bảng ' . $this->xh . ' cùng tham gia.';
        } else {
            $lines[] = '**Việc đang mở** (' . count($tasks) . '):';
            foreach ($tasks as $t) {
                $lines[] = $this->taskLine($t);
            }
        }
        if (isset($p['cham_cong_thang_nay'])) {
            $lines[] = '';
            $lines[] = $this->attendance($p['cham_cong_thang_nay'], 'Chấm công tháng ' . $p['cham_cong_thang_nay']['thang']);
        }

        return implode("\n", $lines);
    }

    private function search(array $r): string
    {
        $lines = ['### 🔎 Công việc liên quan đến “' . implode(', ', $r['tu_khoa']) . '”'];
        foreach ($r['cong_viec'] as $t) {
            $lines[] = $this->taskLine($t);
        }

        return implode("\n", $lines);
    }

    private function attendance(array $a, string $title): string
    {
        $lines = ["### 🕘 {$title}" . ($a['che_do'] === 'chạy thử' ? ' _(chạy thử)_' : '')];
        $lines[] = "- Ngày đi làm: **{$a['ngay_di_lam']}** · Tổng giờ: **{$a['tong_gio']} giờ**";
        $lines[] = "- Đi trễ: **{$a['so_ngay_di_tre']}** ngày · Về sớm: **{$a['so_ngay_ve_som']}** ngày";
        $lines[] = "- Vắng: **{$a['so_ngay_vang']}** ngày · Quên chấm tan làm: **{$a['quen_cham_tan_lam']}** ngày";
        $lines[] = '- Hôm nay: ' . $this->attendanceToday($a['hom_nay']);

        return implode("\n", $lines);
    }

    private function attendanceToday(array|string $a): string
    {
        if (!is_array($a)) {
            return '_chưa chấm công_';
        }
        $text = "đi làm **{$a['di_lam']}**" . ($a['tan_lam'] ? ", tan làm **{$a['tan_lam']}**" : ', chưa tan làm');

        return $text . ($a['tre_phut'] ? " (trễ {$a['tre_phut']} phút)" : '');
    }

    private function taskLine(array $t): string
    {
        $bits = [];
        if (!empty($t['bang'])) {
            $bits[] = $t['bang'];
        }
        if (!empty($t['cot'])) {
            $bits[] = $t['cot'];
        }
        if (!empty($t['nguoi_phu_trach'])) {
            $bits[] = '👤 ' . $t['nguoi_phu_trach'];
        }
        if (!empty($t['han'])) {
            $bits[] = (!empty($t['qua_han']) ? '⚠️ quá hạn ' : '⏰ ') . $this->date($t['han']);
        }
        $flag = ($t['uu_tien'] ?? '') === 'Khẩn cấp' ? '🔴 ' : (($t['uu_tien'] ?? '') === 'Cao' ? '🟠 ' : '');
        $done = !empty($t['da_xong']) ? '✅ ' : '';

        return "- {$done}{$flag}**{$t['tieu_de']}**" . ($bits ? ' — ' . implode(' · ', $bits) : '');
    }

    /** Short step-by-step answer from the user guide. */
    private function guide(array $sections): string
    {
        $parts = [];
        foreach ($sections as $s) {
            $lines = ["### 💡 {$s['tieu_de']}"];
            foreach (array_values($s['cac_buoc']) as $i => $step) {
                $lines[] = ($i + 1) . '. ' . $step;
            }
            $parts[] = implode("\n", $lines);
        }

        return implode("\n\n", $parts) . "\n\n_Xem thêm ở trang **Hướng dẫn sử dụng** (menu trái, dưới cùng)._";
    }

    private function howTo(): string
    {
        return "### 💡 Giao việc bằng tin nhắn\n"
            . "1. Dán tin nhắn giao việc vào khung chat (mỗi việc **một dòng**, có số thứ tự hoặc **@tên** người phụ trách).\n"
            . "2. Em tách thành từng công việc, đoán **bảng**, **người phụ trách**, **độ gấp**.\n"
            . "3. Anh/chị kiểm tra, sửa nếu cần rồi bấm **Tạo công việc**.";
    }

    private function date(string $ymd): string
    {
        [$y, $m, $d] = explode('-', $ymd);

        return "{$d}/{$m}";
    }
}
