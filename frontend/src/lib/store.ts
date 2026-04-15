import { create } from 'zustand';

interface AppState {
  darkMode: boolean;
  sidebarOpen: boolean;
  toggleDarkMode: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  darkMode: true,
  sidebarOpen: false,
  toggleDarkMode: () => set((s) => {
    const next = !s.darkMode;
    if (typeof window !== 'undefined') {
      if (next) {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        document.body.style.background = '#010104';
        document.body.style.color = '#F0F0F5';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.body.style.background = '#F5F5F7';
        document.body.style.color = '#1A1A2E';
      }
      localStorage.setItem('theme', next ? 'dark' : 'light');
    }
    return { darkMode: next };
  }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
