/**
 * useAutoSave — Hook de salvamento automático de rascunhos de formulários
 *
 * Funciona de forma semelhante ao Notion/Google Docs:
 * - Salva no localStorage a cada `intervalMs` (padrão: 5s)
 * - Salva imediatamente em cada alteração de campo (debounce 800ms)
 * - Restaura automaticamente ao montar, perguntando ao usuário
 * - Limpa o rascunho após submit bem-sucedido
 * - Mostra indicador visual de "Rascunho salvo"
 *
 * @param {string} key       Chave única do formulário (ex: 'form_novo_produto')
 * @param {object} data      Valores atuais do formulário
 * @param {object} options   Opções adicionais (intervalMs, onRestore, enabled)
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const DRAFT_PREFIX = 'kanban_draft_';

export function useAutoSave(key, data, options = {}) {
  const {
    intervalMs = 5000,  // Salvar a cada 5 segundos
    debounceMs = 800,   // Debounce de 800ms ao digitar
    enabled = true,     // Permite desabilitar (ex: em modo de visualização)
    onRestore,          // Callback chamado quando o usuário aceita restaurar o rascunho
  } = options;

  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [hasDraft, setHasDraft] = useState(false);
  const [draftAge, setDraftAge] = useState(null);
  const debounceTimer = useRef(null);
  const intervalTimer = useRef(null);
  const lastSaved = useRef(null);

  // ─── Salvar rascunho ─────────────────────────────────────────────────────────
  const saveDraft = useCallback(() => {
    if (!enabled) return;
    try {
      const draft = {
        data,
        savedAt: new Date().toISOString(),
        key,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
      lastSaved.current = draft.savedAt;
      setSaveStatus('saved');

      // Voltar para 'idle' após 3 segundos
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('[useAutoSave] Erro ao salvar rascunho:', err);
      setSaveStatus('error');
    }
  }, [data, enabled, key, storageKey]);

  // ─── Limpar rascunho ─────────────────────────────────────────────────────────
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftAge(null);
    } catch (_) {}
  }, [storageKey]);

  // ─── Ler rascunho salvo ───────────────────────────────────────────────────────
  const readDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }, [storageKey]);

  // ─── Verificar se há rascunho ao montar ──────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    const draft = readDraft();
    if (!draft) return;

    // Calcular idade do rascunho
    const savedAt = new Date(draft.savedAt);
    const ageMs = Date.now() - savedAt.getTime();
    const ageMin = Math.floor(ageMs / 60000);
    const ageStr = ageMin < 60
      ? `${ageMin} minuto(s) atrás`
      : `${Math.floor(ageMin / 60)}h${ageMin % 60}min atrás`;

    setHasDraft(true);
    setDraftAge(ageStr);
  }, [enabled, readDraft]);

  // ─── Salvar ao modificar dados (debounce) ────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      // Não salvar se os dados estiverem vazios/inalterados
      const isEmpty = !data || Object.values(data).every(v => v === '' || v === null || v === undefined);
      if (isEmpty) return;
      saveDraft();
    }, debounceMs);

    return () => clearTimeout(debounceTimer.current);
  }, [data, enabled, saveDraft, debounceMs]);

  // ─── Salvar em intervalo fixo ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    intervalTimer.current = setInterval(saveDraft, intervalMs);
    return () => clearInterval(intervalTimer.current);
  }, [enabled, saveDraft, intervalMs]);

  // ─── Restaurar rascunho ───────────────────────────────────────────────────────
  const restoreDraft = useCallback(() => {
    const draft = readDraft();
    if (draft && onRestore) {
      onRestore(draft.data);
      setHasDraft(false);
      setDraftAge(null);
    }
  }, [readDraft, onRestore]);

  // ─── Descartar rascunho ────────────────────────────────────────────────────────
  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  return {
    saveStatus,   // 'idle' | 'saved' | 'error'
    hasDraft,     // true se há rascunho salvo
    draftAge,     // "5 minutos atrás"
    saveDraft,    // salvar manualmente
    clearDraft,   // limpar após submit bem-sucedido
    restoreDraft, // aceitar restauração
    discardDraft, // descartar rascunho
  };
}
