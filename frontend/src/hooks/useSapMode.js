import { useMemo } from 'react';

/**
 * Hook centralizado para verificar o modo de integração SAP no frontend.
 * @returns {boolean} true se o sistema estiver rodando no modo de integração SAP.
 */
export function useSapMode() {
  return useMemo(() => {
    return import.meta.env.VITE_SAP_MODE === 'true';
  }, []);
}
