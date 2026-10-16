import React, { useState, useEffect } from 'react';

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  type?: 'text' | 'date' | 'select';
  options?: string[];
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({ 
  isOpen, 
  title, 
  placeholder, 
  defaultValue = '', 
  type = 'text',
  options = [],
  onConfirm, 
  onCancel 
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue || (type === 'select' && options?.length > 0 ? options[0] : ''));
      setIsSubmitting(false);
    }
  }, [isOpen]); // Only reset when modal opens

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await Promise.resolve(onConfirm(value));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-sm bg-card rounded-xl shadow-2xl p-6 animate-in zoom-in-95 duration-200 border border-border">
        <h3 className="text-lg font-bold mb-4 text-foreground">{title}</h3>
        
        {type === 'text' && (
          <input 
            type="text" 
            className="w-full p-3 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm mb-6 text-foreground disabled:opacity-50"
            placeholder={placeholder}
            value={value}
            disabled={isSubmitting}
            onChange={(e) => {
              setValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
              }
            }}
            autoFocus
          />
        )}

        {type === 'date' && (
          <input 
            type="date" 
            className="w-full p-3 rounded-md bg-background border border-input focus:ring-2 focus:ring-primary/50 text-sm mb-6 disabled:opacity-50"
            value={value}
            disabled={isSubmitting}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        )}

        {type === 'select' && (
          <select 
            className="w-full p-3 rounded-xl bg-background border border-border/80 focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm mb-6 disabled:opacity-50 text-foreground font-medium shadow-xs outline-none cursor-pointer"
            value={value}
            disabled={isSubmitting}
            onChange={(e) => setValue(e.target.value)}
          >
            {options.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}

        <div className="flex gap-3 justify-end">
          <button 
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 hover:bg-accent text-muted-foreground font-medium rounded-md text-sm transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? 'Đang lưu...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
