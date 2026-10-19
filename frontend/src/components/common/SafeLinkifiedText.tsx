import React from 'react';

interface SafeLinkifiedTextProps {
  text: string;
  className?: string;
}

// Allowed protocols: http, https, mailto
// Strictly blocked protocols: javascript, data, vbscript
const DISALLOWED_SCHEMES = /^(javascript|data|vbscript):/i;

/**
 * Trims sentence punctuation (periods, commas, exclamation, unmatched parentheses)
 * from the end of a matched URL while preserving balanced internal parentheses
 * like Wikipedia URLs: https://en.wikipedia.org/wiki/React_(software)
 */
function cleanTrailingPunctuation(rawUrl: string): { cleanUrl: string; trailing: string } {
  let url = rawUrl;
  let trailing = '';

  while (url.length > 0) {
    const lastChar = url[url.length - 1];

    // Trailing punctuation commonly found at sentence end
    if (/[.,;:!?'"”’>\]]/.test(lastChar)) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }

    // Trailing closing parenthesis: only strip if unmatched by an opening parenthesis inside url
    if (lastChar === ')' || lastChar === '）') {
      const openCount = (url.match(/[\(（]/g) || []).length;
      const closeCount = (url.match(/[\)）]/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }

    break;
  }

  return { cleanUrl: url, trailing };
}

export const SafeLinkifiedText: React.FC<SafeLinkifiedTextProps> = ({ text, className = '' }) => {
  if (!text) {
    return null;
  }

  // Regex to detect URLs (http://, https://, www.) and email addresses
  // Uses fresh RegExp instance on each call to prevent shared state lastIndex bugs
  const URL_OR_EMAIL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'\u0000-\u001F]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_OR_EMAIL_REGEX.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Push any preceding normal text before the matched URL/Email
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const isEmail = matchText.includes('@') && !matchText.startsWith('http') && !matchText.startsWith('www.');

    if (isEmail) {
      parts.push(
        <a
          key={`email-${matchIndex}`}
          href={`mailto:${matchText}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline cursor-pointer transition-colors inline [overflow-wrap:anywhere] break-words"
          style={{ overflowWrap: 'anywhere' }}
          onClick={(e) => e.stopPropagation()}
          title={`Gửi email: ${matchText}`}
        >
          {matchText}
        </a>
      );
    } else {
      // Clean trailing punctuation attached to end of URL
      const { cleanUrl, trailing } = cleanTrailingPunctuation(matchText);

      let href = cleanUrl;
      // Auto prepend https:// for www. URLs
      if (cleanUrl.toLowerCase().startsWith('www.')) {
        href = `https://${cleanUrl}`;
      }

      // Security check: Only allow http:// and https://; strictly forbid dangerous schemes
      const isAllowedScheme = /^https?:\/\//i.test(href);
      const isDisallowed = DISALLOWED_SCHEMES.test(href);

      if (!isAllowedScheme || isDisallowed) {
        // Render as plain safe text
        parts.push(cleanUrl);
      } else {
        parts.push(
          <a
            key={`url-${matchIndex}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline cursor-pointer transition-colors inline [overflow-wrap:anywhere] break-words"
            style={{ overflowWrap: 'anywhere' }}
            onClick={(e) => {
              // Stop event propagation so clicking link doesn't trigger parent edit mode
              e.stopPropagation();
            }}
            title={`Mở liên kết: ${href}`}
          >
            {cleanUrl}
          </a>
        );
      }

      if (trailing) {
        parts.push(trailing);
      }
    }

    lastIndex = matchIndex + matchText.length;
  }

  // Push remaining text after the last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return (
    <div 
      className={`whitespace-pre-wrap break-words leading-relaxed text-foreground select-text [overflow-wrap:anywhere] ${className}`}
      style={{ overflowWrap: 'anywhere' }}
    >
      {parts}
    </div>
  );
};
