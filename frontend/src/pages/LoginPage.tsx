import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LayoutTemplate } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { data } = await api.post('/login', { email, password, remember });
      login(data.user, data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 sm:p-10 bg-card/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/5 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <LayoutTemplate className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">DANAVA WORK</h1>
          <p className="text-muted-foreground text-sm mt-2">Quản lý công việc thông minh & chuyên nghiệp</p>
        </div>
        
        {error && (
          <div className="mb-6 p-3 px-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm flex items-start gap-2 animate-in slide-in-from-top-2">
            <span className="mt-0.5 font-bold">!</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/90">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
              placeholder="admin@danava.vn"
              required 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/90">Mật khẩu</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 pr-10 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-sm"
                placeholder="••••••••"
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-input bg-background text-primary focus:ring-primary focus:ring-offset-background" 
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Ghi nhớ đăng nhập</span>
            </label>
            <a href="#" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Quên mật khẩu?</a>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-orange-600 text-white rounded-lg font-medium shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:pointer-events-none"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Đăng nhập'}
          </button>
        </form>
        
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Chưa có tài khoản? <Link to="/register" className="font-medium text-foreground hover:text-primary transition-colors">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}
