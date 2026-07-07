import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useSapMode } from '../hooks/useSapMode';

export default function SapIntegration() {
  const isSapModeFront = useSapMode();

  const { data, isLoading, error } = useQuery({
    queryKey: ['sapStatus'],
    queryFn: async () => {
      const res = await api.get('/sap/status');
      return res.data;
    }
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['sapLogs'],
    queryFn: async () => {
      const res = await api.get('/sap/logs');
      return res.data;
    }
  });

  if (isLoading) return <div className="p-6">Carregando status SAP...</div>;
  if (error) return <div className="p-6 text-red-500">Erro ao carregar configurações SAP.</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">SAP Integration Dashboard</h1>
        <p className="text-gray-500">Gerenciamento e monitoramento da sincronização com SAP ERP.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="font-semibold text-lg border-b pb-2 mb-4">Status da Integração</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Current Mode:</span>
              <span className={`font-bold ${data?.isSapMode ? 'text-blue-600' : 'text-gray-600'}`}>
                {data?.mode || 'STANDALONE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Frontend Guard (SAP_MODE):</span>
              <span className="font-bold">{isSapModeFront ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Current Provider:</span>
              <span className="font-medium text-amber-600">{data?.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Worker Status:</span>
              <span className="font-medium text-gray-800">{data?.workerStatus}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="font-semibold text-lg border-b pb-2 mb-4">Última Sincronização</h2>
          {data?.lastSync ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Iniciado em:</span>
                <span>{new Date(data.lastSync.started_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={data.lastSync.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}>
                  {data.lastSync.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Registros Processados:</span>
                <span>{data.lastSync.records_processed}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic">Nenhuma sincronização registrada.</p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h2 className="font-semibold text-lg border-b pb-2 mb-4">Sync Logs</h2>
        {loadingLogs ? (
          <p>Carregando logs...</p>
        ) : logs?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Registros</th>
                  <th className="px-4 py-2">Duração (ms)</th>
                  <th className="px-4 py-2">Mensagem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2">{log.id}</td>
                    <td className="px-4 py-2">{new Date(log.started_at).toLocaleString()}</td>
                    <td className={`px-4 py-2 font-medium ${log.status === 'SUCCESS' ? 'text-green-600' : 'text-red-600'}`}>
                      {log.status}
                    </td>
                    <td className="px-4 py-2">{log.records_processed}</td>
                    <td className="px-4 py-2">{log.duration_ms}</td>
                    <td className="px-4 py-2 text-gray-500">{log.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 italic">Nenhum log encontrado.</p>
        )}
      </div>
    </div>
  );
}
