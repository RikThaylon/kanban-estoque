import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Auth state machine:
//   'checking'       → still verifying session (no redirect allowed)
//   'authenticated'  → session confirmed, user is available
//   'unauthenticated'→ session confirmed as absent/invalid (safe to redirect to /login)
//
// The transition to 'unauthenticated' ONLY happens on confirmed server rejection (401/403),
// never on network errors or timeouts — that was the root cause of the original logout bug.

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isSocketConnected: false,

      // Explicit state machine (Phase 4.1)
      // 'checking' | 'authenticated' | 'unauthenticated'
      authStatus: 'checking',

      // Legacy compatibility — derived from authStatus
      get authChecked() {
        return this.authStatus !== 'checking';
      },

      setAuth: (user, accessToken) => set({
        user,
        accessToken,
        isAuthenticated: !!accessToken,
        authStatus: 'authenticated',
      }),

      setTokens: (accessToken) => set({
        accessToken,
        isAuthenticated: !!accessToken,
      }),

      setUser: (user) => set({ user }),

      // Explicit state machine transitions (Phase 4.1)
      setAuthStatus: (authStatus) => set({ authStatus }),

      // Legacy compatibility shim
      setAuthChecked: (checked) => set((state) => ({
        authStatus: checked
          ? (state.isAuthenticated ? 'authenticated' : 'unauthenticated')
          : 'checking',
      })),

      logout: () => set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        authStatus: 'unauthenticated',
      }),

      setSocketConnected: (status) => set({ isSocketConnected: status }),
    }),
    {
      name: 'kanban-auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        authStatus: state.authStatus,
      }),
    }
  )
);
