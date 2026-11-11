<?php

namespace App\Support;

/** Accent-insensitive helpers for matching Vietnamese names and keywords. */
class VietnameseText
{
    private const MAP = [
        'à' => 'a', 'á' => 'a', 'ạ' => 'a', 'ả' => 'a', 'ã' => 'a', 'â' => 'a', 'ầ' => 'a', 'ấ' => 'a', 'ậ' => 'a', 'ẩ' => 'a', 'ẫ' => 'a',
        'ă' => 'a', 'ằ' => 'a', 'ắ' => 'a', 'ặ' => 'a', 'ẳ' => 'a', 'ẵ' => 'a',
        'è' => 'e', 'é' => 'e', 'ẹ' => 'e', 'ẻ' => 'e', 'ẽ' => 'e', 'ê' => 'e', 'ề' => 'e', 'ế' => 'e', 'ệ' => 'e', 'ể' => 'e', 'ễ' => 'e',
        'ì' => 'i', 'í' => 'i', 'ị' => 'i', 'ỉ' => 'i', 'ĩ' => 'i',
        'ò' => 'o', 'ó' => 'o', 'ọ' => 'o', 'ỏ' => 'o', 'õ' => 'o', 'ô' => 'o', 'ồ' => 'o', 'ố' => 'o', 'ộ' => 'o', 'ổ' => 'o', 'ỗ' => 'o',
        'ơ' => 'o', 'ờ' => 'o', 'ớ' => 'o', 'ợ' => 'o', 'ở' => 'o', 'ỡ' => 'o',
        'ù' => 'u', 'ú' => 'u', 'ụ' => 'u', 'ủ' => 'u', 'ũ' => 'u', 'ư' => 'u', 'ừ' => 'u', 'ứ' => 'u', 'ự' => 'u', 'ử' => 'u', 'ữ' => 'u',
        'ỳ' => 'y', 'ý' => 'y', 'ỵ' => 'y', 'ỷ' => 'y', 'ỹ' => 'y',
        'đ' => 'd',
    ];

    /** Lowercase, strip accents, collapse whitespace. */
    public static function fold(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        $text = strtr($text, self::MAP);
        // Combining marks left over from decomposed input.
        $text = preg_replace('/\p{Mn}+/u', '', $text);

        return trim(preg_replace('/\s+/u', ' ', $text));
    }

    /** Matching key: folded text with punctuation removed. */
    public static function key(string $text): string
    {
        return trim(preg_replace('/\s+/', ' ', preg_replace('/[^a-z0-9 ]+/', ' ', self::fold($text))));
    }

    /** Significant words of a text (folded, no stop words, length >= 2). */
    public static function words(string $text): array
    {
        static $stop = [
            'va', 'cho', 'cua', 'cac', 'nhung', 'mot', 'len', 'lai', 'gui', 'de', 'la', 'em', 'anh', 'chi', 'co', 'khong',
            'voi', 'trong', 'ngay', 'hom', 'nay', 'giup', 'nhe', 'a', 've', 'tu', 'da', 'se', 'can', 'duoc', 'theo', 'tren',
            'the', 'nao', 'nhom', 'tat', 'ca', 'lam', 'viec', 'cong', 'task', 'done', 'review', 'test', 'truoc', 'khi', 'sau',
        ];
        $words = array_filter(explode(' ', self::key($text)), fn ($w) => mb_strlen($w) >= 2 && !in_array($w, $stop, true));

        return array_values(array_unique($words));
    }
}
