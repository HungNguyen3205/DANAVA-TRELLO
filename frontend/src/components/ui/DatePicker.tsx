import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, CalendarCheck } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD or ISO string
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  align?: 'left' | 'right';
  disabled?: boolean;
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function formatDateString(val: string): string {
  if (!val) return '';
  const dateOnly = val.split(' ')[0].split('T')[0];
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateOnly;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className = '',
  triggerClassName = '',
  align = 'left',
  disabled = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [effectiveAlignRight, setEffectiveAlignRight] = useState(align === 'right');
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanDateValue = value ? value.split(' ')[0].split('T')[0] : '';
  
  const [viewDate, setViewDate] = useState(() => {
    if (cleanDateValue) {
      const p = new Date(cleanDateValue);
      if (!isNaN(p.getTime())) return p;
    }
    return new Date();
  });

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 340 && rect.top > 340) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }

      // If near the right side of the screen/container, align to the right edge
      if (align === 'right' || rect.left + 310 > window.innerWidth || rect.right > window.innerWidth - 80) {
        setEffectiveAlignRight(true);
      } else {
        setEffectiveAlignRight(false);
      }
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (cleanDateValue) {
      const parsed = new Date(cleanDateValue);
      if (!isNaN(parsed.getTime())) {
        setViewDate(parsed);
      }
    }
  }, [cleanDateValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const isPrevMonthDisabled =
    currentYear < today.getFullYear() ||
    (currentYear === today.getFullYear() && currentMonth <= today.getMonth());

  const handlePrevMonth = () => {
    if (isPrevMonthDisabled) return;
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleSelectDate = (day: number) => {
    const yyyy = currentYear;
    const mm = String(currentMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const targetDate = `${yyyy}-${mm}-${dd}`;
    if (targetDate < todayStr) return; // Không cho chọn ngày trong quá khứ
    onChange(targetDate);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setViewDate(today);
    setIsOpen(false);
  };

  const handleSetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setViewDate(tomorrow);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  // Generate calendar grid (Monday first)
  const getDaysArray = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Monday is 0, Sunday is 6
    const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
    const arr = [];
    for (let i = 0; i < firstDayIndex; i++) {
      arr.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push(i);
    }
    return arr;
  };


  const displayValue = formatDateString(cleanDateValue);

  return (
    <div className={`relative inline-block w-full select-none ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <div
        onClick={handleToggle}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border/80 hover:border-primary/50 hover:bg-accent/30 text-[13px] font-semibold text-foreground shadow-xs transition-all outline-none focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${
          isOpen ? 'ring-2 ring-primary/20 border-primary shadow-sm' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${triggerClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon size={16} className={`shrink-0 ${displayValue ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`truncate ${displayValue ? 'text-foreground font-semibold' : 'text-muted-foreground font-normal'}`}>
            {displayValue || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {displayValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Xóa ngày"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Calendar Popover */}
      {isOpen && (
        <div
          className={`absolute ${effectiveAlignRight ? 'right-0' : 'left-0'} ${
            openUpward ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
          } p-4 bg-popover/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-xl shadow-black/10 z-[75] w-[300px] animate-in fade-in-0 zoom-in-95 duration-150`}
        >
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 pb-3 mb-3 border-b border-border/70 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={handleSetToday}
              className="px-2.5 py-1 rounded-lg bg-accent/60 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-all"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={handleSetTomorrow}
              className="px-2.5 py-1 rounded-lg bg-accent/60 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-all"
            >
              Ngày mai
            </button>
            {cleanDateValue && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 font-medium transition-all ml-auto"
              >
                Xóa
              </button>
            )}
          </div>

          {/* Month & Year Navigation */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-sm font-bold text-foreground">
              {MONTH_NAMES[currentMonth]}, {currentYear}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={isPrevMonthDisabled}
                className={`p-1.5 rounded-lg transition-colors ${
                  isPrevMonthDisabled
                    ? 'opacity-25 cursor-not-allowed text-muted-foreground'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer'
                }`}
                title={isPrevMonthDisabled ? 'Không thể quay lại tháng trước' : 'Tháng trước'}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                title="Tháng sau"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAY_NAMES.map((d, index) => (
              <div
                key={d}
                className={`text-[11px] font-bold uppercase py-1 ${
                  index >= 5 ? 'text-primary/70' : 'text-muted-foreground'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {getDaysArray().map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="h-8 w-8" />;

              const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast = formattedDay < todayStr;
              const isSelected = cleanDateValue === formattedDay;
              const isToday = todayStr === formattedDay;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleSelectDate(day)}
                  className={`h-8 w-8 mx-auto rounded-xl flex items-center justify-center text-xs transition-all duration-150 ${
                    isPast
                      ? 'opacity-30 cursor-not-allowed text-muted-foreground line-through select-none'
                      : isSelected
                        ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30 scale-105 cursor-pointer'
                        : isToday
                          ? 'border-2 border-primary/60 text-primary font-bold hover:bg-primary/10 cursor-pointer'
                          : 'text-foreground hover:bg-accent/80 hover:text-foreground font-medium cursor-pointer'
                  }`}
                  title={isPast ? 'Không thể chọn ngày trong quá khứ' : undefined}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
