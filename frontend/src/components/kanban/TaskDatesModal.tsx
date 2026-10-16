import React, { useState, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X, Trash2, Check } from 'lucide-react';

interface TaskDatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  onSave: (dates: { startDate?: string; dueDate?: string }) => void;
}

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function formatDateFull(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split(' ')[0].split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

export function TaskDatesModal({
  isOpen,
  onClose,
  startDate: initialStartDate = '',
  dueDate: initialDueDate = '',
  onSave,
}: TaskDatesModalProps) {
  // Gom ngày bắt đầu và ngày kết thúc thành 1 ngày duy nhất
  const [selectedDate, setSelectedDate] = useState('');
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    if (isOpen) {
      // Ưu tiên dueDate hoặc startDate hiện tại làm ngày mặc định
      const target = (initialDueDate || initialStartDate || '').split(' ')[0].split('T')[0];
      setSelectedDate(target);

      if (target) {
        const p = new Date(target);
        if (!isNaN(p.getTime())) {
          setViewDate(p);
        } else {
          setViewDate(new Date());
        }
      } else {
        setViewDate(new Date());
      }
    }
  }, [isOpen, initialStartDate, initialDueDate]);

  if (!isOpen) return null;

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const formatted = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(formatted);
  };

  const handleQuickPreset = (daysOffset: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    const formatted = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    setSelectedDate(formatted);
    setViewDate(target);
  };

  const handleSave = () => {
    // Lưu cùng 1 ngày cho cả startDate và dueDate
    onSave({
      startDate: selectedDate || '',
      dueDate: selectedDate || '',
    });
    onClose();
  };

  const handleClearAll = () => {
    setSelectedDate('');
    onSave({ startDate: '', dueDate: '' });
    onClose();
  };

  // Lưới ngày (Thứ 2 đến Chủ nhật)
  const getDaysArray = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
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

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 pt-14 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[310px] sm:max-w-[320px] bg-card rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gọn gàng */}
        <div className="px-3.5 py-2.5 border-b border-border/80 flex items-center justify-between bg-card">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CalendarDays size={14} />
            </div>
            <h3 className="text-[13px] font-bold text-foreground">Chọn ngày</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Khối hiển thị ngày đã chọn và nút nhanh */}
        <div className="p-3 pb-0 bg-card space-y-2">
          {/* Hiển thị ngày được chọn */}
          <div className="p-2.5 bg-accent/40 border border-primary/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Hạn chót:</span>
              <span className="text-xs font-bold text-foreground">
                {selectedDate ? formatDateFull(selectedDate) : 'Chưa đặt hạn'}
              </span>
            </div>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="p-1 hover:bg-card rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Bỏ chọn"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Quick Presets - Phím chọn nhanh */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleQuickPreset(0)}
              className="px-2 py-0.5 rounded-md bg-accent/70 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-all shrink-0 cursor-pointer"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(1)}
              className="px-2 py-0.5 rounded-md bg-accent/70 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-all shrink-0 cursor-pointer"
            >
              Ngày mai
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(3)}
              className="px-2 py-0.5 rounded-md bg-accent/70 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-all shrink-0 cursor-pointer"
            >
              +3 ngày
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset(7)}
              className="px-2 py-0.5 rounded-md bg-accent/70 hover:bg-primary hover:text-primary-foreground text-foreground font-medium transition-all shrink-0 cursor-pointer"
            >
              +1 Tuần
            </button>
          </div>
        </div>

        {/* Thân Lịch */}
        <div className="p-3 pt-2 bg-card">
          {/* Điều hướng Tháng / Năm */}
          <div className="flex items-center justify-between mb-2 px-0.5">
            <span className="text-xs font-bold text-foreground">
              {MONTH_NAMES[currentMonth]}, {currentYear}
            </span>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                title="Tháng trước"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-accent rounded-md transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                title="Tháng sau"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Tiêu đề Thứ (T2 - CN) */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {WEEKDAY_NAMES.map((d, index) => (
              <div
                key={d}
                className={`text-[10px] font-bold uppercase py-0.5 ${
                  index >= 5 ? 'text-primary/70' : 'text-muted-foreground'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Lưới Ngày */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {getDaysArray().map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="h-7 w-7" />;

              const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedDate === formattedDay;
              const isToday = todayStr === formattedDay;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center text-[11px] transition-all relative cursor-pointer ${
                    isSelected
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs scale-105 z-10'
                      : isToday
                        ? 'border border-primary/70 text-primary font-bold hover:bg-primary/10'
                        : 'text-foreground hover:bg-accent/80 hover:text-foreground font-medium'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Hành Động */}
        <div className="px-3.5 py-2.5 border-t border-border/80 bg-muted/20 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Xóa ngày</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              <Check size={13} />
              <span>Lưu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
