import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string | null;
  icon?: ReactNode;
  className?: string;
}

interface PickerProps<T extends string | number> {
  value: T | null;
  options: PickerOption<T>[];
  onChange: (value: T) => void;
  placeholder: string;
  /** Custom trigger content (defaults to the selected label or the placeholder). */
  trigger?: ReactNode;
  triggerClassName?: string;
  /** Text above the list, e.g. what the choice is for. */
  heading?: ReactNode;
  /** Extra row at the end of the list (e.g. "skip"). */
  footer?: { label: string; onSelect: () => void };
  tone?: 'default' | 'warn';
  align?: 'left' | 'right';
  ariaLabel?: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Small dropdown with search, used instead of native <select> inside the chat. */
export function Picker<T extends string | number>({
  value, options, onChange, placeholder, trigger, triggerClassName = '', heading, footer, tone = 'default', align = 'left', ariaLabel,
}: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  const listId = useId();
  const searchable = options.length > 6;
  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? options.filter((o) => fold(`${o.label} ${o.hint ?? ''}`).includes(q)) : options;
  }, [options, query]);

  // The list is fixed to the viewport so the chat's scroll area cannot cut it off;
  // it opens upwards when there is not enough room below.
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, 208), 288, window.innerWidth - 16);
      const left = Math.max(8, Math.min(align === 'right' ? r.right - width : r.left, window.innerWidth - width - 8));
      const below = window.innerHeight - r.bottom - 8;
      const up = below < 240 && r.top > below;
      setPlace({
        position: 'fixed', left, width,
        ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
        maxHeight: Math.max(160, (up ? r.top : below) - 12),
      });
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    if (searchable) window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, searchable]);

  const toggle = () => {
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen((v) => !v);
  };

  const choose = (o: PickerOption<T>) => {
    onChange(o.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation(); // keep the chat open
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && filtered[active]) {
      e.preventDefault();
      choose(filtered[active]);
    }
  };

  const border = tone === 'warn' ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-border bg-card';

  return (
    <div ref={rootRef} className="relative min-w-0" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        className={`w-full inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-lg border text-xs text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${border} ${triggerClassName}`}
      >
        {trigger ?? (
          <>
            {selected?.icon}
            <span className={`flex-1 min-w-0 truncate ${selected ? `text-foreground ${selected.className ?? ''}` : 'text-muted-foreground'}`}>
              {selected?.label ?? placeholder}
            </span>
          </>
        )}
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div style={place} className="z-[80] flex flex-col rounded-xl border border-border bg-card shadow-xl p-1 asst-pop">
          {heading && <div className="px-2.5 pt-1.5 pb-1 text-[11px] text-muted-foreground">{heading}</div>}
          {searchable && (
            <div className="flex items-center gap-1.5 mx-1 mb-1 px-2 h-8 rounded-lg bg-muted/60">
              <Search size={13} className="text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder="Tìm…"
                className="flex-1 min-w-0 bg-transparent text-xs outline-none border-0 p-0 focus:ring-0"
              />
            </div>
          )}
          <ul id={listId} role="listbox" className="min-h-0 flex-1 max-h-56 overflow-y-auto overscroll-contain">
            {filtered.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li key={String(o.value)} role="option" aria-selected={isSel}>
                  <button
                    type="button"
                    onClick={() => choose(o)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left ${i === active ? 'bg-muted' : ''} ${isSel ? 'text-primary font-semibold' : 'text-foreground'}`}
                  >
                    {o.icon}
                    <span className="flex-1 min-w-0">
                      <span className={`block truncate ${o.className ?? ''}`}>{o.label}</span>
                      {o.hint && <span className="block truncate text-[10.5px] text-muted-foreground font-normal">{o.hint}</span>}
                    </span>
                    {isSel && <Check size={13} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-2.5 py-2 text-xs text-muted-foreground">Không tìm thấy</li>}
          </ul>
          {footer && (
            <button
              type="button"
              onClick={() => {
                footer.onSelect();
                setOpen(false);
              }}
              className="w-full mt-1 pt-1.5 pb-1 px-2.5 border-t border-border text-left text-[11px] text-muted-foreground hover:text-foreground"
            >
              {footer.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
