import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SafeLinkifiedText } from '../src/components/common/SafeLinkifiedText';

describe('SafeLinkifiedText Component Tests', () => {
  it('1. Renders a single URL properly with link styling and attributes', () => {
    render(<SafeLinkifiedText text="Truy cập https://danava.vn ngay hôm nay" />);
    
    const link = screen.getByRole('link', { name: 'https://danava.vn' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://danava.vn');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(link.className).toContain('text-blue-600');
    expect(link.className).toContain('font-medium');
    expect(link.className).toContain('hover:underline');
  });

  it('2. Renders multiple URLs in one text', () => {
    const text = 'Website: https://danava.vn và GitHub: https://github.com/HungNguyen3205/DANAVA-TRELLO';
    render(<SafeLinkifiedText text={text} />);

    const link1 = screen.getByRole('link', { name: 'https://danava.vn' });
    const link2 = screen.getByRole('link', { name: 'https://github.com/HungNguyen3205/DANAVA-TRELLO' });

    expect(link1.getAttribute('href')).toBe('https://danava.vn');
    expect(link2.getAttribute('href')).toBe('https://github.com/HungNguyen3205/DANAVA-TRELLO');
  });

  it('3. Renders URL placed in the middle of a sentence without losing surrounding text', () => {
    const text = 'Tài liệu dự án: https://danava.vn để xem thông tin chi tiết.';
    const { container } = render(<SafeLinkifiedText text={text} />);

    expect(container.textContent).toBe('Tài liệu dự án: https://danava.vn để xem thông tin chi tiết.');
    const link = screen.getByRole('link', { name: 'https://danava.vn' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://danava.vn');
  });

  it('4. Handles URLs with complex query strings, hashes, and parameters', () => {
    const text = 'Tra cứu tại https://danava.vn/search?q=trello&page=2#section-results nhanh chóng.';
    render(<SafeLinkifiedText text={text} />);

    const link = screen.getByRole('link', { name: 'https://danava.vn/search?q=trello&page=2#section-results' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://danava.vn/search?q=trello&page=2#section-results');
  });

  it('5. Cleans trailing punctuation such as periods, commas, and unmatched parentheses', () => {
    const text1 = 'Xem tại https://danava.vn.';
    const { container: c1 } = render(<SafeLinkifiedText text={text1} />);
    const link1 = c1.querySelector('a');
    expect(link1).toBeDefined();
    expect(link1?.getAttribute('href')).toBe('https://danava.vn');
    expect(c1.textContent).toBe('Xem tại https://danava.vn.');

    const text2 = 'Thông tin trong ngoặc (https://danava.vn) rất hữu ích.';
    const { container: c2 } = render(<SafeLinkifiedText text={text2} />);
    const link2 = c2.querySelector('a');
    expect(link2).toBeDefined();
    expect(link2?.getAttribute('href')).toBe('https://danava.vn');
    expect(c2.textContent).toBe('Thông tin trong ngoặc (https://danava.vn) rất hữu ích.');

    // Preserves balanced internal parentheses
    const text3 = 'Wikipedia https://en.wikipedia.org/wiki/React_(software) là thư viện.';
    const { container: c3 } = render(<SafeLinkifiedText text={text3} />);
    const link3 = c3.querySelector('a');
    expect(link3).toBeDefined();
    expect(link3?.getAttribute('href')).toBe('https://en.wikipedia.org/wiki/React_(software)');
  });

  it('6. Automatically prepends https:// for URLs starting with www. while preserving display text', () => {
    render(<SafeLinkifiedText text="Truy cập www.google.com để tìm kiếm." />);

    const link = screen.getByRole('link', { name: 'www.google.com' });
    expect(link).toBeDefined();
    expect(link.textContent).toBe('www.google.com');
    expect(link.getAttribute('href')).toBe('https://www.google.com');
  });

  it('7. Renders plain text without any URLs normally', () => {
    const text = 'Đây là mô tả công việc thông thường không chứa bất kỳ đường link nào.';
    const { container } = render(<SafeLinkifiedText text={text} />);

    expect(screen.queryByRole('link')).toBeNull();
    expect(container.textContent).toBe(text);
  });

  it('8. Handles very long URLs with overflow wrap styles', () => {
    const longUrl = 'https://danava.vn/very/long/nested/path/to/resource/with/parameters?parameter1=value1&parameter2=value2&parameter3=value3&token=abcdef1234567890';
    render(<SafeLinkifiedText text={`Link: ${longUrl}`} />);

    const link = screen.getByRole('link', { name: longUrl });
    expect(link).toBeDefined();
    expect(link.style.overflowWrap).toBe('anywhere');
    expect(link.className).toContain('break-words');
  });

  it('9. Strictly blocks dangerous schemes like javascript:, data:, and vbscript:', () => {
    const dangerousText = 'javascript:alert(1) và data:text/html,<script>alert(2)</script>';
    render(<SafeLinkifiedText text={dangerousText} />);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('10. Prevents HTML script tags from executing and renders them safely as text', () => {
    const xss = '<script>window.__hacked = true;</script>https://danava.vn';
    const { container } = render(<SafeLinkifiedText text={xss} />);

    // Script tag is not rendered as DOM element, but as safe text node
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<script>window.__hacked = true;</script>');
    const link = screen.getByRole('link', { name: 'https://danava.vn' });
    expect(link).toBeDefined();
  });

  it('11. Preserves Vietnamese characters and line breaks (whitespace-pre-wrap)', () => {
    const multiline = `Dòng 1: Mô tả dự án bằng tiếng Việt có dấu.
Dòng 2: https://danava.vn
Dòng 3: Kết thúc công việc thành công tốt đẹp!`;
    const { container } = render(<SafeLinkifiedText text={multiline} />);

    expect((container.firstChild as HTMLElement)?.classList.contains('whitespace-pre-wrap')).toBe(true);
    expect(container.textContent).toBe(multiline);
    const link = screen.getByRole('link', { name: 'https://danava.vn' });
    expect(link.getAttribute('href')).toBe('https://danava.vn');
  });

  it('12. Supports email mailto links safely', () => {
    render(<SafeLinkifiedText text="Liên hệ contact@danava.vn để nhận hỗ trợ." />);

    const link = screen.getByRole('link', { name: 'contact@danava.vn' });
    expect(link.getAttribute('href')).toBe('mailto:contact@danava.vn');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer nofollow');
  });
});
