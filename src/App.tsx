import React, { useState } from 'react';
import { LayoutDashboard, CheckSquare, Users, Settings, Plus, Search, Bell, Menu, Sun, Moon } from 'lucide-react';
import { KanbanBoard } from './components/kanban/KanbanBoard';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Toggle theme
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card hidden md:flex flex-col transition-all duration-300">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-primary">DANAVA WORK</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Tổng quan" />
          <NavItem icon={<CheckSquare size={20} />} label="Công việc của tôi" />
          <NavItem icon={<LayoutDashboard size={20} />} label="Dự án / Bảng" active />
          <NavItem icon={<Users size={20} />} label="Thành viên" />
          <NavItem icon={<Settings size={20} />} label="Cài đặt" />
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
              NH
            </div>
            <div>
              <p className="text-sm font-medium">Nam Hùng</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-muted-foreground hover:text-foreground">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold hidden sm:block">Thiết kế lại website danava.vn</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm công việc..."
                className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            
            <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full"></span>
            </button>
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors shadow-sm">
              <Plus size={16} />
              <span className="hidden sm:inline">Tạo công việc</span>
            </button>
          </div>
        </header>

        {/* Board Area */}
        <div className="flex-1 overflow-hidden bg-background pt-6 pl-6">
          <KanbanBoard />
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <a href="#" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      {icon}
      <span>{label}</span>
    </a>
  );
}
