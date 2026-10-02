import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  isMobileSidebarOpen: boolean;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (isDark: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isMobileSidebarOpen: false,
      toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
      closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
      isDarkMode: false, // Default to light mode
      toggleTheme: () => {
        set((state) => {
          const newIsDark = !state.isDarkMode;
          if (newIsDark) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
          return { isDarkMode: newIsDark };
        });
      },
      setTheme: (isDark: boolean) => {
        if (isDark) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        set({ isDarkMode: isDark });
      },
    }),
    {
      name: 'danava-ui-store',
      partialize: (state) => ({ isDarkMode: state.isDarkMode }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.isDarkMode) document.documentElement.classList.add('dark');
          else document.documentElement.classList.remove('dark');
        }
      },
    }
  )
);
