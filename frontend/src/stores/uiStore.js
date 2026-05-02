import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  
  alertsUnread: 0,
  setAlertsUnread: (count) => set({ alertsUnread: count }),
  incrementAlerts: () => set((state) => ({ alertsUnread: state.alertsUnread + 1 })),
}));
