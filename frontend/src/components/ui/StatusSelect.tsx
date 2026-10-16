import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { Column } from '../../types';

interface StatusSelectProps {
  value: string; // columnId
  columns: Column[];
  onChange: (columnId: string) => void;
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const DEFAULT_STATUS_COLORS: Record<string, string> = {
  'chưa bắt đầu': '#7C5CFC',
  'cần làm': '#7C5CFC',
  'todo': '#7C5CFC',
  'đang thực hiện': '#4F7DF3',
  'in progress': '#4F7DF3',
  'doing': '#4F7DF3',
  'chờ duyệt': '#E6A92D',
  'review': '#E6A92D',
  'hoàn thành': '#2FAF83',
  'done': '#2FAF83',
  'completed': '#2FAF83',
};

function getStatusColor(column?: Column): string {
  if (column?.color) return column.color;
  if (!column?.title) return '#94A3B8';
  const lower = column.title.toLowerCase().trim();
  for (const [key, color] of Object.entries(DEFAULT_STATUS_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#94A3B8';
}

export function StatusSelect({
  value,
  columns = [],
  onChange,
  className = '',
  triggerClassName = '',
  size = 'md',
  disabled = false,
}: StatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentColumn = columns.find((c) => String(c.id) === String(value)) || columns[0];
  const currentColor = getStatusColor(currentColumn);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 250 && rect.top > 250) {
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

  const isSmall = size === 'sm';

  return (
    <div
      className={`relative inline-block w-full select-none ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden Native Select for test and form compatibility */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
      >
        {columns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 rounded-xl bg-card border border-border/80 hover:border-primary/50 hover:bg-accent/30 font-semibold text-foreground shadow-xs transition-all outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
          isSmall ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2.5 text-[13px]'
        } ${isOpen ? 'ring-2 ring-primary/20 border-primary shadow-sm' : ''} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0 truncate">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background transition-transform"
            style={{ backgroundColor: currentColor }}
          />
          <span className="truncate font-semibold text-foreground/90">
            {currentColumn ? currentColumn.title : 'Chọn trạng thái'}
          </span>
        </div>

        <ChevronDown
          size={isSmall ? 14 : 16}
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
          } w-full min-w-[190px] z-[70] bg-popover/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-xl shadow-black/10 p-1.5 animate-in fade-in-0 zoom-in-95 duration-150`}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
            {columns.map((col) => {
              const isSelected = String(col.id) === String(value);
              const colColor = getStatusColor(col);

              return (
                <div
                  key={col.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(String(col.id));
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs md:text-[13px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background"
                      style={{ backgroundColor: colColor }}
                    />
                    <span className="truncate">{col.title}</span>
                  </div>

                  {isSelected && (
                    <Check size={15} className="shrink-0 text-primary stroke-[2.5] ml-2" />
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
