import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import confetti from 'canvas-confetti';
import {
  Search,
  Send,
  Phone,
  Video,
  Paperclip,
  Mic,
  Smile,
  CheckCheck,
  Pin,
  Reply,
  Sparkles,
  PanelRight,
  Lock,
  Plus,
  X,
  PhoneOff,
  MicOff,
  VideoOff,
  ArrowRight,
  Camera,
  Flame,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { ChatMessageItem, ConversationItem } from '../../types';
import { RichMessageText, UserAvatar, VipBadge } from '../shared/LmBrandMark';
import { LiveVoiceRecorder, SmartVoicePill } from '../shared/VoiceStudio2026';

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😍', '🚀', '👏'];
const SEND_EFFECTS = [
  { id: 'fire', emoji: '🔥', label: 'نار' },
  { id: 'confetti', emoji: '🎉', label: 'احتفال' },
  { id: 'love', emoji: '❤️', label: 'حب' },
  { id: 'laser', emoji: '⚡', label: 'برق' },
];

/** 2026 Circular Floating Video Note Bubble (Telegram Round Video Style) */
function CircularVideoBubble({ url }: { url: string }) {
  const [muted, setMuted] = useState(true);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => {
        setMuted(false);
        setExpanded(e => !e);
      }}
      className={`relative rounded-full overflow-hidden cursor-pointer border-2 border-[#7C5CFF] shadow-[0_12px_32px_rgba(124,92,255,0.35)] transition-all duration-300 ${
        expanded ? 'w-60 h-60' : 'w-44 h-44'
      }`}
    >
      <video src={url} autoPlay loop muted={muted} playsInline className="w-full h-full object-cover" />
      <span className="absolute bottom-2.5 right-1/2 translate-x-1/2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-[10px] text-white flex items-center gap-1">
        {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
        <span>0:15</span>
      </span>
    </div>
  );
}

export function ChatView() {
  const { user, lang, toast, wsListeners } = useApp();
  const isAr = lang === 'ar';

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('c_mariam');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [folder, setFolder] = useState<'all' | 'personal' | 'groups' | 'channels'>('all');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // 2026 Interactive Messaging States
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);
  const [sharedForAi, setSharedForAi] = useState<ChatMessageItem | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [voiceStudioOpen, setVoiceStudioOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'mic' | 'video_note'>('mic');
  const [infoOpen, setInfoOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupType, setGroupType] = useState<'group' | 'community'>('group');

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
      setReplyTo(null);
      setSharedForAi(null);
      setVoiceStudioOpen(false);
    }
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const handler = (event: string, payload: unknown) => {
      if (event === 'chat:message') {
        const p = payload as { conversationId: string };
        loadConversations();
        if (p.conversationId === activeConvId) loadMessages(activeConvId);
      }
    };
    const listeners = wsListeners.current;
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [activeConvId, loadConversations, loadMessages, wsListeners]);

  useEffect(() => {
    if (!callMode) { setCallSec(0); return; }
    const id = setInterval(() => setCallSec(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [callMode]);

  if (!user) return null;

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const filteredConvs = conversations.filter((c) => {
    if (folder !== 'all' && c.folder !== folder) return false;
    if (!filterText.trim()) return true;
    return c.title.toLowerCase().includes(filterText.toLowerCase()) || c.lastMessage.toLowerCase().includes(filterText.toLowerCase());
  });

  async function sendMessage(e?: React.FormEvent, chosenEffect?: string) {
    e?.preventDefault();
    if (!user || !activeConvId || !draft.trim()) return;
    setSending(true);
    const wantsAi = /@LM\s*AI/i.test(draft) || Boolean(sharedForAi);
    try {
      if (chosenEffect) {
        confetti({ particleCount: 55, spread: 70, origin: { y: 0.8 } });
      }
      await api(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderId: user.id,
          content: draft,
          msgType: 'text',
          sendEffect: chosenEffect || null,
          replyToId: replyTo?.id,
          replySender: replyTo?.displayName,
          replyText: replyTo?.content.slice(0, 80),
          invokeAi: wantsAi,
          sharedSnippet: sharedForAi ? `${sharedForAi.displayName}: ${sharedForAi.content}` : undefined,
        }),
      });
      setDraft('');
      setReplyTo(null);
      setSharedForAi(null);
      setEmojiOpen(false);
      setEffectsOpen(false);
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleVoiceSend(audioFile: File) {
    if (!user) return;
    try {
      const up = await uploadFile(audioFile);
      await api(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderId: user.id,
          content: isAr ? 'رسالة صوتية' : 'Voice Note',
          msgType: 'audio',
          mediaUrl: up.url,
          transcript: isAr ? 'رسالة صوتية عالية النقاء مسجلة بتقنية LM Voice 2026.' : 'HD Spatial Voice Message.',
          replyToId: replyTo?.id,
          replySender: replyTo?.displayName,
          replyText: replyTo?.content.slice(0, 60),
        }),
      });
      setVoiceStudioOpen(false);
      setReplyTo(null);
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error');
    }
  }

  async function sendInstantVideoNote() {
    if (!user) return;
    await api(`/api/conversations/${activeConvId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        senderId: user.id,
        content: isAr ? 'رسالة فيديو دائرية' : 'Video Note',
        msgType: 'video_note',
        mediaUrl: '/uploads/seed/reel1.mp4',
      }),
    });
    await loadMessages(activeConvId);
    await loadConversations();
    toast(isAr ? 'تم إرسال رسالة فيديو دائرية 🎥' : 'Circular video note sent 🎥', 'success');
  }

  async function toggleReaction(msgId: string, emoji: string) {
    if (!user) return;
    await api(`/api/messages/${msgId}/react`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, emoji }),
    });
    await loadMessages(activeConvId);
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
          content: isImg ? '' : up.originalName,
          msgType: isImg ? 'image' : 'file',
          mediaUrl: up.url,
        }),
      });
      await loadMessages(activeConvId);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
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
        if (callVideoRef.current && type === 'video') callVideoRef.current.srcObject = stream;
      }, 60);
    } catch {
      // UI preview fallback
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
      body: JSON.stringify({ title: groupTitle, type: groupType, isLargeGroup: groupType === 'community' }),
    });
    setNewGroupOpen(false);
    setGroupTitle('');
    await loadConversations();
    setActiveConvId(res.id);
  }

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const sharedPhotos = messages.filter(m => m.msgType === 'image' && m.mediaUrl);

  return (
    <div className="h-full w-full flex overflow-hidden">
      {/* ============================================================
          SPATIAL GLASS CONVERSATIONS PANE
         ============================================================ */}
      <aside
        className={`${
          mobileChatOpen ? 'hidden md:flex' : 'flex'
        } w-full md:w-[350px] lg:w-[375px] shrink-0 flex-col border-e border-[var(--lm-border)] bg-[var(--tg-sidebar-bg)] backdrop-blur-2xl select-none`}
      >
        <div className="px-3.5 pt-3.5 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--lm-text-muted)] absolute top-1/2 -translate-y-1/2 start-3.5" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={isAr ? 'ابحث...' : 'Search...'}
              className="lm-input w-full h-10 rounded-full ps-10 pe-4 text-sm"
            />
          </div>
          <button
            onClick={() => setNewGroupOpen(true)}
            className="w-10 h-10 rounded-full lm-btn-primary flex items-center justify-center cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Folder Capsules */}
        <div className="px-3.5 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', ar: 'الكل', en: 'All' },
            { id: 'personal', ar: 'الأشخاص', en: 'Direct' },
            { id: 'groups', ar: 'المجموعات', en: 'Groups' },
            { id: 'channels', ar: 'القنوات', en: 'Channels' },
          ].map((f) => {
            const active = folder === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id as typeof folder)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-[var(--lm-accent)] text-[var(--lm-accent-text)] shadow-md'
                    : 'bg-[var(--lm-surface-2)] text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)]'
                }`}
              >
                {isAr ? f.ar : f.en}
              </button>
            );
          })}
        </div>

        {/* Chat Rows */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {filteredConvs.map((c) => {
            const active = c.id === activeConvId;
            return (
              <motion.button
                key={c.id}
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  setActiveConvId(c.id);
                  setMobileChatOpen(true);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-start transition-all cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#6D4AFF] to-[#4F7BFF] text-white shadow-lg'
                    : 'hover:bg-[var(--tg-hover)] text-[var(--lm-text)]'
                }`}
              >
                <UserAvatar
                  initials={c.title.slice(0, 2)}
                  color={c.avatarColor}
                  avatarUrl={c.avatarUrl}
                  size={50}
                  online={c.type === 'dm' && c.onlineText.includes('متصل')}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-bold truncate flex items-center gap-1.5">
                      {c.isEncrypted && <Lock className={`w-3 h-3 shrink-0 ${active ? 'text-white/80' : 'text-emerald-400'}`} />}
                      <span className="truncate">{c.title}</span>
                    </span>
                    <span className={`text-[11px] shrink-0 flex items-center gap-1 ${active ? 'text-white/80' : 'text-[var(--lm-text-muted)]'}`}>
                      <CheckCheck className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#7C5CFF]'}`} />
                      {c.lastMessageAt}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`text-[12.5px] truncate ${active ? 'text-white/85' : 'text-[var(--lm-text-muted)]'}`}>
                      {c.lastMessage || c.description}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.isPinned && <Pin className={`w-3 h-3 rotate-45 ${active ? 'text-white/75' : 'text-[var(--lm-text-muted)]'}`} />}
                      {c.unreadCount > 0 && !active && (
                        <span className="px-1.5 min-w-[20px] h-5 rounded-full bg-[#7C5CFF] text-white text-[10px] font-mono-num font-bold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </aside>

      {/* ============================================================
          MAIN 2026 SPATIAL CHAT STAGE
         ============================================================ */}
      <section className={`${mobileChatOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 tg-wallpaper relative`}>
        {/* Floating Glass Chat Header */}
        <header className="h-15 px-4 bg-[var(--tg-sidebar-bg)] backdrop-blur-2xl border-b border-[var(--lm-border)] flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileChatOpen(false)} className="md:hidden p-1.5 rounded-full hover:bg-white/10 cursor-pointer">
              <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => setInfoOpen(v => !v)} className="flex items-center gap-3 min-w-0 text-start cursor-pointer">
              <UserAvatar
                initials={activeConv?.title.slice(0, 2) || 'LM'}
                color={activeConv?.avatarColor || '#6366F1'}
                avatarUrl={activeConv?.avatarUrl}
                size={40}
                online={activeConv?.onlineText?.includes('متصل')}
              />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{activeConv?.title}</div>
                <div className="text-xs text-[var(--lm-accent)] truncate">{activeConv?.onlineText}</div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[var(--lm-text-secondary)]">
            <button onClick={() => startCall('voice')} className="w-9 h-9 rounded-full hover:bg-[var(--tg-hover)] flex items-center justify-center cursor-pointer">
              <Phone className="w-[18px] h-[18px]" />
            </button>
            <button onClick={() => startCall('video')} className="w-9 h-9 rounded-full hover:bg-[var(--tg-hover)] flex items-center justify-center cursor-pointer">
              <Video className="w-[18px] h-[18px]" />
            </button>
            <button onClick={() => setInfoOpen(v => !v)} className={`w-9 h-9 rounded-full hover:bg-[var(--tg-hover)] flex items-center justify-center cursor-pointer ${infoOpen ? 'text-[var(--lm-accent)]' : ''}`}>
              <PanelRight className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        {/* Pinned Message */}
        {activeConv?.pinnedMessage && (
          <div className="px-4 py-1.5 bg-[var(--tg-sidebar-bg)]/80 backdrop-blur-xl border-b border-[var(--lm-border)] flex items-center gap-2.5 text-xs z-10">
            <div className="w-0.5 h-6 rounded-full bg-[var(--lm-accent)] shrink-0" />
            <span className="truncate text-[var(--lm-text-secondary)]">{activeConv.pinnedMessage}</span>
          </div>
        )}

        {/* Messages Stream with Framer Motion Spring Entrance */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
          <div className="max-w-[760px] mx-auto space-y-3">
            {messages.map((m) => {
              const isMine = m.senderId === user.id;
              const isAi = m.senderId === 'lm_ai';
              const reactionEntries = Object.entries(m.reactions || {});
              const isVideoNote = m.msgType === 'video_note' && m.mediaUrl;

              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  onMouseEnter={() => setHoveredMsgId(m.id)}
                  onMouseLeave={() => setHoveredMsgId(prev => (prev === m.id ? null : prev))}
                  onDoubleClick={() => toggleReaction(m.id, '❤️')}
                  className={`group flex items-end gap-2.5 relative ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMine && (
                    <UserAvatar initials={m.avatarInitials} color={m.avatarColor} avatarUrl={m.avatarUrl} size={34} vipTier={m.vipTier} />
                  )}

                  <div className={`relative max-w-[82%] sm:max-w-[68%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* Hover Action Bar */}
                    <AnimatePresence>
                      {hoveredMsgId === m.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className={`absolute -top-9 ${isMine ? 'end-0' : 'start-0'} z-20 flex items-center gap-0.5 px-2 py-1 rounded-full liquid-glass`}
                        >
                          {QUICK_REACTIONS.slice(0, 5).map((emo) => (
                            <button
                              key={emo}
                              onClick={() => toggleReaction(m.id, emo)}
                              className="w-6 h-6 rounded-full hover:scale-130 transition-transform flex items-center justify-center text-xs cursor-pointer"
                            >
                              {emo}
                            </button>
                          ))}
                          <span className="w-px h-4 bg-[var(--lm-border-strong)] mx-1" />
                          <button onClick={() => setReplyTo(m)} className="p-1 rounded-full hover:bg-white/15 cursor-pointer" title="رد">
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          {!isAi && (
                            <button
                              onClick={() => {
                                setSharedForAi(m);
                                setDraft(`@LM AI ${isAr ? 'لخّص أو اقترح ردًا' : 'Summarize or draft reply'}`);
                              }}
                              className="p-1 rounded-full hover:bg-white/15 text-[#38BDF8] cursor-pointer"
                              title="@LM AI"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Circular Video Bubble OR Liquid-Glass Speech Bubble */}
                    {isVideoNote ? (
                      <div className="space-y-1">
                        <CircularVideoBubble url={m.mediaUrl!} />
                        {reactionEntries.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {reactionEntries.map(([emo, userIds]) => (
                              <button
                                key={emo}
                                onClick={() => toggleReaction(m.id, emo)}
                                className="px-2 py-0.5 rounded-full liquid-glass text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <span>{emo}</span>
                                <span className="text-[11px] font-mono-num font-bold">{userIds.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          background: isAi
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(6,182,212,0.18))'
                            : isMine
                            ? 'var(--tg-bubble-out)'
                            : 'var(--tg-bubble-in)',
                        }}
                        className={`rounded-3xl ${
                          isMine ? 'rounded-ee-md text-white' : 'rounded-es-md text-[var(--lm-text)] border border-[var(--lm-border)]'
                        } px-4 py-2.5 shadow-md backdrop-blur-xl text-[13.5px] leading-relaxed relative`}
                      >
                        {m.sendEffect && (
                          <span className="absolute -top-2 -start-2 text-base select-none">
                            {SEND_EFFECTS.find(x => x.id === m.sendEffect)?.emoji || '✨'}
                          </span>
                        )}

                        {(!isMine || isAi) && (
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold" style={{ color: isAi ? '#34D399' : m.avatarColor }}>
                              {m.displayName}
                            </span>
                            <VipBadge tier={m.vipTier} compact />
                          </div>
                        )}

                        {m.replyText && (
                          <div className="mb-1.5 ps-2.5 py-1 rounded-xl bg-black/20 border-s-2 border-white/70 text-xs">
                            <div className="font-bold text-[11px] opacity-90">{m.replySender}</div>
                            <div className="opacity-75 truncate">{m.replyText}</div>
                          </div>
                        )}

                        {m.msgType === 'image' && m.mediaUrl && (
                          <img
                            src={m.mediaUrl}
                            alt=""
                            onClick={() => setLightboxImg(m.mediaUrl)}
                            className="rounded-2xl max-h-72 w-full object-cover mb-1.5 cursor-zoom-in"
                          />
                        )}

                        {m.msgType === 'audio' && m.mediaUrl && (
                          <SmartVoicePill url={m.mediaUrl} transcript={m.transcript} isMine={isMine} />
                        )}

                        {m.msgType === 'file' && m.mediaUrl && (
                          <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline font-medium block py-1">
                            📎 {m.content}
                          </a>
                        )}

                        {m.msgType !== 'audio' && m.msgType !== 'file' && m.content && (
                          <div className="inline">
                            {isAi ? <RichMessageText text={m.content} /> : <span>{m.content}</span>}
                          </div>
                        )}

                        <span className="float-end ms-3 mt-1 inline-flex items-center gap-1 text-[10px] opacity-70 select-none">
                          <span>{m.createdAt}</span>
                          {isMine && <CheckCheck className="w-3.5 h-3.5" />}
                        </span>

                        {reactionEntries.length > 0 && (
                          <div className="clear-both pt-1.5 flex flex-wrap gap-1">
                            {reactionEntries.map(([emo, userIds]) => {
                              const reactedByMe = userIds.includes(user.id);
                              return (
                                <button
                                  key={emo}
                                  onClick={() => toggleReaction(m.id, emo)}
                                  style={{
                                    backgroundColor: reactedByMe ? 'var(--tg-reaction-own)' : 'var(--tg-reaction-bg)',
                                  }}
                                  className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-transform active:scale-90 cursor-pointer"
                                >
                                  <span>{emo}</span>
                                  <span className="text-[11px] font-mono-num font-bold">{userIds.length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>

        {/* ============================================================
            2026 LIQUID-GLASS COMPOSER + LIVE VOICE STUDIO + SEND FX
           ============================================================ */}
        <div className="px-3 sm:px-6 pb-3 pt-1 shrink-0 relative z-20">
          <div className="max-w-[760px] mx-auto relative">
            {emojiOpen && (
              <div className="absolute bottom-15 start-0 z-50 shadow-2xl rounded-3xl overflow-hidden">
                <EmojiPicker theme={EmojiTheme.DARK} width={310} height={360} onEmojiClick={(e) => setDraft(prev => prev + e.emoji)} />
              </div>
            )}

            {/* Send Effects Popover */}
            {effectsOpen && (
              <div className="absolute bottom-15 end-0 z-50 liquid-glass rounded-2xl p-2 flex items-center gap-1.5">
                {SEND_EFFECTS.map((fx) => (
                  <button
                    key={fx.id}
                    type="button"
                    onClick={() => sendMessage(undefined, fx.id)}
                    className="px-2.5 py-1.5 rounded-xl hover:bg-white/15 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span className="text-base">{fx.emoji}</span>
                    <span>{fx.label}</span>
                  </button>
                ))}
              </div>
            )}

            {(replyTo || sharedForAi) && (
              <div className="mb-1.5 px-4 py-2 rounded-2xl liquid-glass flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-0.5 h-6 rounded-full ${sharedForAi ? 'bg-[#38BDF8]' : 'bg-[#7C5CFF]'}`} />
                  <div className="min-w-0">
                    <div className="font-bold text-[11px] text-[var(--lm-accent)]">
                      {sharedForAi ? '✨ @LM AI' : replyTo?.displayName}
                    </div>
                    <div className="text-[var(--lm-text-secondary)] truncate">{(sharedForAi || replyTo)?.content}</div>
                  </div>
                </div>
                <button onClick={() => { setReplyTo(null); setSharedForAi(null); }} className="p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {voiceStudioOpen ? (
              <LiveVoiceRecorder
                onCancel={() => setVoiceStudioOpen(false)}
                onSend={(file) => handleVoiceSend(file)}
              />
            ) : (
              <form onSubmit={(e) => sendMessage(e)} className="flex items-center gap-2">
                <div className="flex-1 h-12 rounded-full liquid-glass px-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen(v => !v)}
                    className="w-8 h-8 rounded-full text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)] flex items-center justify-center cursor-pointer"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={isAr ? 'رسالة...' : 'Message...'}
                    className="flex-1 bg-transparent text-sm text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)] outline-none"
                  />

                  <input ref={fileRef} type="file" className="hidden" onChange={handleAttachFile} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-8 h-8 rounded-full text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)] flex items-center justify-center cursor-pointer"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {draft.trim() && (
                    <button
                      type="button"
                      onClick={() => setEffectsOpen(v => !v)}
                      title={isAr ? 'إرسال بتأثير بصري' : 'Send with Effect'}
                      className="w-8 h-8 rounded-full text-amber-400 hover:bg-amber-400/15 flex items-center justify-center cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {draft.trim() ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={sending}
                    className="w-12 h-12 rounded-full lm-btn-primary flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle Mic <-> Circular Video Note */}
                    <button
                      type="button"
                      onClick={() => setCaptureMode(m => (m === 'mic' ? 'video_note' : 'mic'))}
                      title={isAr ? 'التبديل بين الصوت والفيديو الدائري' : 'Switch Voice / Round Video'}
                      className="w-10 h-10 rounded-full liquid-glass flex items-center justify-center text-[var(--lm-text-secondary)] hover:text-[var(--lm-text)] cursor-pointer"
                    >
                      {captureMode === 'mic' ? <Camera className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => {
                        if (captureMode === 'mic') setVoiceStudioOpen(true);
                        else sendInstantVideoNote();
                      }}
                      className="w-12 h-12 rounded-full lm-btn-primary flex items-center justify-center cursor-pointer"
                    >
                      {captureMode === 'mic' ? <Mic className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                    </motion.button>
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT MEDIA & PROFILE DRAWER */}
      {infoOpen && activeConv && (
        <aside className="hidden lg:flex w-[310px] shrink-0 flex-col border-s border-[var(--lm-border)] bg-[var(--tg-sidebar-bg)] backdrop-blur-2xl overflow-y-auto">
          <div className="h-15 px-4 flex items-center justify-between border-b border-[var(--lm-border)] shrink-0">
            <span className="text-sm font-bold">{isAr ? 'التفاصيل' : 'Profile'}</span>
            <button onClick={() => setInfoOpen(false)} className="p-1.5 rounded-full hover:bg-[var(--tg-hover)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 flex flex-col items-center text-center border-b border-[var(--lm-border)]">
            <UserAvatar initials={activeConv.title.slice(0, 2)} color={activeConv.avatarColor} avatarUrl={activeConv.avatarUrl} size={84} />
            <h3 className="text-base font-bold mt-3">{activeConv.title}</h3>
            <p className="text-xs text-[var(--lm-accent)] mt-0.5">{activeConv.onlineText}</p>
            <p className="text-xs text-[var(--lm-text-secondary)] mt-2">{activeConv.description}</p>
          </div>
          <div className="p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[var(--lm-text-muted)]">
              {isAr ? 'الوسائط' : 'Shared Media'} ({sharedPhotos.length})
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {sharedPhotos.map((p) => (
                <img
                  key={p.id}
                  src={p.mediaUrl!}
                  alt=""
                  onClick={() => setLightboxImg(p.mediaUrl)}
                  className="aspect-square rounded-xl object-cover cursor-pointer hover:opacity-85"
                />
              ))}
            </div>
          </div>
        </aside>
      )}

      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out">
          <img src={lightboxImg} alt="" className="max-w-full max-h-[88vh] rounded-3xl shadow-2xl" />
        </div>
      )}

      {callMode && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-md liquid-glass rounded-3xl p-6 text-center space-y-5 text-white">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono-num">
              <Lock className="w-3 h-3" /> {fmtTimer(callSec)}
            </div>
            {callMode === 'video' && !callCamOff ? (
              <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                <video ref={callVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center gap-3">
                <UserAvatar initials={activeConv?.title.slice(0, 2) || 'LM'} color={activeConv?.avatarColor || '#6366F1'} avatarUrl={activeConv?.avatarUrl} size={88} />
                <div className="text-lg font-bold">{activeConv?.title}</div>
              </div>
            )}
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setCallMuted(m => !m)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center cursor-pointer">
                {callMuted ? <MicOff className="w-5 h-5 text-red-400" /> : <Mic className="w-5 h-5" />}
              </button>
              {callMode === 'video' && (
                <button onClick={() => setCallCamOff(v => !v)} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center cursor-pointer">
                  {callCamOff ? <VideoOff className="w-5 h-5 text-red-400" /> : <Video className="w-5 h-5" />}
                </button>
              )}
              <button onClick={endCall} className="w-14 h-14 rounded-full bg-[#FF2D55] text-white flex items-center justify-center cursor-pointer">
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {newGroupOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setNewGroupOpen(false)}>
          <form onSubmit={createGroup} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm liquid-glass rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'مجموعة أو قناة جديدة' : 'New Space'}</h3>
              <button type="button" onClick={() => setNewGroupOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder={isAr ? 'الاسم...' : 'Name...'}
              className="lm-input w-full rounded-2xl px-4 py-2.5 text-xs"
              required
            />
            <select value={groupType} onChange={(e) => setGroupType(e.target.value as 'group' | 'community')} className="lm-input w-full rounded-2xl px-4 py-2.5 text-xs">
              <option value="group">{isAr ? 'مجموعة خاصة' : 'Private Group'}</option>
              <option value="community">{isAr ? 'قناة عامة' : 'Public Channel'}</option>
            </select>
            <button type="submit" className="lm-btn-primary w-full py-2.5 rounded-full text-xs font-bold cursor-pointer">
              {isAr ? 'إنشاء' : 'Create'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
