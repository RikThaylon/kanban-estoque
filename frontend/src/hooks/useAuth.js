import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import api, { globalRefreshToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

export const useAuth = () => {
  const { user, isAuthenticated, setAuth, logout: storeLogout, setAuthChecked } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (username, senha) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/login', { username, senha });
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
        // Sem token em memória → tenta renovar via cookie httpOnly
        const refreshData = await globalRefreshToken();

        // Busca dados do usuário após renovação bem-sucedida
        const meResponse = await api.get('/auth/me');
        useAuthStore.getState().setAuth(meResponse.data, refreshData.accessToken);
      } else {
        // Já tem token em memória → apenas valida com /me
        const response = await api.get('/auth/me');
        useAuthStore.getState().setAuth(response.data, useAuthStore.getState().accessToken);
      }
      connectSocket();
      return true;
    } catch (err) {
      console.error('checkAuth falhou', err);
      // Só desloga se o servidor respondeu explicitamente com erro (401/403)
      // Erros de rede (sem err.response) NÃO devem derrubar a sessão
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        storeLogout();
        disconnectSocket();
      }
      return false;
    } finally {
      // SEMPRE marca authChecked=true ao terminar, independente do resultado
      // Sem isso, ProtectedRoute fica em loop de loading e redireciona para login
      setAuthChecked(true);
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
