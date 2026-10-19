/**
 * Resolve full avatar URL.
 * Supports absolute URLs, data URIs, or relative backend storage paths.
 */
export function getAvatarUrl(avatarPath?: string | null, _fallbackName?: string): string {
  if (!avatarPath) return '';
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://') || avatarPath.startsWith('data:')) {
    return avatarPath;
  }

  // Get base API URL from environment
  const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api');
  
  // Extract server origin (strip /api suffix if present)
  let backendOrigin = '';
  try {
    if (apiUrl.startsWith('http')) {
      const parsed = new URL(apiUrl);
      backendOrigin = parsed.origin;
    } else {
      // Relative path: current window origin
      backendOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    }
  } catch {
    backendOrigin = '';
  }

  const cleanPath = avatarPath.startsWith('/') ? avatarPath : `/${avatarPath}`;
  return `${backendOrigin}${cleanPath}`;
}
