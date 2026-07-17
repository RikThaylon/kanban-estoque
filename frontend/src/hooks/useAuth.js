import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import api, { globalRefreshToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

// Auth event broadcast key — used for multi-tab sync (Phase 4.3)
const AUTH_EVENT_KEY = 'kanban_auth_event';

// Broadcast an auth event to all open tabs
const broadcastAuthEvent = (event) => {
  try {
    localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ event, ts: Date.now() }));
  } catch (_) {}
};

export const useAuth = () => {
  const {
    user,
    isAuthenticated,
    authStatus,
    setAuth,
    setAuthStatus,
    logout: storeLogout,
    setAuthChecked,
  } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Phase 4.3 — Listen for logout/login events from other tabs
  // Call this once in your app root to keep all tabs in sync
  const initMultiTabSync = () => {
    const handler = (e) => {
      if (e.key !== AUTH_EVENT_KEY || !e.newValue) return;
      try {
        const { event } = JSON.parse(e.newValue);
        if (event === 'logout') {
          // Another tab logged out — reflect this without a page reload
          disconnectSocket();
          storeLogout();
        }
        if (event === 'login') {
          // Another tab logged in — reload to pick up their session
          window.location.reload();
        }
      } catch (_) {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  };

  const login = async (username, senha, latitude, longitude) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { username, senha, latitude, longitude });
      const { accessToken, usuario } = response.data;

      setAuth(usuario, accessToken);
      connectSocket();
      broadcastAuthEvent('login');

      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao realizar login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('Erro ao fazer logout remoto', err);
    } finally {
      disconnectSocket();
      storeLogout();
      broadcastAuthEvent('logout'); // Phase 4.3 — notify other tabs
      window.location.href = '/login';
    }
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
    } catch (err) {
      console.error('Erro ao fazer logout global', err);
    } finally {
      disconnectSocket();
      storeLogout();
      broadcastAuthEvent('logout');
      window.location.href = '/login';
    }
  };

  // Phase 4.1 — Explicit state machine for auth checking
  // Transition rule: 'unauthenticated' ONLY on confirmed 401/403 from server
  // Network errors → stay as 'checking' (prevents false logout on mobile connection drops)
  const checkAuth = async () => {
    setAuthStatus('checking');
    try {
      if (!useAuthStore.getState().accessToken) {
        // No token in memory → try renewal via httpOnly cookie
        const refreshData = await globalRefreshToken();

        // Fetch user data after successful renewal
        const meResponse = await api.get('/auth/me');
        useAuthStore.getState().setAuth(meResponse.data, refreshData.accessToken);
      } else {
        // Token in memory → validate with /me
        const response = await api.get('/auth/me');
        useAuthStore.getState().setAuth(response.data, useAuthStore.getState().accessToken);
      }
      connectSocket();
      return true;
    } catch (err) {
      console.error('checkAuth falhou', err);

      // Phase 4.1 — Only go to 'unauthenticated' on CONFIRMED server rejection
      // Erros de rede (sem err.response) NÃO devem derrubar a sessão
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        // Phase 4.2 — If session was terminated for security reasons, surface a clear message
        const isSecurityRevocation = err.response?.data?.code === 'SESSION_REVOKED_SECURITY';
        if (isSecurityRevocation) {
          sessionStorage.setItem('kanban_security_logout', '1');
        }
        storeLogout(); // transitions to 'unauthenticated' via logout()
        disconnectSocket();
      } else {
        // Network error / timeout — don't kick the user out, just mark as checked
        // The ProtectedRoute will still see the last known state
        setAuthChecked(true);
      }
      return false;
    }
    // Note: No finally needed — every branch above explicitly sets the auth status.
    // This is intentional to prevent the ambiguous "stuck in checking" state.
  };

  return {
    user,
    isAuthenticated,
    authStatus,
    loading,
    error,
    login,
    logout,
    logoutAll,
    checkAuth,
    initMultiTabSync,
  };
};
