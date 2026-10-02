import { Outlet, Link } from 'react-router-dom';
import { Search, Bell, Grid, ChevronDown, LayoutDashboard, Clock } from 'lucide-react';
import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export function AppLayout() {
  const [isDarkMode, setIsDarkMode] = useState(true);

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
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Top Navigation */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button className="p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors">
            <Grid size={20} />
          </button>
          <Link to="/" className="flex items-center gap-2 cursor-pointer">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center text-primary-foreground font-bold">
              D
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              DANAVA WORK
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4 text-sm font-medium">
            <NavButton label="Các Không gian làm việc" hasDropdown />
            <NavButton label="Gần đây" hasDropdown />
            <NavButton label="Đã đánh dấu sao" hasDropdown />
            <NavButton label="Mẫu" hasDropdown />
            <button className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-md transition-colors ml-2">
              Tạo mới
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm"
              className="h-8 w-64 rounded-md border border-input bg-background/50 pl-8 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
          
          <button onClick={toggleTheme} className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors">
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent relative transition-colors">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-card"></span>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-primary-foreground font-medium text-sm shadow-md cursor-pointer border border-primary/20">
            NH
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden bg-background relative flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavButton({ label, hasDropdown }: { label: string, hasDropdown?: boolean }) {
  return (
    <button className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
      {label}
      {hasDropdown && <ChevronDown size={14} className="opacity-50" />}
    </button>
  );
}
