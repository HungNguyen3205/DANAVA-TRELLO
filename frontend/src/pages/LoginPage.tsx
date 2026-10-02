import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/axios';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/login', { email, password });
      login(data.user, data.access_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card rounded-xl shadow-lg border border-border">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">DANAVA WORK</h1>
          <p className="text-muted-foreground mt-2">Đăng nhập để tiếp tục</p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 rounded-md border border-input bg-background"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mật khẩu</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 rounded-md border border-input bg-background"
              required 
            />
          </div>
          <button type="submit" className="w-full py-2 bg-primary text-white rounded-md hover:bg-orange-600 transition-colors">
            Đăng nhập
          </button>
        </form>
        
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Chưa có tài khoản? <Link to="/register" className="text-primary hover:underline">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}
