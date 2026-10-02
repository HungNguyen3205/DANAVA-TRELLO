import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, LayoutTemplate, Sun, Moon, Flashlight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import api from '../lib/axios';

export function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Global theme
  const globalIsDark = useUIStore(state => state.isDarkMode);
  const toggleGlobalTheme = useUIStore(state => state.toggleTheme);
  
  // The actual visual dark mode is determined by global preference OR temporarily overridden if inspecting password (flashlight)
  const isDark = globalIsDark || showPassword;
  
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const formRef = useRef<HTMLDivElement>(null);
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Mouse tracking effect for the right panel
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (formRef.current) {
      const rect = formRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleToggleTheme = () => {
    toggleGlobalTheme();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const { data } = await api.post('/login', { login: loginId, password, remember });
      login(data.user, data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 md:p-8 transition-colors duration-1000 relative overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
      
      {/* Decorative background Sun/Moon behind the card */}
      <div className={`absolute rounded-full transition-all duration-1000 ease-in-out pointer-events-none blur-[120px]
        ${isDark 
          ? 'w-[60vw] h-[60vw] bg-indigo-600/10 top-[-10%] right-[-10%]' 
          : 'w-[70vw] h-[70vw] bg-amber-400/20 top-[-20%] left-[-10%]'
        }`} />

      {/* Centered Main Card */}
      <div className={`w-full max-w-5xl h-[600px] flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-2xl transition-all duration-1000 border relative z-10 ${isDark ? 'border-slate-700/50 shadow-indigo-900/20' : 'border-slate-200 shadow-slate-300/50'}`}>
        
        {/* Left Side - Illustration Panel */}
        <div className="hidden md:flex md:w-1/2 relative overflow-hidden flex-col transition-all duration-1000">
          
          {/* Sky Background */}
          <div className={`absolute inset-0 transition-colors duration-1000 ease-in-out z-0
            ${isDark 
              ? 'bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900' 
              : 'bg-gradient-to-b from-sky-300 via-sky-100 to-white'}`}>
          </div>

          {/* Stars (Night only) */}
          <div className={`absolute inset-0 z-0 transition-opacity duration-1000 ${isDark ? 'opacity-100' : 'opacity-0'}`}>
            {[...Array(20)].map((_, i) => (
              <div key={i} className="absolute bg-white rounded-full animate-pulse" 
                style={{
                  top: `${Math.random() * 60}%`, 
                  left: `${Math.random() * 100}%`, 
                  width: `${Math.random() * 3}px`, 
                  height: `${Math.random() * 3}px`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 3}s`
                }} 
              />
            ))}
          </div>

          {/* Sun / Moon */}
          <div className="absolute z-10 w-full h-full pointer-events-none">
            <div className={`absolute rounded-full transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-2xl
              ${isDark 
                ? 'w-24 h-24 bg-slate-100 top-[25%] right-[15%] shadow-[0_0_50px_10px_rgba(255,255,255,0.3)]' 
                : 'w-32 h-32 bg-amber-400 top-[35%] right-[10%] shadow-[0_0_60px_20px_rgba(251,191,36,0.6)]'
              }`} 
            >
              {/* Crater for moon */}
              <div className={`absolute rounded-full bg-slate-300/40 transition-all duration-1000 ${isDark ? 'w-5 h-5 top-[20%] left-[60%] opacity-100' : 'opacity-0 scale-0'}`} />
              <div className={`absolute rounded-full bg-slate-300/40 transition-all duration-1000 ${isDark ? 'w-3 h-3 top-[40%] left-[20%] opacity-100' : 'opacity-0 scale-0'}`} />
            </div>
          </div>

          {/* Flashlight Beam when inspecting password */}
          <div className={`absolute z-15 right-0 top-1/2 -translate-y-1/2 w-[150%] h-[200px] origin-right transition-all duration-700 ease-in-out pointer-events-none
            ${showPassword ? 'opacity-100' : 'opacity-0 scale-x-0'}`}
            style={{
              background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.15) 80%, rgba(255, 255, 255, 0.4))',
              clipPath: 'polygon(0 30%, 100% 45%, 100% 55%, 0 70%)',
              transform: 'translateY(-20px)'
            }}
          />

          {/* Mountains */}
          <div className="absolute bottom-0 w-full h-[50%] z-20 pointer-events-none">
            {/* Mountain 3 (Back) */}
            <div className={`absolute bottom-[-10%] right-[-20%] w-[120%] h-[80%] rounded-[100%] transition-colors duration-1000
              ${isDark ? 'bg-slate-800/50' : 'bg-emerald-800/20'}`} style={{ transform: 'rotate(-5deg)' }}></div>
            {/* Mountain 2 */}
            <div className={`absolute bottom-[-20%] left-[-20%] w-[80%] h-[100%] rounded-[100%] transition-colors duration-1000
              ${isDark ? 'bg-indigo-950/80' : 'bg-emerald-600/30'}`} style={{ transform: 'rotate(10deg)' }}></div>
            {/* Mountain 1 (Front) */}
            <div className={`absolute bottom-[-30%] left-[-10%] w-[120%] h-[90%] rounded-[100%] transition-colors duration-1000
              ${isDark ? 'bg-slate-900' : 'bg-emerald-500/40'}`} style={{ transform: 'rotate(-8deg)' }}></div>
            
            {/* Glowing accents on mountains (Night only) */}
            <div className={`absolute bottom-[10%] left-[30%] w-[20%] h-[20%] bg-blue-500/20 blur-3xl transition-opacity duration-1000 ${isDark ? 'opacity-100' : 'opacity-0'}`} />
          </div>

          {/* Brand Content */}
          <div className="relative z-30 p-10 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
                <LayoutTemplate className={`transition-colors duration-1000 ${isDark ? 'text-indigo-200' : 'text-white'}`} size={20} />
              </div>
              <h1 className={`text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm transition-colors duration-1000
                ${isDark ? 'text-white' : 'text-slate-800'}`}>
                DANAVA WORK
              </h1>
            </div>
            <p className={`text-base md:text-lg max-w-sm font-medium leading-relaxed drop-shadow-sm transition-colors duration-1000
              ${isDark ? 'text-indigo-200/80' : 'text-slate-700'}`}>
              Nền tảng quản trị công việc chuyên nghiệp. Mọi thứ bạn cần ở một nơi.
            </p>
          </div>
        </div>

        {/* Right Side - Form */}
        <div 
          ref={formRef}
          onMouseMove={handleMouseMove}
          className={`w-full md:w-1/2 flex items-center justify-center relative z-20 p-8 md:p-12 transition-colors duration-1000
            ${isDark ? 'bg-slate-900/95' : 'bg-white'}`}
        >
          {/* Mouse tracking glow */}
          <div 
            className="hidden md:block pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
            style={{
              background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.03)'}, transparent 40%)`
            }}
          />

          {/* Theme Toggle Button */}
          <button 
            type="button"
            onClick={handleToggleTheme}
            className={`absolute top-6 right-6 z-50 p-2.5 rounded-full transition-all duration-300 shadow-sm overflow-hidden group
              ${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
            aria-label="Toggle theme"
          >
            <div className="relative w-5 h-5 flex items-center justify-center">
              <Sun className={`absolute transition-all duration-500 ease-in-out transform ${isDark ? 'rotate-90 opacity-0 scale-50' : 'rotate-0 opacity-100 scale-100'} group-hover:text-amber-500`} size={18} />
              <Moon className={`absolute transition-all duration-500 ease-in-out transform ${isDark ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'} group-hover:text-indigo-400`} size={18} />
            </div>
          </button>

          <div className="w-full max-w-sm relative z-10">
            
            {/* Mobile Logo */}
            <div className="md:hidden flex flex-col items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <LayoutTemplate className="text-white" size={24} />
              </div>
              <h1 className={`text-2xl font-black tracking-tight transition-colors duration-1000 ${isDark ? 'text-white' : 'text-slate-800'}`}>DANAVA WORK</h1>
            </div>

            <div className="mb-8 text-center md:text-left">
              <h2 className={`text-2xl md:text-3xl font-bold transition-colors duration-1000 ${isDark ? 'text-white' : 'text-slate-900'}`}>Đăng nhập</h2>
              <p className={`mt-2 text-sm transition-colors duration-1000 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Sử dụng tài khoản do Admin cấp</p>
            </div>
            
            {error && (
              <div className="mb-6 p-3 px-4 bg-red-500/10 border border-red-500/20 rounded-xl text-sm flex items-start gap-3 transition-colors duration-1000">
                <span className="font-bold bg-red-500/20 text-red-600 dark:text-red-400 w-5 h-5 flex items-center justify-center rounded-full shrink-0">!</span>
                <span className="text-red-600 dark:text-red-400 mt-0.5">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5 group">
                <label className={`text-sm font-semibold transition-colors duration-1000 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tài khoản</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className={`w-full p-3.5 rounded-xl border transition-all outline-none duration-300 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                      ${isDark ? 'border-slate-700 bg-slate-800/50 text-white group-hover:border-indigo-500/50' : 'border-slate-200 bg-slate-50 text-slate-900 group-hover:border-indigo-400/50'}`}
                    placeholder="admin@danava.vn"
                    required 
                  />
                </div>
              </div>
              
              <div className="space-y-1.5 group relative">
                <label className={`text-sm font-semibold transition-colors duration-1000 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Mật khẩu</label>
                <div className="relative z-20">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full p-3.5 pr-12 rounded-xl border transition-all outline-none duration-300 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                      ${isDark ? 'border-slate-700 bg-slate-800/50 text-white group-hover:border-indigo-500/50' : 'border-slate-200 bg-slate-50 text-slate-900 group-hover:border-indigo-400/50'}
                      ${showPassword ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''}`}
                    placeholder="••••••••"
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all duration-300
                      ${showPassword ? 'text-indigo-500' : (isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600')}`}
                    tabIndex={-1}
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu (Bật đèn pin)"}
                  >
                    {showPassword ? (
                      <Flashlight size={20} className="animate-pulse" />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center pt-2">
                <label className="flex flex-row items-center gap-3 cursor-pointer group w-fit !mb-0 !gap-3">
                  <div className="relative inline-flex items-center">
                    <input 
                      type="checkbox" 
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm shadow-inner transition-colors duration-300
                      ${isDark ? 'bg-slate-700 peer-checked:bg-indigo-500 border-slate-600' : 'bg-slate-200 peer-checked:bg-indigo-600 border-slate-300'}`}>
                    </div>
                  </div>
                  <span className={`text-sm font-medium transition-colors select-none
                    ${isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-500 group-hover:text-slate-800'}`}>
                    Ghi nhớ đăng nhập
                  </span>
                </label>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3.5 mt-2 relative overflow-hidden group rounded-xl font-bold text-white shadow-lg transition-all duration-300 disabled:opacity-70 disabled:pointer-events-none active:scale-[0.98]
                  bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-indigo-500/25"
              >
                {/* Button shimmer effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                
                <div className="relative flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Đăng nhập'}
                </div>
              </button>
            </form>
            
          </div>
        </div>
      </div>
      
      {/* Add custom shimmer animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          *, ::before, ::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}} />
    </div>
  );
}
