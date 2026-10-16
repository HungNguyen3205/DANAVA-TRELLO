import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Flame, ArrowUp, Minus, ArrowDown } from 'lucide-react';
import type { Priority } from '../../types';

interface PriorityConfig {
  value: Priority;
  label: string;
  icon: React.ReactNode;
  dotColor: string;
  badgeClass: string;
  description: string;
}

const PRIORITIES: PriorityConfig[] = [
  {
    value: 'Thấp',
    label: 'Thấp',
    icon: <ArrowDown size={14} className="text-slate-500 dark:text-slate-400" />,
    dotColor: 'bg-slate-400 dark:bg-slate-500',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-400/30',
    description: 'Có thể làm sau, không vội',
  },
  {
    value: 'Bình thường',
    label: 'Bình thường',
    icon: <Minus size={14} className="text-blue-500 dark:text-blue-400" />,
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    description: 'Tiến độ công việc tiêu chuẩn',
  },
  {
    value: 'Cao',
    label: 'Cao',
    icon: <ArrowUp size={14} className="text-amber-500 dark:text-amber-400" />,
    dotColor: 'bg-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    description: 'Ưu tiên hoàn thành sớm',
  },
  {
    value: 'Khẩn cấp',
    label: 'Khẩn cấp',
    icon: <Flame size={14} className="text-rose-500 dark:text-rose-400 animate-pulse" />,
    dotColor: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    description: 'Cần giải quyết ngay lập tức',
  },
];

interface PrioritySelectProps {
  value?: Priority;
  onChange: (value: Priority) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function PrioritySelect({
  value = 'Bình thường',
  onChange,
  className = '',
  triggerClassName = '',
  disabled = false,
}: PrioritySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const current = PRIORITIES.find((p) => p.value === value) || PRIORITIES[1];

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 260 && rect.top > 260) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div
      className={`relative inline-block w-full select-none ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden Native Select for test and form compatibility */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Priority)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
      >
        {PRIORITIES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl bg-card border border-border/80 hover:border-primary/50 hover:bg-accent/30 text-[13px] font-semibold text-foreground shadow-xs transition-all outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          isOpen ? 'ring-2 ring-primary/20 border-primary shadow-sm' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${current.badgeClass}`}>
            {current.icon}
            <span>{current.label}</span>
          </span>
        </div>

        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 ${
            openUpward ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
          } w-full min-w-[220px] z-[70] bg-popover/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-xl shadow-black/10 p-1.5 animate-in fade-in-0 zoom-in-95 duration-150`}
        >
          <div className="space-y-1">
            {PRIORITIES.map((item) => {
              const isSelected = item.value === value;

              return (
                <div
                  key={item.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(item.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent/80 text-foreground font-semibold shadow-xs'
                      : 'hover:bg-accent/50 text-foreground/80 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${item.badgeClass}`}>
                      {item.icon}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-semibold text-foreground leading-snug">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground line-clamp-1 leading-none mt-0.5">
                        {item.description}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={16} className="shrink-0 text-primary stroke-[2.5] ml-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
