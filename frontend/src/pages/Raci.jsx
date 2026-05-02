import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Search, ArrowDown, AlertTriangle,
  CreditCard, Lock, Scale, Timer, Layers, Workflow,
  Search as SearchIcon, Plug, Calculator, Truck, GitBranch,
} from 'lucide-react';
import { PROBLEMAS, PAPEIS, CATEGORIAS } from '../data/raci.data';

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
  R: { label: 'Responsável', cor: 'bg-emerald-500 text-white', desc: 'Executa a ação' },
  A: { label: 'Aprovador',   cor: 'bg-red-500 text-white',     desc: 'Responde pelo resultado' },
  C: { label: 'Consultado',  cor: 'bg-amber-400 text-white',   desc: 'Opina antes' },
  I: { label: 'Informado',   cor: 'bg-blue-400 text-white',    desc: 'Recebe ciência' },
};

const Raci = () => {
  const [busca, setBusca] = useState('');
  const [categoriaSel, setCategoriaSel] = useState('todas');
  const [problemaAberto, setProblemaAberto] = useState(null);
  const [aba, setAba] = useState('fluxo'); // 'fluxo' | 'tabela'

  const filtrados = useMemo(() => {
    return PROBLEMAS.filter((p) => {
      const matchCat = categoriaSel === 'todas' || p.categoria === categoriaSel;
      const matchBusca = !busca || p.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                         p.descricao.toLowerCase().includes(busca.toLowerCase());
      return matchCat && matchBusca;
    });
  }, [busca, categoriaSel]);

  const abrir = (problema) => {
    setProblemaAberto(problema);
    setAba('fluxo');
  };

  const Icone = problemaAberto ? (ICONES[problemaAberto.iconeKey] || AlertTriangle) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-800">Matriz RACI — Mapa de problemas</h1>
        <p className="text-navy-400 text-sm">
          Clique em qualquer caixa para ver o fluxograma e a matriz RACI específica daquele problema.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar problema..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-surface-200 focus:ring-2 focus:ring-kanban-verde focus:border-kanban-verde bg-white"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setCategoriaSel('todas')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap ${categoriaSel === 'todas' ? 'bg-navy-700 text-white' : 'bg-white text-navy-600 hover:bg-surface-100'}`}
          >
            Todas
          </button>
          {CATEGORIAS.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategoriaSel(c.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap ${categoriaSel === c.key ? 'bg-navy-700 text-white' : 'bg-white text-navy-600 hover:bg-surface-100'}`}
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
              layoutId={`card-${p.id}`}
              onClick={() => abrir(p)}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              className={`relative text-left rounded-2xl border-2 p-5 cursor-pointer overflow-hidden ${cat?.cor || 'border-surface-200 bg-white'}`}
            >
              <motion.div layoutId={`icon-${p.id}`} className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-3">
                <Icone className="w-5 h-5 text-navy-700" />
              </motion.div>
              <motion.h3 layoutId={`title-${p.id}`} className="font-bold text-navy-800 leading-tight mb-1">
                {p.titulo}
              </motion.h3>
              <motion.p layoutId={`desc-${p.id}`} className="text-xs text-navy-500 line-clamp-2">
                {p.descricao}
              </motion.p>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-navy-600">
                Ver fluxograma e RACI <ChevronRight className="w-3 h-3" />
              </div>
            </motion.button>
          );
        })}
        {filtrados.length === 0 && (
          <div className="col-span-full text-center py-12 text-navy-400">
            Nenhum problema corresponde à busca.
          </div>
        )}
      </div>

      <AnimatePresence>
        {problemaAberto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-40 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setProblemaAberto(null)}
          >
            <motion.div
              layoutId={`card-${problemaAberto.id}`}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative p-6 bg-gradient-to-br from-navy-700 to-navy-800 text-white">
                <button
                  onClick={() => setProblemaAberto(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
                <motion.div layoutId={`icon-${problemaAberto.id}`} className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center mb-3">
                  {Icone && <Icone className="w-7 h-7 text-navy-700" />}
                </motion.div>
                <motion.h2 layoutId={`title-${problemaAberto.id}`} className="text-2xl font-bold leading-tight">
                  {problemaAberto.titulo}
                </motion.h2>
                <motion.p layoutId={`desc-${problemaAberto.id}`} className="text-sm text-navy-200 mt-1">
                  {problemaAberto.descricao}
                </motion.p>
              </div>

              <div className="border-b border-surface-200 px-6">
                <div className="flex gap-1">
                  <TabButton active={aba === 'fluxo'} onClick={() => setAba('fluxo')} icon={GitBranch}>
                    Fluxograma
                  </TabButton>
                  <TabButton active={aba === 'tabela'} onClick={() => setAba('tabela')} icon={Layers}>
                    Matriz RACI
                  </TabButton>
                </div>
              </div>

              <div className="p-6">
                {aba === 'fluxo' && <Fluxograma problema={problemaAberto} />}
                {aba === 'tabela' && <TabelaRaci problema={problemaAberto} />}
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
    className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${active ? 'border-kanban-verde text-navy-800' : 'border-transparent text-navy-400 hover:text-navy-700'}`}
  >
    <Icon className="w-4 h-4" /> {children}
  </button>
);

const Fluxograma = ({ problema }) => {
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
              className="bg-surface-50 border border-surface-200 rounded-xl p-4 flex gap-4 items-start"
            >
              <div className="w-8 h-8 rounded-full bg-navy-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h4 className="font-semibold text-navy-800">{step.titulo}</h4>
                  {papel && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${papel.cor}`}>
                      {papel.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-navy-500 mt-1">{step.descricao}</p>
              </div>
            </motion.div>
            {i < problema.fluxo.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.06 + 0.03 }}
                className="flex justify-start pl-4"
              >
                <ArrowDown className="w-4 h-4 text-navy-300" />
              </motion.div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const TabelaRaci = ({ problema }) => {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left text-xs uppercase tracking-wide text-navy-400 pb-2">Papel</th>
              <th className="text-center text-xs uppercase tracking-wide text-navy-400 pb-2 w-20">Função</th>
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
                      <span className="text-sm font-medium text-navy-700">{papel.label}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-center">
                    {letra && (
                      <div className="inline-flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${info.cor}`}>
                          {letra}
                        </span>
                        <span className="text-xs text-navy-500 hidden sm:inline">{info.label}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-surface-50 rounded-xl p-4">
        <h5 className="text-xs font-bold text-navy-500 uppercase tracking-wide mb-2">Legenda</h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(LETRA_INFO).map(([letra, info]) => (
            <div key={letra} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${info.cor}`}>
                {letra}
              </span>
              <div>
                <div className="text-xs font-bold text-navy-700">{info.label}</div>
                <div className="text-[10px] text-navy-400">{info.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Raci;
