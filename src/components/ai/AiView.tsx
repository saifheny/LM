import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Plus,
  KeyRound,
  ExternalLink,
  Image as ImageIcon,
  History,
  Pencil,
  RefreshCw,
  Search,
  Mic,
} from 'lucide-react';

import { Lang, UserProfile } from '../../types';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { MARKDOWN_LINK_COMPONENTS, RichMessageText } from '../shared/LmBrandMark';
import { QuickRemovePill } from '../shared/ActionOrb2026';
import { CloseOrbButton, StudioModalOverlay } from '../shared/ModalChrome2026';
import { SplitComposerOrb } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { AI_COMPANIES, AiCompanyDef, AiCompanyModel, shortenModelLabel } from './AiProvidersCatalog';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';
import { t } from '../../lib/i18n';

interface AiViewProps {
  user: UserProfile;
  lang: Lang;
}

interface AiTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string | null;
  transcript?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  streaming?: boolean;
  companyId?: string;
  modelLabel?: string;
  feedback?: 'up' | 'down' | null;
  needsApiKey?: boolean;
  missingProvider?: string;
}

interface AiSessionRow {
  id: string;
  title: string;
  company_id: string;
  model_id: string;
  updated_at: string;
}

export function AiView({ user, lang }: AiViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded } = useLayout();
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [sessionId, setSessionIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('lm_ai_session_id') || null;
    } catch {
      return null;
    }
  });
  const [sessions, setSessions] = useState<AiSessionRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Persistent draft across refresh AND preserved when clicking "محادثة جديدة"!
  const [prompt, setPromptState] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_draft_ai') || '';
    } catch {
      return '';
    }
  });
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string } | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2-Step Company -> Auto-Updated Models Selector (Persisted across refresh)
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_ai_company_id') || 'gemini';
    } catch {
      return 'gemini';
    }
  });
  const [selectedModelId, setSelectedModelIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_ai_model_id') || 'gemini-2.5-flash';
    } catch {
      return 'gemini-2.5-flash';
    }
  });

  const setPrompt = useCallback((v: string) => {
    setPromptState(v);
    try {
      localStorage.setItem('lm_draft_ai', v);
    } catch {
      // ignore
    }
  }, []);

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
    try {
      if (id) localStorage.setItem('lm_ai_session_id', id);
      else localStorage.removeItem('lm_ai_session_id');
    } catch {
      // ignore
    }
  }, []);

  const setSelectedCompanyId = useCallback((cid: string) => {
    setSelectedCompanyIdState(cid);
    try {
      localStorage.setItem('lm_ai_company_id', cid);
    } catch {
      // ignore
    }
  }, []);

  const setSelectedModelId = useCallback((mid: string) => {
    setSelectedModelIdState(mid);
    try {
      localStorage.setItem('lm_ai_model_id', mid);
    } catch {
      // ignore
    }
  }, []);

  const desktopTaRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = desktopTaRef.current;
    if (!el) return;
    el.style.height = '44px';
    el.style.height = `${Math.min(168, Math.max(44, el.scrollHeight))}px`;
  }, [prompt, turns.length]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [browsingCompany, setBrowsingCompany] = useState<AiCompanyDef | null>(null);
  const [modelSearch, setModelSearch] = useState('');

  // Live fetched models per company (auto-updated directly from each company's API!)
  const [liveModelsByCompany, setLiveModelsByCompany] = useState<Record<string, AiCompanyModel[]>>({});
  const [liveLoadingCompany, setLiveLoadingCompany] = useState<string | null>(null);

  const [providerStatus, setProviderStatus] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // In-Place API Key Setup Guide Sheet
  const [setupCompany, setSetupCompany] = useState<AiCompanyDef | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [setupFeedback, setSetupFeedback] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadProviderStatus = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; providers: Record<string, unknown> }>('/api/providers');
      const p = res.providers;
      const next: Record<string, boolean> = {};
      for (const comp of AI_COMPANIES) {
        next[comp.id] = comp.id === 'ollama' ? Boolean(p.ollamaUrl) : Boolean(p[comp.statusField]);
      }
      setProviderStatus(next);
    } catch {
      // ignore
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; sessions: AiSessionRow[] }>(`/api/ai/sessions?userId=${user.id}`);
      setSessions(res.sessions);
    } catch {
      // ignore
    }
  }, [user.id]);

  const fetchLiveModels = useCallback(async (companyId: string, force = false) => {
    setLiveLoadingCompany(companyId);
    try {
      const res = await apiGet<{ ok: boolean; live: boolean; models: AiCompanyModel[] }>(
        `/api/providers/${companyId}/models${force ? '?refresh=1' : ''}`
      );
      if (res.models && res.models.length > 0) {
        setLiveModelsByCompany(prev => ({ ...prev, [companyId]: res.models }));
      }
    } catch {
      // keep curated catalog seamlessly
    } finally {
      setLiveLoadingCompany(cur => (cur === companyId ? null : cur));
    }
  }, []);

  useEffect(() => {
    loadProviderStatus();
    loadSessions();
    fetchLiveModels(selectedCompanyId);
    // Restore active AI session smoothly on browser refresh!
    const savedSess = (() => {
      try {
        return localStorage.getItem('lm_ai_session_id');
      } catch {
        return null;
      }
    })();
    if (savedSess) {
      apiGet<{
        ok: boolean;
        messages: Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string;
          audio_url?: string | null;
          transcript?: string | null;
          attachment_url?: string | null;
          company_id?: string;
          model_label?: string;
        }>;
      }>(`/api/ai/sessions/${savedSess}/messages`)
        .then(res => {
          if (res.messages && res.messages.length > 0) {
            setTurns(
              res.messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                audioUrl: m.audio_url || null,
                transcript: m.transcript || null,
                attachmentUrl: m.attachment_url || null,
                companyId: m.company_id || selectedCompanyId,
                modelLabel: m.model_label ? shortenModelLabel(m.model_label) : undefined,
                feedback: null,
              }))
            );
          } else {
            setSessionId(null);
          }
        })
        .catch(() => {});
    }
  }, [loadProviderStatus, loadSessions, fetchLiveModels, selectedCompanyId, setSessionId]);

  // Auto-refresh live models whenever user drills into a company
  useEffect(() => {
    if (browsingCompany) {
      setModelSearch('');
      fetchLiveModels(browsingCompany.id);
    }
  }, [browsingCompany, fetchLiveModels]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, loading]);

  const activeCompany = AI_COMPANIES.find(c => c.id === selectedCompanyId) || AI_COMPANIES[0];
  const activeCompanyModels = liveModelsByCompany[activeCompany.id] || activeCompany.models;
  const activeModel = activeCompanyModels.find(m => m.id === selectedModelId) || activeCompanyModels[0] || activeCompany.models[0];

  function openSetupForCompany(comp: AiCompanyDef) {
    setApiKeyDraft(comp.id === 'ollama' ? 'http://localhost:11434' : '');
    setSetupFeedback('');
    setSetupCompany(comp);
  }

  async function saveInlineApiKey(e: React.FormEvent) {
    e.preventDefault();
    if (!setupCompany || !apiKeyDraft.trim()) return;
    await apiPost('/api/providers', { [setupCompany.configField]: apiKeyDraft.trim() });
    await loadProviderStatus();
    // Immediately pull live models for this newly connected company!
    fetchLiveModels(setupCompany.id, true);
    setSetupFeedback('تم الحفظ وتحديث قائمة النماذج تلقائيًا.');
    setTimeout(() => {
      setSetupCompany(null);
      setSetupFeedback('');
    }, 950);
  }

  async function openHistorySession(sess: AiSessionRow) {
    setHistoryOpen(false);
    setSessionId(sess.id);
    if (sess.company_id) setSelectedCompanyId(sess.company_id);
    if (sess.model_id) setSelectedModelId(sess.model_id);
    try {
      const res = await apiGet<{
        ok: boolean;
        messages: Array<{
          id: string;
          role: 'user' | 'assistant';
          content: string;
          audio_url?: string | null;
          transcript?: string | null;
          attachment_url?: string | null;
          company_id?: string;
          model_label?: string;
        }>;
      }>(`/api/ai/sessions/${sess.id}/messages`);
      setTurns(
        res.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          audioUrl: m.audio_url || null,
          transcript: m.transcript || null,
          attachmentUrl: m.attachment_url || null,
          companyId: m.company_id || sess.company_id,
          modelLabel: m.model_label ? shortenModelLabel(m.model_label) : undefined,
          feedback: null,
        }))
      );
    } catch {
      // ignore
    }
  }

  async function deleteSession(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    await api(`/api/ai/sessions/${id}`, { method: 'DELETE' });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (sessionId === id) {
      setSessionId(null);
      setTurns([]);
    }
  }

  function showUploadNotice(msg: string) {
    setUploadNotice(msg);
    setTimeout(() => setUploadNotice(cur => (cur === msg ? null : cur)), 3400);
  }

  async function handleAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
      showUploadNotice('يمكن إرفاق صورة واحدة فقط (JPG / PNG / WebP / GIF) بحد أقصى 8MB.');
      return;
    }
    try {
      const up = await apiUploadFile(f, 'ai_image');
      // Strictly 1 image per message — selecting a new image replaces the previous one
      setAttachedFile({ name: f.name, url: up.url });
      setUploadNotice(null);
    } catch (err) {
      showUploadNotice(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    }
  }

  async function streamAiIntoTurn(
    assistantId: string,
    payload: Record<string, unknown>,
    onDoneMeta?: (meta: {
      sessionId?: string | null;
      userMsgId?: string | null;
      transcribedPrompt?: string | null;
      modelUsed?: string;
      needsApiKey?: boolean;
      missingProvider?: string;
      reply?: string;
    }) => void
  ) {
    const resp = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok || !resp.body) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const ev = JSON.parse(jsonStr) as {
            type: 'delta' | 'done' | 'error';
            text?: string;
            message?: string;
            reply?: string;
            modelUsed?: string;
            sessionId?: string | null;
            userMsgId?: string | null;
            transcribedPrompt?: string | null;
            needsApiKey?: boolean;
            missingProvider?: string;
          };
          if (ev.type === 'delta' && ev.text) {
            setTurns(prev =>
              prev.map(t => (t.id === assistantId ? { ...t, content: t.content + ev.text } : t))
            );
          } else if (ev.type === 'done') {
            setTurns(prev =>
              prev.map(t =>
                t.id === assistantId
                  ? {
                      ...t,
                      content: t.content || ev.reply || '',
                      streaming: false,
                      modelLabel: shortenModelLabel(ev.modelUsed || activeModel.label),
                      needsApiKey: ev.needsApiKey,
                      missingProvider: ev.missingProvider,
                    }
                  : t
              )
            );
            onDoneMeta?.(ev);
          } else if (ev.type === 'error') {
            setTurns(prev =>
              prev.map(t =>
                t.id === assistantId
                  ? { ...t, content: ev.message || 'تعذر الاتصال بالمساعد.', streaming: false }
                  : t
              )
            );
          }
        } catch {
          // ignore partial JSON frame
        }
      }
    }
  }

  async function sendPrompt(textToSend: string, reuseLastUser = false) {
    const clean = textToSend.trim();
    const currentAttachment = attachedFile;
    if ((!clean && !currentAttachment) || loading) return;
    setPrompt('');
    setComposerFocused(false);
    setAttachedFile(null);

    const apiPrompt = clean || (currentAttachment ? 'حلّل هذه الصورة بالتفصيل' : '');
    const assistantId = `a_${Date.now()}`;

    if (!reuseLastUser) {
      setTurns(prev => [
        ...prev,
        {
          id: `u_${Date.now()}`,
          role: 'user',
          content: clean,
          attachmentUrl: currentAttachment?.url || null,
          attachmentName: currentAttachment?.name || null,
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          streaming: true,
          companyId: activeCompany.id,
          modelLabel: shortenModelLabel(activeModel.label),
          feedback: null,
        },
      ]);
    } else {
      setTurns(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          streaming: true,
          companyId: activeCompany.id,
          modelLabel: shortenModelLabel(activeModel.label),
          feedback: null,
        },
      ]);
    }
    setLoading(true);

    try {
      await streamAiIntoTurn(
        assistantId,
        {
          userId: user.id,
          prompt: apiPrompt,
          attachmentUrl: currentAttachment?.url || null,
          attachmentName: currentAttachment?.name || null,
          provider: activeCompany.id,
          model: activeModel.id,
          sessionId,
          source: 'ai_tab',
          explicitUserConsent: true,
        },
        ev => {
          if (ev.sessionId) {
            setSessionId(ev.sessionId);
            loadSessions();
          }
          if (ev.needsApiKey && ev.missingProvider) {
            const comp = AI_COMPANIES.find(c => c.id === ev.missingProvider);
            if (comp) openSetupForCompany(comp);
          }
        }
      );
    } catch (e) {
      setTurns(prev =>
        prev.map(t =>
          t.id === assistantId
            ? {
                ...t,
                content: e instanceof Error ? e.message : 'تعذر الاتصال بالمساعد.',
                streaming: false,
              }
            : t
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSendVoicePrompt(file: File, _durationSec: number, liveTranscript?: string | null) {
    setRecordingVoice(false);
    if (loading) return;
    setLoading(true);
    const tempUserId = `u_voice_${Date.now()}`;
    const assistantId = `a_${Date.now() + 1}`;
    try {
      const up = await apiUploadFile(file, 'voice');
      setTurns(prev => [
        ...prev,
        {
          id: tempUserId,
          role: 'user',
          content: 'رسالة صوتية',
          audioUrl: up.url,
          transcript: liveTranscript || null,
        },
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          streaming: true,
          companyId: activeCompany.id,
          modelLabel: shortenModelLabel(activeModel.label),
          feedback: null,
        },
      ]);

      await streamAiIntoTurn(
        assistantId,
        {
          userId: user.id,
          prompt: '',
          audioUrl: up.url,
          transcript: liveTranscript || null,
          provider: activeCompany.id,
          model: activeModel.id,
          sessionId,
          source: 'ai_tab',
          explicitUserConsent: true,
        },
        ev => {
          if (ev.sessionId) {
            setSessionId(ev.sessionId);
            loadSessions();
          }
          setTurns(prev =>
            prev.map(t =>
              t.id === tempUserId
                ? {
                    ...t,
                    id: ev.userMsgId || t.id,
                    transcript: ev.transcribedPrompt || t.transcript,
                  }
                : t
            )
          );
          if (ev.needsApiKey && ev.missingProvider) {
            const comp = AI_COMPANIES.find(c => c.id === ev.missingProvider);
            if (comp) openSetupForCompany(comp);
          }
        }
      );
    } catch (e) {
      setTurns(prev =>
        prev.map(t =>
          t.id === assistantId
            ? {
                ...t,
                content: e instanceof Error ? e.message : 'تعذر معالجة الرسالة الصوتية.',
                streaming: false,
              }
            : t
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function toggleFeedback(id: string, val: 'up' | 'down') {
    setTurns(prev => prev.map(t => (t.id === id ? { ...t, feedback: t.feedback === val ? null : val } : t)));
  }

  function regenerateFrom(aiIdx: number) {
    for (let i = aiIdx - 1; i >= 0; i--) {
      if (turns[i].role === 'user') {
        sendPrompt(turns[i].content, true);
        break;
      }
    }
  }

  const browsingListRaw = browsingCompany
    ? liveModelsByCompany[browsingCompany.id] || browsingCompany.models
    : [];
  const browsingListFiltered = modelSearch.trim()
    ? browsingListRaw.filter(
        m =>
          m.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
          m.id.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : browsingListRaw;

  return (
    <div
      onClick={() => {
        setPickerOpen(false);
        setBrowsingCompany(null);
        setHistoryOpen(false);
        setComposerFocused(false);
        setMobileNavExpanded(false);
      }}
      className="h-full w-full bg-[#0A0A0C] text-[#F2F2F5] relative flex flex-col overflow-hidden"
    >
      {/* FLOATING COMPACT MODEL PILL + SAVED HISTORY TRIGGER (Zero Top Header Bar!) */}
      <div
        onClick={e => e.stopPropagation()}
        className="absolute top-3.5 inset-x-4 z-30 flex items-center justify-between pointer-events-none"
      >
        {/* Compact Official Logo + Short Model Name Pill */}
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setPickerOpen(v => !v);
              setBrowsingCompany(null);
              setHistoryOpen(false);
            }}
            className="h-10 px-3.5 rounded-full bg-[#14141A]/90 backdrop-blur-xl border border-white/[0.11] hover:border-white/25 text-xs font-medium text-[#F2F2F5] flex items-center gap-2 cursor-pointer shadow-lg transition-colors"
          >
            <span className="flex items-center justify-center shrink-0">{activeCompany.renderLogo(17)}</span>
            <span className="font-semibold text-white">{shortenModelLabel(activeModel.label)}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>

          {/* 2-Step Floating 12-Company & Live-Updated Models Directory */}
          {pickerOpen && (
            <div className="absolute top-12 start-0 w-[305px] sm:w-[330px] max-h-[68vh] overflow-y-auto rounded-2xl bg-[#131319]/96 backdrop-blur-2xl border border-white/[0.13] p-2 shadow-2xl z-40">
              {!browsingCompany ? (
                <div className="space-y-0.5">
                  <div className="px-2.5 py-1.5 text-[11px] text-[#7A7A85] flex items-center justify-between">
                    <span>اختر الشركة</span>
                    <span className="font-mono-num">{AI_COMPANIES.length}</span>
                  </div>

                  {AI_COMPANIES.map(comp => {
                    const configured = Boolean(providerStatus[comp.id]);
                    const isCurrent = comp.id === selectedCompanyId;
                    const count = (liveModelsByCompany[comp.id] || comp.models).length;
                    return (
                      <div
                        key={comp.id}
                        className={`rounded-xl px-2 py-2 flex items-center justify-between gap-2 transition-colors ${
                          isCurrent ? 'bg-white/[0.09]' : 'hover:bg-white/[0.05]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setBrowsingCompany(comp)}
                          className="flex-1 flex items-center gap-2.5 text-start cursor-pointer min-w-0"
                        >
                          <span className="w-7 h-7 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                            {comp.renderLogo(17)}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white flex items-center gap-1.5 truncate">
                              <span>{comp.name}</span>
                              {configured && <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" />}
                            </div>
                            <div className="text-[10px] text-[#7A7A85]">{count} نموذج</div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPickerOpen(false);
                              openSetupForCompany(comp);
                            }}
                            className={`px-2 py-1 rounded-full text-[10.5px] flex items-center gap-1 cursor-pointer transition-colors ${
                              configured
                                ? 'bg-white/[0.07] text-[#C4C4CC] hover:bg-white hover:text-black'
                                : 'bg-white/[0.11] text-white hover:bg-white hover:text-black'
                            }`}
                          >
                            <KeyRound className="w-2.5 h-2.5" />
                            <span>{configured ? 'تعديل' : 'مفتاح'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setBrowsingCompany(comp)}
                            className="w-6 h-6 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
                          >
                            {lang === 'ar' ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="px-2 py-1.5 border-b border-white/[0.08] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setBrowsingCompany(null)}
                      className="text-xs text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {lang === 'ar' ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                      <span>الشركات</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      {browsingCompany.renderLogo(15)}
                      <span>{browsingCompany.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fetchLiveModels(browsingCompany.id, true)}
                        title="تحديث النماذج الآن"
                        className="w-6 h-6 rounded-full hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${liveLoadingCompany === browsingCompany.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPickerOpen(false);
                          openSetupForCompany(browsingCompany);
                        }}
                        className="w-6 h-6 rounded-full hover:bg-white/[0.08] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <KeyRound className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {browsingListRaw.length > 6 && (
                    <div className="px-1.5">
                      <div className="h-8 rounded-xl bg-[#0A0A0C] border border-white/[0.08] px-2.5 flex items-center gap-1.5">
                        <Search className="w-3 h-3 text-[#7A7A85]" />
                        <input
                          value={modelSearch}
                          onChange={e => setModelSearch(e.target.value)}
                          placeholder="بحث في النماذج..."
                          className="flex-1 bg-transparent text-[11.5px] text-white placeholder:text-[#585860] outline-none"
                        />
                      </div>
                    </div>
                  )}

                  <div className="max-h-[44vh] overflow-y-auto space-y-0.5">
                    {browsingListFiltered.map(m => {
                      const active = selectedCompanyId === browsingCompany.id && selectedModelId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedCompanyId(browsingCompany.id);
                            setSelectedModelId(m.id);
                            setPickerOpen(false);
                            setBrowsingCompany(null);
                          }}
                          className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                            active ? 'bg-white text-black font-semibold' : 'text-[#E4E4E7] hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className="truncate">{m.label}</span>
                          {m.tag && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono-num shrink-0 ${
                                active ? 'bg-black/15 text-black' : 'bg-white/[0.07] text-[#9E9EA8]'
                              }`}
                            >
                              {m.tag}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating History & New Chat Triggers */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setHistoryOpen(v => !v);
              setPickerOpen(false);
              loadSessions();
            }}
            title="المحادثات السابقة"
            className={`h-9 px-3 rounded-full bg-[#14141A]/90 backdrop-blur-xl border text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors ${
              historyOpen ? 'border-white/35 text-white' : 'border-white/[0.1] text-[#D4D4D8] hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t(lang, 'ai_history')}</span>
          </button>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTurns([]);
                setSessionId(null);
              }}
              className="h-9 px-3 rounded-full bg-[#14141A]/90 backdrop-blur-xl border border-white/[0.1] hover:border-white/25 text-xs text-[#D4D4D8] hover:text-white flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(lang, 'ai_new_chat')}</span>
            </button>
          )}
        </div>
      </div>

      {/* FLOATING SAVED CONVERSATIONS HISTORY DRAWER (Tap Anywhere Outside to Close — ZERO X Button!) */}
      {historyOpen && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute top-16 end-4 z-40 w-[290px] max-h-[65vh] rounded-2xl bg-[#131319]/96 backdrop-blur-2xl border border-white/[0.13] overflow-hidden shadow-2xl flex flex-col"
        >
          <div className="px-3.5 py-2.5 border-b border-white/[0.08] flex items-center justify-between text-xs">
            <span className="font-semibold text-white">المحادثات السابقة</span>
            <button
              type="button"
              onClick={() => {
                setTurns([]);
                setSessionId(null);
                setHistoryOpen(false);
              }}
              className="text-[11px] text-[#A1A1AA] hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>محادثة جديدة</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#7A7A85]">لا توجد محادثات محفوظة بعد</div>
            ) : (
              sessions.map(s => {
                const comp = AI_COMPANIES.find(c => c.id === s.company_id) || AI_COMPANIES[0];
                const active = s.id === sessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => openHistorySession(s)}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      active ? 'bg-white/[0.09]' : 'hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0">{comp.renderLogo(14)}</span>
                      <span className="text-xs text-[#F2F2F5] truncate">{s.title}</span>
                    </div>
                    <div onClick={e => e.stopPropagation()} className="shrink-0">
                      <QuickRemovePill iconOnly onRemove={() => deleteSession(s.id)} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main ChatGPT / Gemini Open Conversation Stage */}
      <div className="flex-1 overflow-y-auto px-4 pt-20 pb-36 md:pb-40 relative z-10">
        <div className="max-w-[740px] mx-auto min-h-full flex flex-col">
          {turns.length === 0 ? (
            <div className="my-auto flex flex-col items-center text-center space-y-5 px-2 sm:px-4 w-full">
              <div className="space-y-3 flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-[#14141A] border border-white/[0.1] flex items-center justify-center">
                  {activeCompany.renderLogo(26)}
                </div>
                <h1
                  style={{
                    background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 64%, #7A7A85 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                  className="text-3xl sm:text-4xl font-semibold tracking-tight"
                >
                  {t(lang, 'ai_greeting')}
                </h1>
                {!providerStatus[activeCompany.id] && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      openSetupForCompany(activeCompany);
                    }}
                    className="mt-1 px-4 py-1.5 rounded-full bg-[#15151C] border border-white/[0.12] hover:border-white/30 text-xs text-[#C4C4CC] hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>ربط مفتاح {activeCompany.name}</span>
                  </button>
                )}
              </div>

              {/* ChatGPT-Style Centered Floating Desktop Composer Card when Stage is Empty! */}
              <div onClick={e => e.stopPropagation()} className="hidden md:block w-full max-w-[720px] pt-2 text-start">
                {uploadNotice && (
                  <div className="mb-2 px-3.5 py-2 rounded-2xl bg-[#EF4444]/14 border border-[#FB7185]/35 text-xs text-[#FDA4AF]">
                    {uploadNotice}
                  </div>
                )}
                {attachedFile && (
                  <div className="mb-2.5 relative w-fit">
                    <img
                      src={attachedFile.url}
                      alt=""
                      className="w-20 h-20 rounded-2xl object-cover shadow-lg block"
                    />
                    <CloseOrbButton
                      size="xs"
                      title="إزالة الصورة"
                      onClick={() => setAttachedFile(null)}
                      className="!absolute -top-2 -end-2 !bg-black/85"
                    />
                  </div>
                )}

                {recordingVoice ? (
                  <LiveVoiceRecorder onCancel={() => setRecordingVoice(false)} onSend={handleSendVoicePrompt} />
                ) : (
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      sendPrompt(prompt);
                    }}
                    className="w-full rounded-[28px] bg-[#14141B]/95 backdrop-blur-2xl border border-white/[0.12] focus-within:border-white/[0.24] shadow-[0_24px_64px_rgba(0,0,0,0.68)] px-4 pt-3.5 pb-2.5 transition-colors"
                  >
                    <textarea
                      ref={desktopTaRef}
                      rows={1}
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if ((prompt.trim() || attachedFile) && !loading) sendPrompt(prompt);
                        }
                      }}
                      placeholder={lang === 'ar' ? 'اكتب رسالتك أو اسأل أي شيء...' : 'Message anything...'}
                      className="w-full bg-transparent text-[15px] leading-relaxed text-[#F2F2F5] placeholder:text-[#6C6C78] outline-none resize-none overflow-y-auto max-h-[168px] text-start"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          title="إرفاق صورة واحدة (حتى 8MB)"
                          className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <ImageIcon className="w-[17px] h-[17px]" strokeWidth={1.85} />
                        </button>
                      </div>

                      {prompt.trim() || attachedFile ? (
                        <ChromeArrowButton type="submit" disabled={loading} size={38} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRecordingVoice(true)}
                          title="تسجيل رسالة صوتية"
                          className="chrome-rim-btn w-[38px] h-[38px] shrink-0 cursor-pointer"
                        >
                          <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                            <Mic className="w-[17px] h-[17px]" strokeWidth={1.9} />
                          </span>
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-7 pt-2">
              {turns.map((t, idx) => {
                const turnCompany = AI_COMPANIES.find(c => c.id === t.companyId) || activeCompany;
                return t.role === 'user' ? (
                  /* User Turn: Borderless Floating Image + Borderless Text Underneath when image is attached! */
                  <div key={t.id} className="group flex flex-col items-end gap-1.5">
                    {t.audioUrl ? (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="max-w-[85%] rounded-3xl rounded-ee-md px-3.5 py-2.5 bg-[#1B1B22] border border-white/[0.1]"
                      >
                        <SmartVoicePill
                          url={t.audioUrl}
                          transcript={t.transcript}
                          recordId={t.id}
                          table="ai_messages"
                          isMine
                        />
                      </div>
                    ) : t.attachmentUrl ? (
                      /* ZERO Container around the image AND ZERO Container around the text written underneath! */
                      <div onClick={e => e.stopPropagation()} className="max-w-[82%] flex flex-col items-end gap-2">
                        <img
                          src={t.attachmentUrl}
                          alt=""
                          className="max-w-[280px] sm:max-w-[320px] max-h-[340px] rounded-2xl object-cover block shadow-[0_14px_38px_rgba(0,0,0,0.45)]"
                        />
                        {t.content && (
                          <div className="text-[14.5px] leading-relaxed text-[#F2F2F5] whitespace-pre-wrap text-start">
                            <RichMessageText text={t.content} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          setHistoryOpen(true);
                          loadSessions();
                        }}
                        title="اضغط لعرض المحادثات السابقة"
                        className="max-w-[82%] rounded-3xl rounded-ee-md bg-[#1B1B22] px-4 py-2.5 text-[14.5px] leading-relaxed text-[#F2F2F5] whitespace-pre-wrap cursor-pointer hover:bg-[#22222B] transition-colors"
                      >
                        <RichMessageText text={t.content} />
                      </div>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity px-1 text-[#7A7A85]">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          sendPrompt(t.transcript || t.content);
                        }}
                        title="إعادة الإرسال"
                        className="w-6 h-6 rounded-full hover:bg-white/[0.08] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setPrompt(t.transcript || t.content);
                        }}
                        title="تعديل وإرسال"
                        className="w-6 h-6 rounded-full hover:bg-white/[0.08] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleCopy(t.id, t.transcript || t.content);
                        }}
                        title="نسخ"
                        className="w-6 h-6 rounded-full hover:bg-white/[0.08] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        {copiedId === t.id ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={t.id} className="flex items-start gap-3">
                    <div className="mt-1 w-7 h-7 rounded-xl bg-[#14141A] border border-white/[0.1] flex items-center justify-center shrink-0">
                      {turnCompany.renderLogo(16)}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {t.streaming && !t.content ? (
                        <div className="flex items-center gap-1.5 py-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FDE68A] animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FDE68A] animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FDE68A] animate-bounce [animation-delay:300ms]" />
                        </div>
                      ) : (
                        <div className="text-[14.5px] leading-[1.75] text-[#F2F2F5] space-y-2">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                            {t.content}
                          </ReactMarkdown>
                          {t.streaming && (
                            <span className="inline-block w-1.5 h-4 align-middle bg-[#FDE68A] rounded-full animate-pulse ms-1" />
                          )}
                        </div>
                      )}

                      {t.needsApiKey && t.missingProvider && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            const c = AI_COMPANIES.find(x => x.id === t.missingProvider);
                            if (c) openSetupForCompany(c);
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>إضافة مفتاح {turnCompany.name}</span>
                        </button>
                      )}

                      <div className="flex items-center gap-1 text-[#7A7A85] pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(t.id, t.content)}
                          title="نسخ"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.06] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          {copiedId === t.id ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFeedback(t.id, 'up')}
                          title="إعجاب"
                          className={`w-7 h-7 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors ${
                            t.feedback === 'up' ? 'text-white bg-white/[0.1]' : 'hover:text-white'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFeedback(t.id, 'down')}
                          title="عدم إعجاب"
                          className={`w-7 h-7 rounded-full hover:bg-white/[0.06] flex items-center justify-center cursor-pointer transition-colors ${
                            t.feedback === 'down' ? 'text-[#EF4444] bg-white/[0.08]' : 'hover:text-white'
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => regenerateFrom(idx)}
                          title="إعادة التوليد"
                          className="w-7 h-7 rounded-full hover:bg-white/[0.06] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {t.modelLabel && (
                          <span className="ms-2 text-[10.5px] font-mono-num text-[#585860]">{t.modelLabel}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {loading && !turns.some(t => t.streaming) && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-[#14141A] border border-white/[0.1] flex items-center justify-center">
                    {activeCompany.renderLogo(16)}
                  </div>
                  <span className="text-xs text-[#7A7A85]">جارٍ التفكير...</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* Strictly Single Image Attachment ONLY (No PDFs, No scripts, No multiple files) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleAttach}
        className="hidden"
      />

      {/* FLOATING COMPOSER: Desktop ChatGPT 2-Row Card (when chatting) + Mobile Floating Split Pill (always) */}
      {!mobileNavExpanded && (
        <div
          onClick={e => e.stopPropagation()}
          className={`pointer-events-none absolute bottom-4 inset-x-3.5 md:inset-x-6 z-20 flex justify-center ${
            turns.length === 0 ? 'md:hidden' : ''
          }`}
        >
          <div className="pointer-events-auto w-full max-w-[740px] space-y-2">
            {uploadNotice && (
              <div className="px-3.5 py-2 rounded-2xl bg-[#EF4444]/14 border border-[#FB7185]/35 text-xs text-[#FDA4AF]">
                {uploadNotice}
              </div>
            )}
            {attachedFile && (
              <div className="relative w-fit">
                <img
                  src={attachedFile.url}
                  alt=""
                  className="w-16 h-16 rounded-2xl object-cover shadow-lg block"
                />
                <CloseOrbButton
                  size="xs"
                  title="إزالة الصورة"
                  onClick={() => setAttachedFile(null)}
                  className="!absolute -top-2 -end-2 !bg-black/85"
                />
              </div>
            )}

            {/* DESKTOP ChatGPT-Style 2-Row Floating Card (Unified Voice/Send Button — Zero Blue!) */}
            <div className="hidden md:block">
              {recordingVoice ? (
                <LiveVoiceRecorder onCancel={() => setRecordingVoice(false)} onSend={handleSendVoicePrompt} />
              ) : (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    sendPrompt(prompt);
                  }}
                  className="w-full rounded-[26px] bg-[#14141B]/95 backdrop-blur-2xl border border-white/[0.12] focus-within:border-white/[0.24] shadow-[0_18px_52px_rgba(0,0,0,0.65)] px-4 pt-3 pb-2.5 transition-colors"
                >
                  <textarea
                    ref={desktopTaRef}
                    rows={1}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if ((prompt.trim() || attachedFile) && !loading) sendPrompt(prompt);
                      }
                    }}
                    placeholder={lang === 'ar' ? 'اكتب رسالتك...' : 'Message...'}
                    className="w-full bg-transparent text-[14.5px] leading-relaxed text-[#F2F2F5] placeholder:text-[#6C6C78] outline-none resize-none overflow-y-auto max-h-[168px] text-start"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="إرفاق صورة واحدة (حتى 8MB)"
                      className="w-8 h-8 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <ImageIcon className="w-[16px] h-[16px]" strokeWidth={1.85} />
                    </button>

                    {prompt.trim() || attachedFile ? (
                      <ChromeArrowButton type="submit" disabled={loading} size={36} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRecordingVoice(true)}
                        title="تسجيل رسالة صوتية"
                        className="chrome-rim-btn w-[36px] h-[36px] shrink-0 cursor-pointer"
                      >
                        <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                          <Mic className="w-[16px] h-[16px]" strokeWidth={1.9} />
                        </span>
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* MOBILE Floating Split Orb + Pill with Unified Voice/Send */}
            <div className="flex md:hidden items-end gap-2.5">
              <SplitComposerOrb onAttach={() => fileInputRef.current?.click()} showNavOption />

              <div className="flex-1 min-w-0">
                {recordingVoice ? (
                  <LiveVoiceRecorder onCancel={() => setRecordingVoice(false)} onSend={handleSendVoicePrompt} />
                ) : (
                  <ObsidianComposerPill
                    value={prompt}
                    onChange={setPrompt}
                    onSubmit={e => {
                      e.preventDefault();
                      sendPrompt(prompt);
                    }}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setTimeout(() => setComposerFocused(false), 140)}
                    placeholder={lang === 'ar' ? 'اكتب رسالتك...' : 'Message...'}
                    disabled={(!prompt.trim() && !attachedFile) || loading}
                    customAction={
                      prompt.trim() || attachedFile ? (
                        <ChromeArrowButton type="submit" disabled={loading} size={38} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRecordingVoice(true)}
                          title="تسجيل رسالة صوتية"
                          className="chrome-rim-btn w-[38px] h-[38px] shrink-0 cursor-pointer"
                        >
                          <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                            <Mic className="w-[17px] h-[17px]" strokeWidth={1.9} />
                          </span>
                        </button>
                      )
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-PLACE COMPANY API KEY SETUP GUIDE */}
      {setupCompany && (
        <StudioModalOverlay onClose={() => setSetupCompany(null)}>
          <form onSubmit={saveInlineApiKey} className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                {setupCompany.renderLogo(20)}
                <span>ربط {setupCompany.name}</span>
              </div>
              <CloseOrbButton onClick={() => setSetupCompany(null)} />
            </div>

            <ol className="space-y-2 text-xs text-[#D4D4D8] list-decimal list-inside leading-relaxed">
              {setupCompany.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>

            <a
              href={setupCompany.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-3.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs text-white flex items-center justify-between transition-colors"
            >
              <span dir="ltr" className="font-mono-num truncate">{setupCompany.keyUrl}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 ms-2" />
            </a>

            <div className="flex items-center gap-2">
              <input
                type={setupCompany.id === 'ollama' ? 'text' : 'password'}
                dir="ltr"
                value={apiKeyDraft}
                onChange={e => setApiKeyDraft(e.target.value)}
                placeholder={setupCompany.placeholder}
                className="flex-1 h-11 rounded-full bg-[#0A0A0C] border border-white/[0.12] px-4 text-xs font-mono-num text-white placeholder:text-[#585860] outline-none focus:border-white/30"
              />
              <ChromeArrowButton type="submit" disabled={!apiKeyDraft.trim()} size={42} />
            </div>

            {setupFeedback && <div className="text-xs text-[#22C55E] px-2">{setupFeedback}</div>}
          </form>
        </StudioModalOverlay>
      )}
    </div>
  );
}
