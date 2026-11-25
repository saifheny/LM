import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Lock,
  Search,
  Send,
  Phone,
  Video,
  Paperclip,
  Mic,
  Square,
  Cpu,
  Users,
  Plus,
  X,
  PhoneOff,
  MicOff,
  VideoOff,
  ShieldCheck,
  Flag,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { ChatMessageItem, ConversationItem } from '../../types';
import { UserAvatar, VipBadge, RichMessageText } from '../shared/LmBrandMark';

export function ChatView() {
  const { user, lang, toast, wsListeners, setActiveTab } = useApp();
  const isAr = lang === 'ar';

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('c_mariam');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Explicit @LM AI consent sharing state
  const [sharedForAi, setSharedForAi] = useState<ChatMessageItem | null>(null);

  // New group modal
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupType, setGroupType] = useState<'group' | 'community'>('group');

  // Voice note recording
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Call modal
  const [callMode, setCallMode] = useState<null | 'voice' | 'video'>(null);
  const [callSec, setCallSec] = useState(0);
  const [callMuted, setCallMuted] = useState(false);
  const [callCamOff, setCallCamOff] = useState(false);
  const callVideoRef = useRef<HTMLVideoElement | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);

  const loadConversations = useCallback(async () => {
    const data = await api<{ conversations: ConversationItem[] }>('/api/conversations');
    setConversations(data.conversations);
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const data = await api<{ messages: ChatMessageItem[] }>(`/api/conversations/${convId}/messages`);
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
      setSharedForAi(null);
    }
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // WebSocket realtime message updates
  useEffect(() => {
    const handler = (event: string, payload: unknown) => {
      if (event === 'chat:message') {
        const p = payload as { conversationId: string };
        loadConversations();
        if (p.conversationId === activeConvId) {
          loadMessages(activeConvId);
        }
      }
    };
    const listeners = wsListeners.current;
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [activeConvId, loadConversations, loadMessages, wsListeners]);

  // Call timer
  useEffect(() => {
    if (!callMode) {
      setCallSec(0);
      return;
    }
    const id = setInterval(() => setCallSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [callMode]);

  useEffect(() => {
    return () => {
      callStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  if (!user) return null;

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const filteredConvs = conversations.filter(
    c => c.title.toLowerCase().includes(filterText.toLowerCase()) || c.description.toLowerCase().includes(filterText.toLowerCase())
  );

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user || !activeConvId || !draft.trim()) return;
    setSending(true);
    const wantsAi = /@LM\s*AI/i.test(draft) || Boolean(sharedForAi);
    try {
      await api(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderId: user.id,
          content: draft,
          msgType: 'text',
          invokeAi: wantsAi,
          sharedSnippet: sharedForAi ? `${sharedForAi.displayName}: ${sharedForAi.content}` : undefined,
        }),
      });
      setDraft('');
      setSharedForAi(null);
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      const up = await uploadFile(file);
      const isImg = file.type.startsWith('image/');
      await api(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderId: user.id,
          content: isImg ? (isAr ? 'صورة مرفقة' : 'Image attachment') : up.originalName,
          msgType: isImg ? 'image' : 'file',
          mediaUrl: up.url,
        }),
      });
      await loadMessages(activeConvId);
      toast(isAr ? 'تم إرسال الملف بنجاح' : 'Attachment sent', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  }

  async function toggleVoiceNote() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        if (!user) return;
        const up = await uploadFile(file);
        await api(`/api/conversations/${activeConvId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            senderId: user.id,
            content: isAr ? 'رسالة صوتية' : 'Voice Note',
            msgType: 'audio',
            mediaUrl: up.url,
          }),
        });
        await loadMessages(activeConvId);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast(isAr ? 'يرجى السماح بصلاحية الميكروفون لتسجيل رسالة صوتية' : 'Microphone permission required', 'warning');
    }
  }

  async function startCall(type: 'voice' | 'video') {
    setCallMode(type);
    setCallMuted(false);
    setCallCamOff(type === 'voice');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      callStreamRef.current = stream;
      setTimeout(() => {
        if (callVideoRef.current && type === 'video') {
          callVideoRef.current.srcObject = stream;
        }
      }, 60);
    } catch {
      // Allow UI call simulation even if no camera attached
    }
  }

  function endCall() {
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    callStreamRef.current = null;
    setCallMode(null);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    const res = await api<{ id: string }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        title: groupTitle,
        type: groupType,
        isLargeGroup: groupType === 'community',
      }),
    });
    setNewGroupOpen(false);
    setGroupTitle('');
    await loadConversations();
    setActiveConvId(res.id);
    toast(isAr ? 'تم إنشاء المجموعة بنجاح' : 'Group created', 'success');
  }

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* LEFT PANE: CONVERSATIONS LIST */}
      <aside className="w-72 sm:w-80 shrink-0 border-e border-[var(--lm-border)] bg-[var(--lm-surface)] flex flex-col">
        <div className="p-3.5 border-b border-[var(--lm-border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">{isAr ? 'المحادثات والمجتمعات' : 'Messages & Groups'}</h2>
            <button
              onClick={() => setNewGroupOpen(true)}
              title={isAr ? 'إنشاء مجموعة جديدة' : 'New Group'}
              className="w-7 h-7 rounded-lg lm-btn-ghost flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--lm-text-muted)] absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={isAr ? 'بحث في المحادثات...' : 'Search chats...'}
              className="lm-input w-full rounded-xl ps-8 pe-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConvs.map((c) => {
            const active = c.id === activeConvId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-start transition-colors cursor-pointer ${
                  active
                    ? 'bg-[var(--lm-accent-soft)] border border-[var(--lm-accent)]/35'
                    : 'hover:bg-[var(--lm-surface-hover)] border border-transparent'
                }`}
              >
                <div
                  style={{ backgroundColor: c.avatarColor }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                >
                  {c.type === 'dm' ? c.title.slice(0, 2) : <Users className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold truncate">{c.title}</span>
                    {c.isEncrypted && <Lock className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-[var(--lm-text-muted)] truncate mt-0.5">
                    {c.lastMessage || c.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* RIGHT PANE: ACTIVE CHAT WINDOW */}
      <section className="flex-1 flex flex-col min-w-0 bg-[var(--lm-bg)]">
        {/* Chat Header */}
        <div className="h-14 px-4 border-b border-[var(--lm-border)] bg-[var(--lm-surface)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              style={{ backgroundColor: activeConv?.avatarColor || '#2F6BFF' }}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            >
              {activeConv?.type === 'dm' ? activeConv.title.slice(0, 2) : <Users className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate flex items-center gap-2">
                <span>{activeConv?.title}</span>
                {activeConv?.isEncrypted && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/12 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
                    <Lock className="w-2.5 h-2.5" /> E2EE
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[var(--lm-text-muted)] truncate">
                {activeConv?.type === 'dm'
                  ? (isAr ? 'محادثة مشفرة • LM AI لا يقرأها تلقائيًا' : 'Encrypted DM • Isolated from LM AI')
                  : `${activeConv?.memberCount.toLocaleString('en-US')} ${isAr ? 'عضو' : 'members'}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => startCall('voice')}
              title={isAr ? 'مكالمة صوتية' : 'Voice Call'}
              className="w-8 h-8 rounded-lg lm-btn-ghost flex items-center justify-center cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => startCall('video')}
              title={isAr ? 'مكالمة فيديو' : 'Video Call'}
              className="w-8 h-8 rounded-lg lm-btn-ghost flex items-center justify-center cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => toast(isAr ? 'تم فتح خيارات الخصوصية والحظر والإبلاغ' : 'Privacy & Report options ready', 'info')}
              title={isAr ? 'إبلاغ / خصوصية' : 'Report / Privacy'}
              className="w-8 h-8 rounded-lg lm-btn-ghost flex items-center justify-center cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Large Group Ad Banner (Removed when user enables 50 EGP Large Group Ad-Removal) */}
        {activeConv?.isLargeGroup && !user.adRemoval.largeGroups && (
          <div className="px-4 py-2 bg-[var(--lm-surface-2)] border-b border-[var(--lm-border)] flex items-center justify-between gap-2 text-[11px]">
            <span className="text-[var(--lm-text-secondary)]">
              {isAr ? 'إعلان المجموعات الكبيرة • يمكنك إزالته مقابل 50 ج.م شهريًا أو عبر VIP.' : 'Large Group Ad • Removable for 50 EGP/mo or VIP.'}
            </span>
            <button onClick={() => setActiveTab('vip')} className="text-[var(--lm-accent)] font-semibold hover:underline cursor-pointer shrink-0">
              {isAr ? 'إزالة الإعلانات' : 'Remove'}
            </button>
          </div>
        )}

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Privacy Notice Pill */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--lm-surface)] border border-[var(--lm-border)] text-[11px] text-[var(--lm-text-muted)]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {isAr
                  ? 'المحادثة محمية بالتشفير. لا يطّلع LM AI على أي رسالة إلا عند اختيارك "مشاركة مع LM AI".'
                  : 'Encrypted chat. LM AI cannot read messages unless you explicitly share one.'}
              </span>
            </div>
          </div>

          {messages.map((m) => {
            const isMine = m.senderId === user.id;
            const isAi = m.senderId === 'lm_ai';
            return (
              <div key={m.id} className={`flex items-end gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                <UserAvatar initials={m.avatarInitials} color={m.avatarColor} size={30} vipTier={m.vipTier} />
                <div className={`max-w-[76%] sm:max-w-[65%] space-y-1 ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[11px] font-semibold text-[var(--lm-text-secondary)]">{m.displayName}</span>
                    {isAi && (
                      <span className="text-[9px] font-mono-num px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        CONSENTED AI
                      </span>
                    )}
                    <VipBadge tier={m.vipTier} compact />
                  </div>

                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line border ${
                      isAi
                        ? 'bg-emerald-950/35 border-emerald-500/35 text-[var(--lm-text)]'
                        : isMine
                        ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)] border-transparent'
                        : 'bg-[var(--lm-surface)] border-[var(--lm-border)] text-[var(--lm-text)]'
                    }`}
                  >
                    {m.msgType === 'image' && m.mediaUrl && (
                      <img src={m.mediaUrl} alt="Attachment" className="rounded-xl max-h-56 mb-1.5 object-cover" />
                    )}
                    {m.msgType === 'audio' && m.mediaUrl && (
                      <audio controls src={m.mediaUrl} className="max-w-[230px] h-8 mb-1" />
                    )}
                    {m.msgType === 'file' && m.mediaUrl && (
                      <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline font-medium block mb-1">
                        📎 {m.content}
                      </a>
                    )}
                    {m.msgType !== 'file' && (isAi ? <RichMessageText text={m.content} /> : <span>{m.content}</span>)}
                  </div>

                  {/* Explicit Consent Action: Share ONLY this message with @LM AI */}
                  {!isAi && (
                    <button
                      onClick={() => {
                        setSharedForAi(m);
                        setDraft(`@LM AI ${isAr ? 'لخّص أو ساعدني في الرد على هذه الرسالة' : 'Summarize or draft a reply to this message'}`);
                      }}
                      className="text-[10px] text-[var(--lm-text-muted)] hover:text-[var(--lm-accent)] flex items-center gap-1 px-1 cursor-pointer"
                    >
                      <Cpu className="w-2.5 h-2.5" />
                      {isAr ? 'مشاركة هذه الرسالة مع @LM AI بإذنك' : 'Share this message with @LM AI'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* EXPLICIT CONSENT BAR FOR @LM AI */}
        {sharedForAi && (
          <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                <strong className="text-emerald-400">{isAr ? 'إذن مشاركة محدد مع LM AI:' : 'Explicit AI Share:'}</strong>{' '}
                "{sharedForAi.content.slice(0, 70)}"
              </span>
            </div>
            <button onClick={() => setSharedForAi(null)} className="text-[var(--lm-text-muted)] hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Composer */}
        <form onSubmit={sendMessage} className="p-3 border-t border-[var(--lm-border)] bg-[var(--lm-surface)] flex items-center gap-2 shrink-0">
          <input ref={fileRef} type="file" className="hidden" onChange={handleAttachFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title={isAr ? 'إرفاق صورة أو ملف' : 'Attach image/file'}
            className="w-9 h-9 rounded-xl lm-btn-ghost flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleVoiceNote}
            title={isAr ? 'تسجيل رسالة صوتية' : 'Record Voice Note'}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer border ${
              recording ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'lm-btn-ghost'
            }`}
          >
            {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
          </button>

          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              isAr
                ? 'اكتب رسالة... (أو اختر رسالة لمشاركتها مع @LM AI بإذنك)'
                : 'Type a message... (or share a specific message with @LM AI)'
            }
            className="lm-input flex-1 rounded-xl px-3.5 py-2 text-xs"
          />

          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="lm-btn-primary px-4 h-9 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-45"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isAr ? 'إرسال' : 'Send'}</span>
          </button>
        </form>
      </section>

      {/* VOICE / VIDEO CALL MODAL */}
      {callMode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md lm-card rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 text-center space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono-num">
                <Lock className="w-3 h-3" /> WebRTC Encrypted • {fmtTimer(callSec)}
              </div>

              {callMode === 'video' && !callCamOff ? (
                <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-[var(--lm-border)]">
                  <video ref={callVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div
                    style={{ backgroundColor: activeConv?.avatarColor || '#2F6BFF' }}
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg"
                  >
                    {activeConv?.title.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-base font-bold">{activeConv?.title}</div>
                    <div className="text-xs text-[var(--lm-text-muted)]">
                      {callMode === 'voice' ? (isAr ? 'مكالمة صوتية مشفرة' : 'Encrypted Voice Call') : (isAr ? 'الكاميرا متوقفة' : 'Camera Off')}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setCallMuted(m => !m)}
                  className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border ${
                    callMuted ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'lm-btn-ghost'
                  }`}
                >
                  {callMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                {callMode === 'video' && (
                  <button
                    onClick={() => setCallCamOff(v => !v)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border ${
                      callCamOff ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'lm-btn-ghost'
                    }`}
                  >
                    {callCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={endCall}
                  className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center cursor-pointer"
                >
                  <PhoneOff className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW GROUP MODAL */}
      {newGroupOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setNewGroupOpen(false)}>
          <form onSubmit={createGroup} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm lm-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'إنشاء مجموعة أو مجتمع جديد' : 'Create Group / Community'}</h3>
              <button type="button" onClick={() => setNewGroupOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder={isAr ? 'اسم المجموعة...' : 'Group name...'}
              className="lm-input w-full rounded-xl px-3 py-2 text-xs"
              required
            />
            <select value={groupType} onChange={(e) => setGroupType(e.target.value as 'group' | 'community')} className="lm-input w-full rounded-xl px-3 py-2 text-xs">
              <option value="group">{isAr ? 'مجموعة خاصة مشفرة (E2EE)' : 'Private Encrypted Group'}</option>
              <option value="community">{isAr ? 'مجتمع عام كبير' : 'Large Public Community'}</option>
            </select>
            <button type="submit" className="lm-btn-primary w-full py-2 rounded-xl text-xs font-semibold cursor-pointer">
              {isAr ? 'إنشاء' : 'Create'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
