<?php

namespace App\Services\Assistant;

use App\Models\AssistantMessage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use ZipArchive;

/**
 * Files people attach in the assistant chat: images, voice recordings, PDFs and documents.
 * Stored on the private disk; only reachable through short-lived signed links.
 *
 * Kinds:
 *  - image / audio / pdf: sent to Gemini as inline data
 *  - text / docx / xlsx: their text is extracted and given to the assistant (also works without AI)
 */
class AssistantAttachments
{
    public const MAX_FILES = 5;
    public const MAX_KB = 10240;
    /** Total raw bytes sent inline to Gemini in one request (base64 grows ~33%, Google caps requests at 20 MB). */
    private const MAX_INLINE_BYTES = 14 * 1024 * 1024;
    private const MAX_TEXT_CHARS = 30000;
    private const DISK = 'local';

    /** extension => [kind, mime sent to Gemini, accepted detected mime prefixes] */
    private const TYPES = [
        'jpg' => ['image', 'image/jpeg', ['image/jpeg']],
        'jpeg' => ['image', 'image/jpeg', ['image/jpeg']],
        'png' => ['image', 'image/png', ['image/png']],
        'webp' => ['image', 'image/webp', ['image/webp']],
        'heic' => ['image', 'image/heic', ['image/heic', 'image/heif', 'application/octet-stream']],
        'heif' => ['image', 'image/heif', ['image/heic', 'image/heif', 'application/octet-stream']],
        'pdf' => ['pdf', 'application/pdf', ['application/pdf']],
        'wav' => ['audio', 'audio/wav', ['audio/']],
        'mp3' => ['audio', 'audio/mp3', ['audio/', 'application/octet-stream']],
        'ogg' => ['audio', 'audio/ogg', ['audio/', 'application/ogg', 'video/ogg']],
        'm4a' => ['audio', 'audio/mp4', ['audio/', 'video/mp4', 'video/quicktime', 'application/octet-stream']],
        'aac' => ['audio', 'audio/aac', ['audio/', 'application/octet-stream']],
        'flac' => ['audio', 'audio/flac', ['audio/']],
        'webm' => ['audio', 'audio/webm', ['audio/webm', 'video/webm']],
        'txt' => ['text', 'text/plain', ['text/', 'application/octet-stream', 'inode/x-empty']],
        'csv' => ['text', 'text/csv', ['text/', 'application/csv', 'application/octet-stream']],
        'md' => ['text', 'text/markdown', ['text/', 'application/octet-stream']],
        'json' => ['text', 'application/json', ['text/', 'application/json']],
        'docx' => ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ['application/vnd.openxmlformats', 'application/zip', 'application/octet-stream']],
        'xlsx' => ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ['application/vnd.openxmlformats', 'application/zip', 'application/octet-stream']],
    ];

    public static function acceptedExtensions(): array
    {
        return array_keys(self::TYPES);
    }

    /**
     * Validate and store uploaded files for a user.
     *
     * @param UploadedFile[] $files
     * @return array<int, array{id: string, name: string, mime: string, size: int, kind: string, path: string}>
     */
    public function store(int $userId, array $files): array
    {
        $out = [];
        foreach (array_values($files) as $i => $file) {
            $ext = strtolower($file->getClientOriginalExtension());
            $type = self::TYPES[$ext] ?? null;
            // Detect the type from the bytes, not from the name the browser sent.
            $detected = (string) finfo_file(finfo_open(FILEINFO_MIME_TYPE), $file->getRealPath());
            if (!$type || !$this->mimeMatches($detected, $type[2])) {
                throw ValidationException::withMessages([
                    "attachments.$i" => 'Tệp "' . $file->getClientOriginalName() . '" không được hỗ trợ. Em nhận ảnh (JPG, PNG, WEBP), ghi âm, PDF, Word (.docx), Excel (.xlsx) và tệp văn bản (.txt, .csv).',
                ]);
            }
            $id = (string) Str::uuid();
            $path = $file->storeAs("assistant/{$userId}", "{$id}.{$ext}", self::DISK);
            $out[] = [
                'id' => $id,
                'name' => mb_substr($file->getClientOriginalName() ?: "tep.{$ext}", 0, 150),
                'mime' => $type[1],
                'size' => (int) $file->getSize(),
                'kind' => $type[0],
                'path' => $path,
            ];
        }

        return $out;
    }

    private function mimeMatches(string $detected, array $accepted): bool
    {
        foreach ($accepted as $prefix) {
            if (str_starts_with($detected, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /** Gemini parts (inline data) for images, PDFs and audio, within the request size budget. */
    public function inlineParts(array $attachments, array $kinds = ['image', 'pdf', 'audio']): array
    {
        $parts = [];
        $budget = self::MAX_INLINE_BYTES;
        foreach ($attachments as $a) {
            if (!in_array($a['kind'], $kinds, true) || $a['size'] > $budget) {
                continue;
            }
            $bytes = Storage::disk(self::DISK)->get($a['path']);
            if ($bytes === null) {
                continue;
            }
            $budget -= strlen($bytes);
            $parts[] = ['inlineData' => ['mimeType' => $a['mime'], 'data' => base64_encode($bytes)]];
        }

        return $parts;
    }

    /** Text from text / Word / Excel attachments, labelled with the file name. */
    public function extractedText(array $attachments): string
    {
        $chunks = [];
        $left = self::MAX_TEXT_CHARS;
        foreach ($attachments as $a) {
            if ($left <= 0 || !in_array($a['kind'], ['text', 'docx', 'xlsx'], true)) {
                continue;
            }
            $full = Storage::disk(self::DISK)->path($a['path']);
            $text = match ($a['kind']) {
                'text' => (string) @file_get_contents($full),
                'docx' => self::docxText($full),
                'xlsx' => self::xlsxText($full),
            };
            $text = trim(mb_convert_encoding($text, 'UTF-8', 'UTF-8'));
            if ($text === '') {
                continue;
            }
            $text = mb_substr($text, 0, $left);
            $left -= mb_strlen($text);
            $chunks[] = $text;
        }

        return implode("\n\n", $chunks);
    }

    public static function docxText(string $path): string
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return '';
        }
        $xml = (string) $zip->getFromName('word/document.xml');
        $zip->close();
        // Paragraphs and line breaks become new lines, tabs stay tabs.
        $xml = preg_replace(['#</w:p>#', '#<w:br[^>]*/>#', '#<w:tab[^>]*/>#'], ["\n", "\n", "\t"], $xml);

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    /** Every sheet as tab-separated rows. */
    public static function xlsxText(string $path): string
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            return '';
        }
        $shared = [];
        if (($s = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
            $sx = @simplexml_load_string($s);
            foreach ($sx?->si ?? [] as $si) {
                $shared[] = trim(implode('', array_map('strval', $si->xpath('.//*[local-name()="t"]') ?: [])));
            }
        }
        $lines = [];
        for ($i = 1; $i <= 20 && ($sheet = $zip->getFromName("xl/worksheets/sheet{$i}.xml")) !== false; $i++) {
            $sx = @simplexml_load_string($sheet);
            foreach ($sx?->sheetData->row ?? [] as $row) {
                $cells = [];
                foreach ($row->c as $c) {
                    $value = (string) ($c->v ?? '');
                    $type = (string) $c['t'];
                    if ($type === 's') {
                        $value = $shared[(int) $value] ?? '';
                    } elseif ($type === 'inlineStr') {
                        $value = trim(implode('', array_map('strval', $c->xpath('.//*[local-name()="t"]') ?: [])));
                    }
                    $cells[] = $value;
                }
                if (trim(implode('', $cells)) !== '') {
                    $lines[] = rtrim(implode("\t", $cells));
                }
            }
        }
        $zip->close();

        return implode("\n", $lines);
    }

    /** Public info for the chat UI (no storage paths), with a signed link valid for a day. */
    public function present(AssistantMessage $message): array
    {
        return array_map(fn ($a) => [
            'id' => $a['id'],
            'name' => $a['name'],
            'mime' => $a['mime'],
            'size' => $a['size'],
            'kind' => $a['kind'],
            'url' => URL::temporarySignedRoute('assistant.file', now()->addDay(), ['message' => $message->id, 'file' => $a['id']], absolute: false),
        ], $message->meta['attachments'] ?? []);
    }

    public function find(AssistantMessage $message, string $fileId): ?array
    {
        foreach ($message->meta['attachments'] ?? [] as $a) {
            if ($a['id'] === $fileId) {
                return $a;
            }
        }

        return null;
    }

    public function deleteFor(iterable $messages): void
    {
        $paths = [];
        foreach ($messages as $m) {
            foreach ($m->meta['attachments'] ?? [] as $a) {
                $paths[] = $a['path'];
            }
        }
        if ($paths) {
            Storage::disk(self::DISK)->delete($paths);
        }
    }

    public function deleteAllFor(int $userId): void
    {
        Storage::disk(self::DISK)->deleteDirectory("assistant/{$userId}");
    }

    public static function disk(): string
    {
        return self::DISK;
    }
}
