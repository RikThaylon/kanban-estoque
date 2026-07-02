import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import api, { globalRefreshToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuth = () => {
  const { user, isAuthenticated, setAuth, logout: storeLogout, setAuthChecked } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, senha, rememberMe = false) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { username, senha, rememberMe });
      const { accessToken, usuario } = response.data;

      setAuth(usuario, accessToken);
      connectSocket();

      return true;
    } catch (err) {
      setError(err.message || 'Erro ao realizar login');
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
      // Forçar recarregamento para limpar query cache e estados
      window.location.href = '/login';
    }
  };

  const checkAuth = async () => {
    try {
      if (!useAuthStore.getState().accessToken) {
        const refreshed = await globalRefreshToken();
        const { accessToken, usuario } = refreshed;
        useAuthStore.getState().setAuth(usuario, accessToken);
      } else {
        const response = await api.get('/auth/me');
        useAuthStore.getState().setUser(response.data);
        setAuthChecked(true);
      }
      connectSocket();
      return true;
    } catch (err) {
      console.error('Sessão inválida', err);
      // Se não for erro de rede, limpa sessão
      if (err.response) {
        storeLogout();
        disconnectSocket();
      }
      setAuthChecked(true);
      return false;
    }
  };

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    checkAuth,
  };
};
