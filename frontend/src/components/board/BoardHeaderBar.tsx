import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, MoreHorizontal, Share2, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Board } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { useBoardRoute } from '../layout/BoardRouteContext';
import { BoardMembersHeader } from '../layout/BoardMembersHeader';
import { ShareBoardModal } from '../kanban/ShareBoardModal';

export interface BoardMenuItem {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}

/**
 * The board's tools — title (+ favourite), the view's own tools (search, add task…), members and a
 * "⋯" menu — shown inside the app's top bar (#app-header-slot), so a board has no extra header row.
 * Switching views and going back live in the left sidebar.
 */
export function BoardHeaderBar({
  board,
  star,
  menuItems = [],
  children,
  className = '',
}: {
  board: Board;
  star?: { active: boolean; onToggle: () => void };
  menuItems?: BoardMenuItem[];
  children?: ReactNode;
  className?: string;
}) {
  const { basePath } = useBoardRoute();
  const user = useAuthStore((s) => s.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // The slot lives in the app's top bar (outside React's tree for this page).
  const [slot, setSlot] = useState<HTMLElement | null>(() => document.getElementById('app-header-slot'));

  // On a direct page load the top bar may not be in the DOM during the first render yet.
  useLayoutEffect(() => {
    if (slot) return;
    const found = document.getElementById('app-header-slot');
    // eslint-disable-next-line react/set-state-in-effect -- syncing with a DOM node outside this component
    if (found) setSlot(found);
  }, [slot]);

  const canManage = Boolean(
    board.is_owner ||
      board.my_role === 'owner' ||
      board.my_role === 'admin' ||
      (user && board.owner_id && String(board.owner_id) === String(user.id)) ||
      (user && board.users?.some((u) => String(u.id) === String(user.id) && (u.role === 'admin' || u.role === 'owner'))),
  );

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const items: BoardMenuItem[] = [
    ...menuItems,
    { icon: <Share2 size={16} className="text-sky-600 dark:text-sky-400" />, label: 'Chia sẻ bảng', hint: 'Link mời, quyền truy cập', onClick: () => setShareOpen(true) },
  ];

  const content = (
    <div className={`flex items-center gap-1.5 sm:gap-2 min-w-0 w-full ${slot ? 'pl-2 sm:pl-3 ml-1 sm:ml-2 border-l border-border' : className}`}>
      <div className="flex items-center gap-0.5 min-w-0 flex-1">
        {board.project && (
          <>
            <Link to={`/projects/${board.project.id}`} title={`Dự án: ${board.project.name}`}
              className="hidden sm:block max-w-[12rem] truncate text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              {board.project.name}
            </Link>
            <ChevronRight size={14} className="hidden sm:block shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </>
        )}
        <h1 className="text-sm sm:text-[15px] font-bold tracking-tight text-foreground truncate" title={board.title}>
          {board.title}
        </h1>
        {star && (
          <button
            type="button"
            onClick={star.onToggle}
            title={star.active ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
            aria-label={star.active ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
            aria-pressed={star.active}
            className="w-7 h-7 shrink-0 grid place-items-center rounded-full hover:bg-amber-500/10 transition-colors active:scale-90"
          >
            <Star size={15} className={star.active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground hover:text-amber-500'} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {children}

        <div className="hidden lg:flex items-center shrink-0">
          <BoardMembersHeader users={board.users} basePath={basePath} />
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Thêm thao tác"
            aria-label="Thêm thao tác"
            className={`w-8 h-8 grid place-items-center rounded-full transition-colors ${menuOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              {items.map((it) => (
                <button
                  key={it.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    it.onClick();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-accent transition-colors"
                >
                  <span className="w-8 h-8 shrink-0 rounded-full bg-muted grid place-items-center">{it.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{it.label}</span>
                    {it.hint && <span className="block text-[11px] text-muted-foreground truncate">{it.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );

  return (
    <>
      {slot ? createPortal(content, slot) : content}
      {shareOpen && <ShareBoardModal isOpen={shareOpen} board={board} canManage={canManage} onClose={() => setShareOpen(false)} />}
    </>
  );
}
