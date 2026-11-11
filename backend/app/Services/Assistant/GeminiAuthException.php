<?php

namespace App\Services\Assistant;

use RuntimeException;

/** The key was rejected by this endpoint (invalid key or wrong kind of key for the endpoint). */
class GeminiAuthException extends RuntimeException
{
}
