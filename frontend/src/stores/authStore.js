import { create } from 'zustand';
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isSocketConnected: false,
  authChecked: false,

  setAuth: (user, accessToken) => set({
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    authChecked: true,
  }),

  setTokens: (accessToken) => set({
    accessToken,
    isAuthenticated: !!accessToken,
  }),

  setUser: (user) => set({ user }),

  setAuthChecked: (authChecked) => set({ authChecked }),

  logout: () => set({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    authChecked: true,
  }),

  setSocketConnected: (status) => set({ isSocketConnected: status }),
}));
