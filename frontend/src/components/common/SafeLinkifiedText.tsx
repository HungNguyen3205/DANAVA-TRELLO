import React from 'react';

interface SafeLinkifiedTextProps {
  text: string;
  className?: string;
}

// Regex to detect URLs (http, https, www) and email addresses
const URL_OR_EMAIL_REGEX = /((?:https?:\/\/|www\.)[^\s<>()]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

// Forbidden protocols to strictly block XSS vectors
const DISALLOWED_SCHEMES = /^(javascript|data|vbscript):/i;

export const SafeLinkifiedText: React.FC<SafeLinkifiedTextProps> = ({ text, className = '' }) => {
  if (!text) {
    return null;
  }

  // Tokenize string safely into React virtual DOM nodes without dangerouslySetInnerHTML
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex index
  URL_OR_EMAIL_REGEX.lastIndex = 0;

  while ((match = URL_OR_EMAIL_REGEX.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchText = match[0];

    // Push any text preceding the matched URL/Email
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    const isEmail = matchText.includes('@') && !matchText.startsWith('http') && !matchText.startsWith('www.');

    if (isEmail) {
      // Email link
      parts.push(
        <a
          key={`email-${matchIndex}`}
          href={`mailto:${matchText}`}
          className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium inline-flex items-baseline"
          onClick={(e) => e.stopPropagation()}
        >
          {matchText}
        </a>
      );
    } else {
      // Clean trailing punctuation commonly typed right after URLs like periods, commas, closing parentheses
      let cleanUrl = matchText;
      let trailingPunctuation = '';
      const trailingMatch = cleanUrl.match(/[.,;:!?)\]]+$/);
      if (trailingMatch) {
        trailingPunctuation = trailingMatch[0];
        cleanUrl = cleanUrl.slice(0, -trailingPunctuation.length);
      }

      let href = cleanUrl;
      if (cleanUrl.toLowerCase().startsWith('www.')) {
        href = `https://${cleanUrl}`;
      }

      // Strict security validation against XSS schemes
      if (DISALLOWED_SCHEMES.test(href)) {
        parts.push(matchText);
      } else {
        parts.push(
          <a
            key={`url-${matchIndex}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer font-medium break-all transition-colors inline"
            onClick={(e) => e.stopPropagation()}
            title={`Mở liên kết: ${href}`}
          >
            {cleanUrl}
          </a>
        );
        if (trailingPunctuation) {
          parts.push(trailingPunctuation);
        }
      }
    }

    lastIndex = matchIndex + matchText.length;
  }

  // Push remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return (
    <div className={`whitespace-pre-wrap break-words leading-relaxed ${className}`}>
      {parts}
    </div>
  );
};
