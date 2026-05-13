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

// Flag para evitar múltiplos refreshes simultâneos
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor de Response: Trata 401 e faz refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se o erro for 401 e não for um retry (evita loop infinito) e não for rota de login
    const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh');
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        useAuthStore.getState().setTokens(data.accessToken);
        
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
        
        processQueue(null, data.accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
