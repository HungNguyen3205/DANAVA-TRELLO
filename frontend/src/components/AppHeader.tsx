import { Link } from "react-router-dom";
import { LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import type { ReactNode } from "react";
export function AppHeader({ children }: { children?: ReactNode }) {
  const { user, logout } = useAuth();
  const { dark, setTheme } = useTheme();
  return (
    <header className="workspace-topbar">
      <Link className="home-brand" to="/">
        <span className="brand-mark">D</span>
        <span>
          DANAVA <small>WORK</small>
        </span>
      </Link>
      <div className="topbar-content">{children}</div>
      <button
        className="icon-button"
        aria-label="Đổi giao diện sáng tối"
        onClick={() => setTheme(dark ? "light" : "dark")}
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <span className="account-avatar" title={user?.name}>
        {user?.name.slice(0, 1).toUpperCase()}
      </span>
      <button
        className="icon-button"
        aria-label="Đăng xuất"
        onClick={() => void logout().catch((e) => toast.error(e.message))}
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}
