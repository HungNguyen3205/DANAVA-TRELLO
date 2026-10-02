import React, { useState } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

export function WorkspaceSwitcher({ workspaces }: { workspaces: any[] }) {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const currentWorkspace = workspaces.find((w) => w.id === Number(workspaceId)) || workspaces[0];

  if (!currentWorkspace) return null;

  return (
    <div className="relative px-3 mb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 hover:bg-accent/50 rounded-lg transition-colors border border-transparent hover:border-border"
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
            {currentWorkspace.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col text-left overflow-hidden">
            <span className="text-sm font-semibold truncate text-foreground">{currentWorkspace.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Miễn phí</span>
          </div>
        </div>
        <ChevronDown size={16} className="text-muted-foreground shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-3 right-3 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 py-2">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border mb-2">
            Không gian làm việc
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => {
                  setIsOpen(false);
                  navigate(`/w/${ws.id}/boards`);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                  ws.id === currentWorkspace.id 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-foreground hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                    {ws.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{ws.name}</span>
                </div>
                {ws.id === currentWorkspace.id && <Check size={14} className="shrink-0" />}
              </button>
            ))}
          </div>

          <div className="border-t border-border mt-2 pt-2 px-2">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <Plus size={16} />
              Tạo không gian mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
