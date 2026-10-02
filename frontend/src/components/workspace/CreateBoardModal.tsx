import React, { useState } from 'react';
import { X, Loader2, Image, Palette } from 'lucide-react';

interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: string) => Promise<void>;
  workspaceName?: string;
}

const BG_COLORS = [
  'bg-gradient-to-br from-blue-500 to-cyan-400',
  'bg-gradient-to-br from-purple-500 to-indigo-500',
  'bg-gradient-to-br from-primary to-orange-500',
  'bg-gradient-to-br from-emerald-400 to-teal-500',
  'bg-gradient-to-br from-rose-400 to-red-500',
  'bg-slate-800'
];

export function CreateBoardModal({ isOpen, onClose, onSubmit, workspaceName }: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(BG_COLORS[0]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      await onSubmit(name, selectedColor);
      setName('');
      setSelectedColor(BG_COLORS[0]);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h3 className="text-lg font-bold text-foreground">Tạo bảng mới</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          
          {/* Preview */}
          <div className="flex justify-center mb-2">
            <div className={`w-4/5 h-28 rounded-lg shadow-md border border-white/10 ${selectedColor} flex items-center justify-center`}>
              <div className="w-full h-full bg-black/10 flex flex-col px-4 py-3">
                <div className="h-4 w-1/3 bg-white/30 rounded mb-4"></div>
                <div className="flex gap-2">
                  <div className="h-10 w-8 bg-white/20 rounded"></div>
                  <div className="h-8 w-8 bg-white/20 rounded"></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/90 mb-1.5">
              Phông nền
            </label>
            <div className="flex gap-2 flex-wrap">
              {BG_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-8 rounded-md transition-all border-2 ${color} ${selectedColor === color ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:opacity-80'}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/90 mb-1.5">
              Tiêu đề bảng <span className="text-destructive">*</span>
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              placeholder="VD: Dự án Alpha..."
              autoFocus
              required 
            />
            {workspaceName && (
              <p className="text-xs text-muted-foreground mt-2">
                Bảng này sẽ thuộc không gian: <span className="font-medium text-foreground">{workspaceName}</span>
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Tạo mới
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
