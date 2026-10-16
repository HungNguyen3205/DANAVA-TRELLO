import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  badgeClassName?: string;
  description?: string;
}

export interface CustomSelectProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  id?: string;
  name?: string;
  renderTrigger?: (selected: SelectOption<T> | undefined, isOpen: boolean) => React.ReactNode;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Chọn một mục...',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  disabled = false,
  align = 'left',
  id,
  name,
  renderTrigger,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const selectedOption = options.find((opt) => opt.value === value);

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

  // Close on outside click
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

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
        onChange(options[highlightedIndex].value);
        setIsOpen(false);
      } else {
        handleToggle();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(options.length - 1);
      } else {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
      }
    }
  };

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div 
      className={`relative inline-block w-full select-none ${className}`} 
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden Native Select for accessibility & form compatibility */}
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Trigger Button */}
      {renderTrigger ? (
        <div 
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {renderTrigger(selectedOption, isOpen)}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-card border border-border/80 hover:border-primary/50 hover:bg-accent/30 text-[13px] font-semibold text-foreground shadow-xs transition-all outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
            isOpen ? 'ring-2 ring-primary/20 border-primary shadow-sm' : ''
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${triggerClassName}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5 truncate">
            {selectedOption?.icon && (
              <span className="shrink-0 flex items-center">{selectedOption.icon}</span>
            )}
            {selectedOption?.color && (
              <span 
                className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background"
                style={{ backgroundColor: selectedOption.color }}
              />
            )}
            <span className="truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown
            size={16}
            className={`shrink-0 text-muted-foreground transition-transform duration-200 ease-out ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} ${
            openUpward ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top'
          } w-full min-w-[200px] z-[70] bg-popover/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-xl shadow-black/10 p-1.5 animate-in fade-in-0 zoom-in-95 duration-150 ${menuClassName}`}
        >
          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
            {options.map((option, idx) => {
              const isSelected = option.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs md:text-[13px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : isHighlighted
                        ? 'bg-accent/80 text-foreground'
                        : 'text-foreground/80 hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {option.icon && (
                      <span className={`shrink-0 flex items-center ${isSelected ? 'text-primary' : ''}`}>
                        {option.icon}
                      </span>
                    )}
                    {option.color && (
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <div className="truncate flex flex-col">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={15} className="shrink-0 text-primary ml-2 stroke-[2.5]" />
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
