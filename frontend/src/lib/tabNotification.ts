/**
 * Helper to update browser tab title and favicon badge with unread notification count
 * similar to Facebook / Messenger.
 */

let originalFaviconHref = '/logo.jpg';

export const updateTabNotification = (unreadCount: number) => {
  const baseTitle = 'DANAVA WORK – Bảng công việc';

  // 1. Update Document Title: (5) DANAVA WORK – Bảng công việc
  if (unreadCount > 0) {
    const displayCount = unreadCount > 99 ? '99+' : unreadCount;
    document.title = `(${displayCount}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }

  // 2. Update Favicon with red notification badge
  const favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!favicon) return;

  if (unreadCount <= 0) {
    favicon.href = originalFaviconHref;
    return;
  }

  const img = new Image();
  img.src = originalFaviconHref;
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw base logo
      ctx.drawImage(img, 0, 0, 64, 64);

      // Draw notification badge: crisp red dot with white border at top-right
      const badgeX = 50;
      const badgeY = 14;
      const badgeRadius = 12;

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius + 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#EF4444'; // Red
      ctx.fill();

      favicon.href = canvas.toDataURL('image/png');
    } catch {
      // Fallback
    }
  };
};

export const notifyNotificationsUpdated = (count?: number) => {
  window.dispatchEvent(new CustomEvent('notifications_updated', { detail: { count } }));
};
