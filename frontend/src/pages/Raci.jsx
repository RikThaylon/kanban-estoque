import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Search, ArrowDown, AlertTriangle,
  CreditCard, Lock, Scale, Timer, Layers, Workflow,
  Search as SearchIcon, Plug, Calculator, Truck, GitBranch, Save, Plus, Trash2,
} from 'lucide-react';
import { PROBLEMAS, PAPEIS, CATEGORIAS } from '../data/raci.data';
import { useAuthStore } from '../stores/authStore';

const ICONES = {
  card: CreditCard,
  lock: Lock,
  scale: Scale,
  timer: Timer,
  layers: Layers,
  workflow: Workflow,
  search: SearchIcon,
  plug: Plug,
  calculator: Calculator,
  alert: AlertTriangle,
  truck: Truck,
};

const LETRA_INFO = {
  R: { label: 'Responsável', cor: 'bg-emerald-600 text-white font-bold shadow-sm', desc: 'Executa a ação' },
  A: { label: 'Aprovador',   cor: 'bg-accent text-white font-black shadow-sm ring-2 ring-red-300', desc: 'Responde pelo resultado' },
  C: { label: 'Consultado',  cor: 'bg-amber-500 text-white font-bold shadow-sm', desc: 'Opina antes' },
  I: { label: 'Informado',   cor: 'bg-slate-600 text-white font-bold shadow-sm', desc: 'Recebe ciência' },
};

const Raci = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.perfil === 'admin';
  const [problemas, setProblemas] = useState(() => {
    try {
      const saved = localStorage.getItem('raci.custom');
      return saved ? JSON.parse(saved) : PROBLEMAS;
    } catch {
      return PROBLEMAS;
    }
  });
  const [busca, setBusca] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('todas');
  const [problemaAberto, setProblemaAberto] = useState(null);
  const [aba, setAba] = useState('fluxo'); // 'fluxo' | 'tabela'

  const filtrados = useMemo(() => {
    return problemas.filter((p) => {
      const matchCat = categoriaSel === 'todas' || p.categoria === categoriaSel;
      const matchBusca = !busca || p.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                         p.descricao.toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [problemas, busca, categoriaSel]);

  useEffect(() => {
    localStorage.setItem('raci.custom', JSON.stringify(problemas));
  }, [problemas]);

  const atualizarProblema = (id, updater) => {
    setProblemas((prev) => {
      let atualizado = null;
      const next = prev.map((p) => {
        if (p.id !== id) return p;
        atualizado = typeof updater === 'function' ? updater(p) : { ...p, ...updater };
        return atualizado;
      });
      if (atualizado) setProblemaAberto(atualizado);
      return next;
    });
  };

  const novoProblema = () => {
    const id = `custom-${Date.now()}`;
    const problema = {
      id,
      titulo: 'Novo problema',
      categoria: CATEGORIAS[0]?.key || 'geral',
      descricao: 'Descreva o problema e quando esta matriz deve ser usada.',
      iconeKey: 'workflow',
      fluxo: [{ titulo: 'Nova etapa', descricao: 'Descreva a etapa.', papel: 'facilitador' }],
      raci: Object.fromEntries(PAPEIS.map((papel) => [papel.key, ''])),
    };
    setProblemas((prev) => [problema, ...prev]);
    setProblemaAberto(problema);
    setAba('fluxo');
  };

  const excluirProblema = (id) => {
    if (!window.confirm('Excluir este item da matriz RACI?')) return;
    setProblemas((prev) => prev.filter((p) => p.id !== id));
    setProblemaAberto(null);
  };

  const abrir = (problema) => {
    setProblemaAberto(problema);
    setAba('fluxo');
  };

  const Icone = problemaAberto ? (ICONES[problemaAberto.iconeKey] || AlertTriangle) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steel-800">Matriz RACI - Mapa de problemas</h1>
          <p className="text-steel-400 text-sm">
            Clique em qualquer caixa para ver o fluxograma e a matriz RACI especifica daquele problema.
          </p>
        </div>
        {isAdmin && (
          <button onClick={novoProblema} className="btn-primary justify-center">
            <Plus className="w-4 h-4 mr-2" /> Novo item
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-steel-300" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar problema..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-surface-200 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde bg-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCategoriaSel('todas')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-all ${categoriaSel === 'todas' ? 'bg-gradient-to-r from-accent to-red-800 text-white shadow-sm' : 'bg-white text-steel-600 hover:bg-surface-100 border border-surface-200'}`}
          >
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoriaSel(c.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap transition-all ${categoriaSel === c.key ? 'bg-gradient-to-r from-accent to-red-800 text-white shadow-sm' : 'bg-white text-steel-600 hover:bg-surface-100 border border-surface-200'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map((p) => {
          const Icone = ICONES[p.iconeKey] || AlertTriangle;
          const cat = CATEGORIAS.find((c) => c.key === p.categoria);
          return (
            <motion.button
              key={p.id}
              onClick={() => abrir(p)}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              className={`relative text-left rounded-lg bg-white border border-surface-200 border-l-4 p-5 cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow ${cat?.cor || 'border-l-slate-400'}`}
            >
              <motion.div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${cat?.bgIcon || 'bg-slate-50'}`}>
                <Icone className={`w-5 h-5 ${cat ? cat.cor.split(' ')[1] : 'text-slate-500'}`} />
              </motion.div>
              <motion.h3 className="font-bold text-slate-800 leading-tight mb-1">
                {p.titulo}
              </motion.h3>
              <motion.p className="text-xs text-slate-500 line-clamp-2">
                {p.descricao}
              </motion.p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-accent">
                Ver fluxograma e RACI <ChevronRight className="w-3 h-3" />
              </div>
            </motion.button>
          );
        })}
        {filtrados.length === 0 && (
          <div className="col-span-full text-center py-12 text-steel-400">
            Nenhum problema corresponde a busca.
          </div>
        )}
      </div>

      <AnimatePresence>
        {problemaAberto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-40 overflow-y-auto p-3 sm:p-6"
            onClick={() => setProblemaAberto(null)}
          >
            <motion.div
              className="bg-white rounded-lg shadow-2xl w-full max-w-5xl mx-auto my-3 sm:my-6 max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative p-4 sm:p-6 bg-gradient-to-br from-navy-700 to-navy-800 text-white">
                <button
                  onClick={() => setProblemaAberto(null)}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
                <motion.div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-white shadow-md flex items-center justify-center mb-3">
                  {Icone && <Icone className="w-7 h-7 text-steel-700" />}
                </motion.div>
                {isAdmin ? (
                  <div className="grid gap-3 pr-10 sm:pr-12 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
                    <input
                      value={problemaAberto.titulo}
                      onChange={(e) => atualizarProblema(problemaAberto.id, { ...problemaAberto, titulo: e.target.value })}
                      className="min-w-0 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xl sm:text-2xl font-bold text-white placeholder:text-white/50"
                    />
                    <select
                      value={problemaAberto.categoria}
                      onChange={(e) => atualizarProblema(problemaAberto.id, { ...problemaAberto, categoria: e.target.value })}
                      className="rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white"
                    >
                      {CATEGORIAS.map((categoria) => (
                        <option key={categoria.key} value={categoria.key} className="text-steel-800">
                          {categoria.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => excluirProblema(problemaAberto.id)}
                      className="h-11 w-11 rounded-md bg-red-500/20 text-white hover:bg-red-500/30 flex items-center justify-center"
                      title="Excluir item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <motion.h2 className="pr-10 text-xl sm:text-2xl font-bold leading-tight break-words">
                    {problemaAberto.titulo}
                  </motion.h2>
                )}
                {isAdmin ? (
                  <textarea
                    value={problemaAberto.descricao}
                    onChange={(e) => atualizarProblema(problemaAberto.id, { ...problemaAberto, descricao: e.target.value })}
                    className="mt-3 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                    rows={2}
                  />
                ) : (
                  <motion.p className="text-sm text-steel-200 mt-1">
                    {problemaAberto.descricao}
                  </motion.p>
                )}
                {isAdmin && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-steel-100">
                    <Save className="w-3.5 h-3.5" />
                    Alterações salvas neste navegador
                  </div>
                )}
              </div>

              <div className="border-b border-surface-200 px-4 sm:px-6">
                <div className="flex gap-1 overflow-x-auto">
                  <TabButton active={aba === 'fluxo'} onClick={() => setAba('fluxo')} icon={GitBranch}>
                    Fluxograma
                  </TabButton>
                  <TabButton active={aba === 'tabela'} onClick={() => setAba('tabela')} icon={Layers}>
                    Matriz RACI
                  </TabButton>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {aba === 'fluxo' && (
                  <Fluxograma
                    problema={problemaAberto}
                    canEdit={isAdmin}
                    onChangeStep={(index, changes) => atualizarProblema(problemaAberto.id, (p) => ({
                      ...p,
                      fluxo: p.fluxo.map((step, i) => i === index ? { ...step, ...changes } : step),
                    }))}
                    onAddStep={() => atualizarProblema(problemaAberto.id, (p) => ({
                      ...p,
                      fluxo: [...p.fluxo, { titulo: 'Nova etapa', descricao: 'Descreva a etapa.', papel: 'facilitador' }],
                    }))}
                    onRemoveStep={(index) => atualizarProblema(problemaAberto.id, (p) => ({
                      ...p,
                      fluxo: p.fluxo.filter((_, i) => i !== index),
                    }))}
                  />
                )}
                {aba === 'tabela' && (
                  <TabelaRaci
                    problema={problemaAberto}
                    canEdit={isAdmin}
                    onChangeLetra={(papel, letra) => atualizarProblema(problemaAberto.id, (p) => ({
                      ...p,
                      raci: { ...p.raci, [papel]: letra },
                    }))}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TabButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${active ? 'border-accent text-accent font-bold' : 'border-transparent text-steel-400 hover:text-steel-700'}`}
  >
    <Icon className="w-4 h-4" /> {children}
  </button>
);

const Fluxograma = ({ problema, canEdit, onChangeStep, onAddStep, onRemoveStep }) => {
  return (
    <div className="space-y-3">
      {problema.fluxo.map((step, i) => {
        const papel = PAPEIS.find((p) => p.key === step.papel);
        return (
          <React.Fragment key={i}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="bg-surface-50 border border-surface-200 rounded-lg p-4 flex gap-4 items-start"
            >
              <div className="w-8 h-8 rounded-full bg-navy-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                {canEdit ? (
                  <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_180px_40px]">
                      <input
                        value={step.titulo}
                        onChange={(e) => onChangeStep(i, { titulo: e.target.value })}
                        className="input text-sm font-semibold"
                      />
                      <select
                        value={step.papel}
                        onChange={(e) => onChangeStep(i, { papel: e.target.value })}
                        className="input text-sm"
                      >
                        {PAPEIS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                      {problema.fluxo.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveStep(i)}
                          className="h-10 w-10 rounded-md text-red-600 hover:bg-red-50 flex items-center justify-center"
                          title="Excluir etapa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      value={step.descricao}
                      onChange={(e) => onChangeStep(i, { descricao: e.target.value })}
                      className="input text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2 flex-wrap">
                      <h4 className="font-semibold text-steel-800">{step.titulo}</h4>
                      {papel && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${papel.cor}`}>
                          {papel.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-steel-500 mt-1">{step.descricao}</p>
                  </>
                )}
              </div>
            </motion.div>
            {i < problema.fluxo.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06 + 0.03 }}
                className="flex justify-start pl-4"
              >
                <ArrowDown className="w-4 h-4 text-steel-300" />
              </motion.div>
            )}
          </React.Fragment>
        );
      })}
      {canEdit && (
        <button type="button" onClick={onAddStep} className="btn-secondary justify-center w-full">
          <Plus className="w-4 h-4 mr-2" /> Adicionar etapa
        </button>
      )}
    </div>
  );
};

const TabelaRaci = ({ problema, canEdit, onChangeLetra }) => {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full">
          <thead>
            <tr>
              <th className="text-left text-xs uppercase tracking-wide text-steel-400 pb-2">Papel</th>
              <th className="text-center text-xs uppercase tracking-wide text-steel-400 pb-2 w-20">Funcao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100">
            {PAPEIS.map((papel) => {
              const letra = problema.raci[papel.key];
              const info = letra ? LETRA_INFO[letra] : null;
              return (
                <tr key={papel.key} className={letra ? '' : 'opacity-40'}>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold w-9 text-center px-2 py-0.5 rounded-full ${papel.cor}`}>
                        {papel.sigla}
                      </span>
                      <span className="text-sm font-medium text-steel-700">{papel.label}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    {canEdit ? (
                      <select
                        value={letra || ''}
                        onChange={(e) => onChangeLetra(papel.key, e.target.value)}
                        className="input mx-auto h-9 w-20 text-center font-bold"
                      >
                        <option value="">-</option>
                        <option value="R">R</option>
                        <option value="A">A</option>
                        <option value="C">C</option>
                        <option value="I">I</option>
                      </select>
                    ) : letra && (
                      <div className="inline-flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${info.cor}`}>
                          {letra}
                        </span>
                        <span className="text-xs text-steel-500 hidden sm:inline">{info.label}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-surface-50 rounded-lg p-4">
        <h5 className="text-xs font-bold text-steel-500 uppercase tracking-wide mb-2">Legenda</h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(LETRA_INFO).map(([letra, info]) => (
            <div key={letra} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${info.cor}`}>
                {letra}
              </span>
              <div>
                <div className="text-xs font-bold text-steel-700">{info.label}</div>
                <div className="text-[10px] text-steel-400">{info.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Raci;
