import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Columns, Users, Settings, Briefcase } from 'lucide-react';
import { PromptModal } from '../components/ui/PromptModal';
import api from '../lib/axios';

export function WorkspaceHome() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<any[]>([]);
  const [promptData, setPromptData] = useState<{ isOpen: boolean; title: string; onConfirm: (v: string) => void } | null>(null);

  useEffect(() => {
    api.get('/workspaces').then(res => {
      const workspaces = res.data;
      if (workspaces.length > 0) {
        api.get(`/workspaces/${workspaces[0].id}/boards`).then(bRes => {
          setBoards(bRes.data);
        });
      }
    });
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Your Workspaces */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">CÁC KHÔNG GIAN LÀM VIỆC CỦA BẠN</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md">
                K
              </div>
              <h3 className="text-lg font-bold">Không gian làm việc của Nam Hùng</h3>
            </div>
            <div className="flex gap-2">
              <WorkspaceAction icon={<Columns size={14} />} label="Bảng" />
              <WorkspaceAction icon={<Users size={14} />} label="Thành viên" />
              <WorkspaceAction icon={<Settings size={14} />} label="Cài đặt" />
              <WorkspaceAction icon={<Briefcase size={14} />} label="Nâng cấp" highlight />
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          {boards.map(board => (
            <BoardThumbnail 
              key={board.id}
              title={board.name} 
              bgClass={board.color || 'bg-gradient-to-br from-blue-500 to-cyan-400'} 
              onClick={() => navigate(`/b/board-${board.id}`)}
            />
          ))}
          <button 
            onClick={() => {
              setPromptData({
                isOpen: true,
                title: 'Nhập tên bảng mới:',
                onConfirm: (name) => {
                  if (name) {
                    api.post(`/workspaces/1/boards`, { name }).then(() => {
                      window.location.reload();
                    });
                  }
                  setPromptData(null);
                }
              });
            }}
            className="h-28 rounded-lg bg-card border border-border flex items-center justify-center text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all group shadow-sm hover:shadow-md"
          >
            <span className="group-hover:scale-105 transition-transform">Tạo bảng mới</span>
          </button>
        </div>
      </section>

      {promptData && (
        <PromptModal 
          isOpen={promptData.isOpen}
          title={promptData.title}
          onConfirm={promptData.onConfirm}
          onCancel={() => setPromptData(null)}
        />
      )}
    </div>
  );
}

function WorkspaceAction({ icon, label, highlight }: { icon: React.ReactNode, label: string, highlight?: boolean }) {
  return (
    <button className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm ${
      highlight 
        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700' 
        : 'bg-card border border-border hover:bg-accent text-foreground'
    }`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function BoardThumbnail({ title, bgClass, isStarred, onClick }: { title: string, bgClass: string, isStarred?: boolean, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`relative h-28 rounded-lg overflow-hidden cursor-pointer group shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${bgClass}`}
    >
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
      <div className="absolute inset-0 p-3 flex flex-col justify-between">
        <h4 className="text-white font-bold text-sm leading-tight drop-shadow-md truncate">{title}</h4>
        <div className="self-end">
          <Star 
            size={16} 
            className={`transition-all ${isStarred ? 'text-yellow-400 fill-yellow-400' : 'text-white/50 opacity-0 group-hover:opacity-100 hover:scale-110'}`} 
          />
        </div>
      </div>
    </div>
  );
}

