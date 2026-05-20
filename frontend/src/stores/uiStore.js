import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  
  alertsUnread: 0,
  setAlertsUnread: (count) => set({ alertsUnread: count }),
  incrementAlerts: () => set((state) => ({ alertsUnread: state.alertsUnread + 1 })),
  toasts: [],
  pushToast: (toast) => set((state) => ({
    toasts: [
      { id: `${Date.now()}-${Math.random()}`, tipo: 'info', ...toast },
      ...state.toasts,
    ].slice(0, 4),
  })),
  dismissToast: (id) => set((state) => ({
    toasts: state.toasts.filter((toast) => toast.id !== id),
  })),
}));
