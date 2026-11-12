import { NavLink } from 'react-router-dom';
import { Columns, FolderKanban } from 'lucide-react';

/** Switch between the projects list and "all my boards" (both live under "Dự án" in the menu). */
export function ProjectsTabs() {
  const tab = ({ isActive }: { isActive: boolean }) =>
    `h-9 px-3.5 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold transition-colors whitespace-nowrap ${
      isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <nav aria-label="Dự án và bảng" className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted">
      <NavLink to="/projects" end className={tab}>
        <FolderKanban size={16} /> Dự án
      </NavLink>
      <NavLink to="/boards" className={tab}>
        <Columns size={16} /> Tất cả bảng
      </NavLink>
    </nav>
  );
}
