import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DatePicker({ value, onChange, placeholder = "dd/mm/yyyy" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setViewDate(parsed);
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day);
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const getDaysArray = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth; i++) arr.push(i);
    return arr;
  };

  const years = Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - 100 + i);
  const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const displayValue = value ? value.split('-').reverse().join('/') : '';

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="relative cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={18} />
        <input
          type="text"
          readOnly
          value={displayValue}
          placeholder={placeholder}
          className="w-full pl-11 pr-4 py-2.5 bg-accent/50 border border-transparent rounded-full focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all text-sm font-medium text-foreground cursor-pointer placeholder:font-normal"
        />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 p-4 bg-card border border-primary/20 rounded-2xl shadow-xl z-50 w-[280px] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <button 
              type="button"
              onClick={() => setViewDate(new Date(currentYear, currentMonth - 1, 1))}
              className="p-1 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex gap-1.5 items-center">
              <div className="relative">
                <select 
                  value={currentMonth}
                  onChange={(e) => setViewDate(new Date(currentYear, parseInt(e.target.value), 1))}
                  className="text-sm font-semibold bg-transparent cursor-pointer outline-none hover:text-primary transition-colors appearance-none pr-3"
                >
                  {months.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <select 
                  value={currentYear}
                  onChange={(e) => setViewDate(new Date(parseInt(e.target.value), currentMonth, 1))}
                  className="text-sm font-semibold bg-transparent cursor-pointer outline-none hover:text-primary transition-colors appearance-none"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))}
              className="p-1 hover:bg-accent rounded-full transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(d => (
              <div key={d} className="text-[10px] font-bold text-muted-foreground uppercase">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {getDaysArray().map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="h-8" />;
              
              const isSelected = value === `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30' 
                      : 'text-foreground hover:bg-primary/10 hover:text-primary font-medium'
                  }`}
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
