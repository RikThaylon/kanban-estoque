import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, MapPin, ToggleLeft, ToggleRight, Save,
  Search, AlertTriangle, CheckCircle2, Clock, Globe,
  Lock, Unlock, Activity, RefreshCw, Eye, X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Fix Leaflet default icon bug no Vite
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import icon2x from 'leaflet/dist/images/marker-icon-2x.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl: icon2x, shadowUrl: iconShadow });

const RAIOS_DISPONIVEIS = [
  { label: '500 m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
  { label: '20 km', value: 20000 },
  { label: '50 km', value: 50000 },
];

const STATUS_COLORS = {
  PERMITIDO: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  BLOQUEADO: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  SEM_LOCALIZACAO: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  MFA_DESABILITADO: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
};

// ─── Componente: Handler de clique no mapa ────────────────────────────────────
function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ─── Componente: Centralizar mapa em coordenadas ──────────────────────────────
function MapCenterControl({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// ─── Componente: Busca de Endereço via Nominatim (OpenStreetMap) ──────────────
function AddressSearch({ onLocationFound }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || query.length < 3) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=br`,
        { headers: { 'Accept-Language': 'pt-BR' } }
      );
      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (err) {
      console.error('Erro na busca de endereço:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (result) => {
    onLocationFound({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setQuery(result.display_name.split(',').slice(0, 2).join(','));
    setShowResults(false);
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-400" />
          <input
            className="input w-full pl-10"
            placeholder="Pesquisar endereço ou cidade..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="btn-secondary px-4"
        >
          {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-lg shadow-xl z-[9999] overflow-hidden modal-spring-enter">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-surface-50 flex items-start gap-3 border-b border-surface-100 last:border-0 transition-colors"
            >
              <MapPin className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <span className="text-steel-700 leading-snug">{r.display_name}</span>
            </button>
          ))}
          <button
            onClick={() => setShowResults(false)}
            className="w-full text-center py-2 text-xs text-steel-400 hover:bg-surface-50"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Componente: Tabela de Tentativas ─────────────────────────────────────────
function TentativasTable({ tentativas }) {
  if (!tentativas?.data?.length) {
    return (
      <div className="text-center py-12 text-steel-400">
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma tentativa registrada</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200">
            <th className="text-left py-2 px-3 text-steel-500 font-semibold text-xs uppercase tracking-wide">Usuário</th>
            <th className="text-left py-2 px-3 text-steel-500 font-semibold text-xs uppercase tracking-wide">Status</th>
            <th className="text-left py-2 px-3 text-steel-500 font-semibold text-xs uppercase tracking-wide">Distância</th>
            <th className="text-left py-2 px-3 text-steel-500 font-semibold text-xs uppercase tracking-wide">IP</th>
            <th className="text-left py-2 px-3 text-steel-500 font-semibold text-xs uppercase tracking-wide">Data/Hora</th>
          </tr>
        </thead>
        <tbody>
          {tentativas.data.map((t, i) => {
            const colors = STATUS_COLORS[t.status] || STATUS_COLORS.MFA_DESABILITADO;
            return (
              <tr key={t.id} className="border-b border-surface-100 hover:bg-surface-50 transition-colors stagger-item">
                <td className="py-2.5 px-3">
                  <div className="font-medium text-steel-800">{t.usuario_nome || t.username || '—'}</div>
                  <div className="text-xs text-steel-400">{t.username}</div>
                </td>
                <td className="py-2.5 px-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                    {t.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-steel-600">
                  {t.distancia_metros != null
                    ? `${t.distancia_metros >= 1000 ? (t.distancia_metros / 1000).toFixed(1) + ' km' : t.distancia_metros + ' m'}`
                    : '—'
                  }
                </td>
                <td className="py-2.5 px-3 font-mono text-steel-500 text-xs">{t.ip || '—'}</td>
                <td className="py-2.5 px-3 text-steel-500 text-xs">
                  {new Date(t.criado_em).toLocaleString('pt-BR')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
const Seguranca = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [position, setPosition] = useState(null);
  const [raio, setRaio] = useState(1000);
  const [descricao, setDescricao] = useState('');
  const [mapCenter, setMapCenter] = useState(null);
  const [statusFiltro, setStatusFiltro] = useState('');
  const [activeTab, setActiveTab] = useState('config');
  const [saveMsg, setSaveMsg] = useState('');
  const [perfisIsentos, setPerfisIsentos] = useState(['admin']);

  // Verificar permissão
  if (user?.perfil !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Lock className="w-12 h-12 text-steel-300 mx-auto mb-3" />
          <h2 className="font-bold text-steel-700 mb-1">Acesso Restrito</h2>
          <p className="text-sm text-steel-400">Esta área é exclusiva para administradores.</p>
        </div>
      </div>
    );
  }

  // ─── Queries ────────────────────────────────────────────────────
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['seguranca', 'geo-mfa'],
    queryFn: async () => (await api.get('/seguranca/geo-mfa')).data,
  });

  const { data: tentativas, isLoading: loadingTentativas } = useQuery({
    queryKey: ['seguranca', 'tentativas', statusFiltro],
    queryFn: async () => (await api.get('/seguranca/geo-mfa/tentativas', {
      params: { status: statusFiltro || undefined, limit: 50 }
    })).data,
    enabled: activeTab === 'tentativas',
  });

  // Sincronizar estado com dados do servidor
  useEffect(() => {
    if (config) {
      if (config.latitude && config.longitude) {
        const pos = { lat: parseFloat(config.latitude), lng: parseFloat(config.longitude) };
        setPosition(pos);
        setMapCenter(pos);
      }
      if (config.raio_metros) setRaio(config.raio_metros);
      if (config.descricao) setDescricao(config.descricao || '');
      if (config.perfis_isentos) {
        const parsed = Array.isArray(config.perfis_isentos)
          ? config.perfis_isentos
          : (typeof config.perfis_isentos === 'string' ? JSON.parse(config.perfis_isentos) : ['admin']);
        setPerfisIsentos(parsed);
      }
    }
  }, [config]);

  // ─── Mutations ──────────────────────────────────────────────────
  const salvarConfig = useMutation({
    mutationFn: (dados) => api.post('/seguranca/geo-mfa', dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca'] });
      setSaveMsg('Configuração salva com sucesso!');
      setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  const toggleMfa = useMutation({
    mutationFn: (ativo) => api.patch('/seguranca/geo-mfa/toggle', { ativo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seguranca'] }),
  });

  const salvarPerfisIsentos = useMutation({
    mutationFn: (dados) => api.patch('/seguranca/geo-mfa/perfis-isentos', dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seguranca'] });
      setSaveMsg('Perfis isentos atualizados com sucesso!');
      setTimeout(() => setSaveMsg(''), 3000);
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────
  const handleMapClick = useCallback((latlng) => {
    setPosition({ lat: latlng.lat, lng: latlng.lng });
  }, []);

  const handleLocationFound = useCallback((latlng) => {
    setPosition(latlng);
    setMapCenter(latlng);
  }, []);

  const handleTogglePerfil = (perfil) => {
    let novosPerfis;
    if (perfisIsentos.includes(perfil)) {
      novosPerfis = perfisIsentos.filter(p => p !== perfil);
    } else {
      novosPerfis = [...perfisIsentos, perfil];
    }
    setPerfisIsentos(novosPerfis);
    salvarPerfisIsentos.mutate({ perfis_isentos: novosPerfis });
  };

  const handleSave = () => {
    if (!position) return;
    salvarConfig.mutate({
      latitude: position.lat,
      longitude: position.lng,
      raio_metros: raio,
      descricao: descricao || undefined,
    });
  };

  const handleToggle = () => {
    toggleMfa.mutate(!config?.ativo);
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-red-800 flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-steel-800">Segurança Avançada</h1>
          </div>
          <p className="text-steel-400 text-sm ml-12">Configurações de MFA Geográfico e auditoria de acesso</p>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
          config?.ativo
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-50 text-slate-600 border-slate-200'
        }`}>
          {config?.ativo ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          MFA Geográfico: {config?.ativo ? 'ATIVO' : 'INATIVO'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
        {[
          { id: 'config', label: 'Configuração', icon: MapPin },
          { id: 'tentativas', label: 'Tentativas de Acesso', icon: Activity },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-accent shadow-sm'
                : 'text-steel-500 hover:text-steel-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Configuração ── */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Painel de configuração */}
          <div className="lg:col-span-1 space-y-4">
            {/* Card toggle MFA */}
            <div className="bg-white rounded-xl border border-surface-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-steel-800 text-sm">MFA Geográfico</h3>
                  <p className="text-xs text-steel-400 mt-0.5">
                    {config?.ativo ? 'Login bloqueado fora do raio' : 'Sem restrição geográfica'}
                  </p>
                </div>
                <button
                  onClick={handleToggle}
                  disabled={toggleMfa.isPending || (!position && !config?.ativo)}
                  className={`text-3xl transition-all duration-300 disabled:opacity-40 ${
                    config?.ativo ? 'text-accent hover:text-red-700' : 'text-steel-300 hover:text-steel-400'
                  }`}
                  title={config?.ativo ? 'Desativar MFA' : 'Ativar MFA'}
                >
                  {config?.ativo
                    ? <ToggleRight className="w-10 h-10 text-accent" />
                    : <ToggleLeft className="w-10 h-10 text-steel-300" />
                  }
                </button>
              </div>
              {config?.ativo && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Logins serão verificados contra a localização configurada
                </div>
              )}
              {!position && !config?.latitude && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700 mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Configure uma localização antes de ativar
                </div>
              )}
            </div>

            {/* Card busca de endereço */}
            <div className="bg-white rounded-xl border border-surface-200 p-5 shadow-sm">
              <h3 className="font-bold text-steel-800 text-sm mb-3">Pesquisar Localização</h3>
              <AddressSearch onLocationFound={handleLocationFound} />
              <p className="text-xs text-steel-400 mt-2">
                Ou clique diretamente no mapa para definir o ponto
              </p>
            </div>

            {/* Card raio e coordenadas */}
            <div className="bg-white rounded-xl border border-surface-200 p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-steel-800 text-sm">Parâmetros</h3>

              <div>
                <label className="label mb-2">Raio Permitido</label>
                <div className="grid grid-cols-3 gap-2">
                  {RAIOS_DISPONIVEIS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setRaio(r.value)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        raio === r.value
                          ? 'bg-accent text-white border-accent shadow-sm'
                          : 'bg-surface-50 text-steel-600 border-surface-200 hover:border-accent hover:text-accent'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Descrição (opcional)</label>
                <input
                  className="input w-full"
                  placeholder="Ex: Sede principal"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                />
              </div>

              {position && (
                <div className="bg-surface-50 rounded-lg p-3 text-xs font-mono text-steel-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-steel-400">Latitude:</span>
                    <span>{position.lat.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-steel-400">Longitude:</span>
                    <span>{position.lng.toFixed(6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-steel-400">Raio:</span>
                    <span>{raio >= 1000 ? `${raio / 1000} km` : `${raio} m`}</span>
                  </div>
                </div>
              )}

              {saveMsg && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm text-emerald-700 badge-pop">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveMsg}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={!position || salvarConfig.isPending}
                className="btn-primary w-full justify-center"
              >
                {salvarConfig.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>
                  : <><Save className="w-4 h-4" /> Salvar Configuração</>
                }
              </button>
            </div>

            {/* Card Perfis Isentos */}
            <div className="bg-white rounded-xl border border-surface-200 p-5 shadow-sm space-y-3">
              <div>
                <h3 className="font-bold text-steel-800 text-sm">Cargos Isentos do MFA</h3>
                <p className="text-xs text-steel-400 mt-0.5">
                  Selecione quais cargos não passarão pela restrição geográfica
                </p>
              </div>

              <div className="space-y-2 pt-2">
                {(config?.todos_perfis || [
                  'admin',
                  'supervisor_turno',
                  'gerente_manutencao',
                  'comprador',
                  'facilitador',
                  'eng_processos',
                  'operador'
                ]).map((perfil) => {
                  const isChecked = perfisIsentos.includes(perfil);
                  return (
                    <label
                      key={perfil}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-surface-100 hover:bg-surface-50 cursor-pointer select-none transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePerfil(perfil)}
                        disabled={salvarPerfisIsentos.isPending}
                        className="rounded border-steel-300 text-accent focus:ring-accent w-4 h-4 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-steel-750 capitalize">
                        {perfil.replace(/_/g, ' ')}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mapa */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden shadow-sm" style={{ height: 540 }}>
              <div className="px-5 py-3 border-b border-surface-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-steel-400" />
                <span className="text-sm font-semibold text-steel-700">
                  {position
                    ? `Localização definida — Raio: ${raio >= 1000 ? `${raio / 1000} km` : `${raio} m`}`
                    : 'Clique no mapa para definir a localização autorizada'
                  }
                </span>
              </div>
              <div className="map-enter" style={{ height: 492 }}>
                <MapContainer
                  center={position || [-15.7801, -47.9292]} // Brasília como default
                  zoom={position ? 14 : 5}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {mapCenter && <MapCenterControl center={mapCenter} />}
                  <MapClickHandler onMapClick={handleMapClick} />

                  {position && (
                    <>
                      <Marker position={[position.lat, position.lng]} />
                      <Circle
                        center={[position.lat, position.lng]}
                        radius={raio}
                        pathOptions={{
                          color: '#005dff',
                          fillColor: '#005dff',
                          fillOpacity: 0.08,
                          weight: 2,
                          dashArray: '6 4',
                        }}
                      />
                    </>
                  )}
                </MapContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Tentativas de Acesso ── */}
      {activeTab === 'tentativas' && (
        <div className="bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-surface-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-bold text-steel-800">Histórico de Verificações Geográficas</h3>
            <div className="flex gap-2">
              {['', 'PERMITIDO', 'BLOQUEADO', 'SEM_LOCALIZACAO'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFiltro(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    statusFiltro === s
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface-50 text-steel-600 border-surface-200 hover:border-steel-300'
                  }`}
                >
                  {s || 'Todos'}
                </button>
              ))}
            </div>
          </div>
          <div className="p-2">
            {loadingTentativas
              ? <div className="text-center py-12 text-steel-400 text-sm">Carregando tentativas...</div>
              : <TentativasTable tentativas={tentativas} />
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default Seguranca;
