import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

/**
 * Left navigation shared by the personal, board and workspace areas.
 * Desktop: can collapse to an icon rail (remembered). The current page shows as a filled round button.
 * Phone: slides in as a drawer, always with labels.
 */

interface SidebarCtx {
  collapsed: boolean;
  showTip: (label: string, el: HTMLElement) => void;
  hideTip: () => void;
}

const Ctx = createContext<SidebarCtx>({ collapsed: false, showTip: () => {}, hideTip: () => {} });

export function SidebarShell({ children, header }: { children: ReactNode; header?: ReactNode }) {
  const { isMobileSidebarOpen, closeMobileSidebar, isSidebarCollapsed, toggleSidebarCollapsed } = useUIStore();
  // The phone drawer always shows labels.
  const collapsed = isSidebarCollapsed && !isMobileSidebarOpen;
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);

  const showTip = useCallback((label: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  return (
    <Ctx.Provider value={{ collapsed, showTip, hideTip }}>
      {isMobileSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={closeMobileSidebar} />}

      <aside
        data-collapsed={collapsed || undefined}
        className={`group/sidebar border-r border-border bg-card flex flex-col shrink-0 absolute md:relative z-50 h-full transition-[width,transform] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
          collapsed ? 'w-[72px]' : 'w-64'
        } ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Collapse / expand button, inside the menu (desktop only) */}
        <div className={`hidden md:flex shrink-0 items-center h-12 px-3.5 pt-2 ${collapsed ? 'justify-center' : 'justify-end'}`}>
          <button
            type="button"
            onClick={() => {
              hideTip();
              toggleSidebarCollapsed();
            }}
            className="w-9 h-9 rounded-full grid place-items-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {header && !collapsed && header}

        {/* Items stretch to fill the height and shrink on short screens, so the menu fits without scrolling. */}
        <nav className="flex-1 min-h-0 flex flex-col px-3.5 pb-3 overflow-y-auto overflow-x-hidden scrollbar-none" onScroll={hideTip}>
          {children}
        </nav>
      </aside>

      {tip && collapsed && (
        <div
          role="tooltip"
          style={{ top: tip.top, left: tip.left }}
          className="fixed z-[70] -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold shadow-lg pointer-events-none animate-in fade-in duration-100"
        >
          {tip.label}
        </div>
      )}
    </Ctx.Provider>
  );
}

function useTip(label: string) {
  const { collapsed, showTip, hideTip } = useContext(Ctx);
  return {
    collapsed,
    handlers: collapsed
      ? {
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(label, e.currentTarget),
          onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(label, e.currentTarget),
          onMouseLeave: hideTip,
          onBlur: hideTip,
          onClick: hideTip,
        }
      : {},
  };
}

const labelClass = (collapsed: boolean) =>
  `min-w-0 truncate whitespace-nowrap transition-[opacity,transform] duration-300 ${collapsed ? 'opacity-0 -translate-x-2 pointer-events-none' : 'opacity-100'}`;

export function SidebarItem({ icon, label, to, active = false }: { icon: ReactNode; label: string; to: string; active?: boolean }) {
  const { collapsed, handlers } = useTip(label);
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      {...handlers}
      className={`group/item flex-1 min-h-[30px] max-h-[46px] flex items-center gap-3 pl-1 pr-3 my-px rounded-full text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        active && !collapsed ? 'bg-primary/[0.07]' : ''
      }`}
    >
      {/* The current page is a filled round button */}
      <span
        className={`shrink-0 h-[min(36px,calc(100%-4px))] aspect-square rounded-full grid place-items-center transition-all duration-300 ${
          active
            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105'
            : 'text-muted-foreground group-hover/item:bg-muted group-hover/item:text-foreground'
        }`}
      >
        {icon}
      </span>
      <span className={`${labelClass(collapsed)} ${active ? 'text-primary font-semibold' : 'text-muted-foreground group-hover/item:text-foreground'}`}>{label}</span>
    </Link>
  );
}

/** Section title; a short divider when collapsed. */
export function SidebarSection({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { collapsed } = useContext(Ctx);
  return (
    <div className="flex-1 min-h-[12px] max-h-[44px] first:max-h-[28px] flex items-end pb-1.5">
      {collapsed ? (
        <span className="mx-auto w-6 h-px bg-border" aria-hidden="true" />
      ) : (
        <div className={`px-3 text-[11px] font-bold uppercase tracking-[0.14em] whitespace-nowrap text-muted-foreground ${className}`}>{children}</div>
      )}
    </div>
  );
}

export function SidebarBack({ to, label }: { to: string; label: string }) {
  const { collapsed, handlers } = useTip(label);
  return (
    <Link
      to={to}
      aria-label={collapsed ? label : undefined}
      {...handlers}
      className="group/item flex-1 min-h-[30px] max-h-[44px] flex items-center gap-3 pl-1 pr-3 rounded-full text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="shrink-0 h-[min(36px,calc(100%-4px))] aspect-square rounded-full grid place-items-center border border-dashed border-border group-hover/item:border-primary/50 group-hover/item:text-primary transition-colors">
        <ArrowLeft size={16} />
      </span>
      <span className={labelClass(collapsed)}>{label}</span>
    </Link>
  );
}
