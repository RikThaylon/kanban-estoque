import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

/**
 * Resolve baseURL dinamicamente para suportar acesso de mobile/tablet na LAN.
 *
 * - Se VITE_API_URL foi setado explicitamente (ex: produção) → usa ele.
 * - Senão → usa o MESMO hostname pelo qual a página foi acessada, mas porta 3001.
 *
 * Por que? Quando você abre o app do celular em http://192.168.0.10:5173, o
 * "localhost:3001" hardcoded NÃO funciona — porque "localhost" no celular é o
 * próprio celular. A solução é apontar pra http://192.168.0.10:3001 dinamicamente.
 */
function resolverApiUrl() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001/api/v1`;
  }
  return 'http://localhost:3001/api/v1';
}

const API_URL = resolverApiUrl();
// Expor pra debug e pro WebSocket usar a mesma resolução
export const API_BASE_URL = API_URL;
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.info('[Kanban Estoque] API base:', API_URL);
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Interceptor de Request: Adiciona o token JWT
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;

export const globalRefreshToken = () => {
  if (refreshPromise) return refreshPromise;

  refreshPromise = new Promise((resolve, reject) => {
    const doRefresh = async () => {
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { 
          withCredentials: true,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        // Atualiza token E usuário no store se o backend os retornar
        if (data.usuario) {
          useAuthStore.getState().setAuth(data.usuario, data.accessToken);
        } else {
          useAuthStore.getState().setTokens(data.accessToken);
        }
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        resolve(data);
      } catch (err) {
        // DO NOT call logout() here — the caller (checkAuth) must evaluate the error
        // and decide whether it's a confirmed server rejection (401/403) or a transient
        // network error. Calling logout() here was the root cause of the "redirect to
        // login on page refresh" bug: it destroyed auth state before checkAuth could
        // distinguish between "session expired" and "network hiccup".
        reject(err);
      } finally {
        refreshPromise = null;
      }
    };

    if (navigator.locks) {
      navigator.locks.request('kanban_auth_refresh_lock', { mode: 'exclusive' }, doRefresh);
    } else {
      doRefresh();
    }
  });

  return refreshPromise;
};

// Interceptor de Response: Trata 401 e faz refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se o erro for 401 e não for um retry (evita loop infinito) e não for rota de login/refresh
    const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const data = await globalRefreshToken();
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    // Formatação amigável do erro
    if (error.response && error.response.data) {
      const { message, errors } = error.response.data;
      if (errors && Array.isArray(errors)) {
        error.message = errors.map(e => e.message).join(', ');
      } else if (message) {
        error.message = message;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
