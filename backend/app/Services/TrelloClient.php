<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class TrelloClient
{
    public function readBoard(string $source, string $key, string $token): array
    {
        // Only the board identifier enters the path. Never request a user-supplied URL.
        if (! preg_match('~^(?:https://trello\.com/b/)?([A-Za-z0-9]{8}|[a-f0-9]{24})(?:/[^?#]*)?/?$~', trim($source), $match)) {
            throw ValidationException::withMessages(['board_url' => 'Nhập liên kết bảng Trello hoặc ID bảng hợp lệ.']);
        }
        $path = 'boards/'.$match[1];
        $board = $this->get($path, $key, $token, ['fields' => 'all']);
        $board['lists'] = $this->get($path.'/lists', $key, $token, ['filter' => 'all']);
        $board['cards'] = $this->get($path.'/cards/all', $key, $token, [
            'fields' => 'all', 'attachments' => 'true', 'attachment_fields' => 'all', 'customFieldItems' => 'true',
        ]);
        $board['checklists'] = $this->get($path.'/checklists', $key, $token);
        $board['members'] = $this->get($path.'/members', $key, $token, ['fields' => 'fullName,username']);
        $board['labels'] = $this->get($path.'/labels', $key, $token, ['limit' => 1000]);
        if (count($board['labels']) >= 1000) {
            throw ValidationException::withMessages(['source' => 'Bảng có quá nhiều nhãn. Hãy dùng bản xuất JSON đầy đủ.']);
        }
        $board['customFields'] = $this->get($path.'/customFields', $key, $token);
        $board['actions'] = [];
        $before = null;
        // Trello returns at most 1000 actions per page. Read older pages explicitly.
        do {
            $page = $this->get($path.'/actions', $key, $token, array_filter([
                'filter' => 'all', 'limit' => 1000, 'before' => $before,
            ]));
            $board['actions'] = array_merge($board['actions'], $page);
            $next = $page ? end($page)['id'] : null;
            if ($page && ($next === $before || count($board['actions']) > 100000)) {
                throw ValidationException::withMessages(['source' => 'Lịch sử vượt giới hạn nhập trực tiếp. Hãy xuất JSON.']);
            }
            $before = $next;
        } while (count($page) === 1000);

        return $board;
    }

    private function get(string $path, string $key, string $token, array $query = []): array
    {
        try {
            $response = Http::acceptJson()->withHeaders([
                'Authorization' => 'OAuth oauth_consumer_key="'.$key.'", oauth_token="'.$token.'"',
            ])->connectTimeout(10)->timeout(45)->withOptions(['allow_redirects' => false])
                ->get('https://api.trello.com/1/'.$path, $query);
        } catch (ConnectionException) {
            throw ValidationException::withMessages(['source' => 'Không kết nối được Trello. Vui lòng thử lại.']);
        }

        if (! $response->successful() || ! is_array($response->json())) {
            $message = match ($response->status()) {
                401, 403 => 'API key/token không hợp lệ hoặc tài khoản chưa có quyền đọc bảng.',
                404 => 'Không tìm thấy bảng Trello hoặc tài khoản chưa có quyền truy cập.',
                429 => 'Trello đang giới hạn yêu cầu. Vui lòng đợi rồi thử lại.',
                default => 'Trello chưa trả về dữ liệu đầy đủ. Vui lòng thử lại.',
            };
            // Do not propagate upstream bodies or request details containing credentials.
            throw ValidationException::withMessages(['source' => $message]);
        }

        return $response->json();
    }
}
