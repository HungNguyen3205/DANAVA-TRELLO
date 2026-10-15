import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import api from '../lib/axios';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => {
        localStorage.setItem('auth_token', token);
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null, token: null, isAuthenticated: false });
        
        // Clear all memory caches securely
        import('../lib/personalDashboard').then(m => m.clearPersonalDashboardCache());
        import('../lib/workspace').then(m => m.clearWorkspaceCache());
        import('./boardStore').then(m => m.useBoardStore.getState().clearCache());
      },
      updateUser: (user) => {
        set({ user });
      },
      checkAuth: async () => {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) throw new Error('No token');
          
          const res = await api.get('/me');
          if (!res.data || !res.data.id) {
            throw new Error('Dữ liệu tài khoản không hợp lệ');
          }
          set({ user: res.data, isAuthenticated: true, token });
        } catch (e) {
          localStorage.removeItem('auth_token');
          set({ user: null, token: null, isAuthenticated: false });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        token: state.token
      }),
    }
  )
);
