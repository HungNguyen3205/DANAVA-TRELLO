import React, { useState } from 'react';
import { X, Loader2, Users } from 'lucide-react';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}

export function CreateWorkspaceModal({ isOpen, onClose, onSubmit }: CreateWorkspaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    try {
      await onSubmit(name, description);
      setName('');
      setDescription('');
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center text-white">
              <Users size={16} />
            </div>
            <h3 className="text-lg font-bold text-foreground">Tạo Không gian làm việc</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          
          <div>
            <label className="block text-sm font-medium text-foreground/90 mb-1.5">
              Tên Không gian làm việc <span className="text-destructive">*</span>
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              placeholder="VD: Nhóm Marketing, Dự án X..."
              autoFocus
              required 
            />
            <p className="text-xs text-muted-foreground mt-2">
              Đây là tên công ty, nhóm hoặc tổ chức của bạn.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/90 mb-1.5">
              Mô tả Không gian làm việc <span className="text-muted-foreground font-normal">(Tùy chọn)</span>
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm min-h-[100px]"
              placeholder="Đội ngũ của chúng tôi làm việc tại đây..."
            />
            <p className="text-xs text-muted-foreground mt-2">
              Đưa các thành viên của bạn vào một không gian chung để dễ dàng quản lý.
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/50">
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
              Tạo Không gian
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
