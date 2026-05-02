import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

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
