import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

// Mesma estratégia do api.js: resolve dinamicamente para suportar acesso de
// celular/tablet via IP da LAN (não pode ser "localhost" hardcoded).
function resolverWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
}
const WS_URL = resolverWsUrl();

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const token = useAuthStore.getState().accessToken;
    
    socket = io(WS_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket conectado');
      useAuthStore.getState().setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 WebSocket desconectado');
      useAuthStore.getState().setSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('🔌 Erro WebSocket:', err.message);
      // Se o erro for de autenticação, podemos tentar limpar a flag
      if (err.message === 'Token inválido' || err.message === 'Token não fornecido') {
        useAuthStore.getState().setSocketConnected(false);
      }
    });
  }
  
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  const token = useAuthStore.getState().accessToken;
  if (token) {
    s.auth = { token };
    s.connect();
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
