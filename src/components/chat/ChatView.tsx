import React, { useEffect, useState, useRef, useCallback } from 'react';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import WaveSurfer from 'wavesurfer.js';
import {
  Search,
  Send,
  Phone,
  Video,
  Paperclip,
  Mic,
  Square,
  Smile,
  CheckCheck,
  Pin,
  Reply,
  Sparkles,
  PanelRight,
  Lock,
  Plus,
  X,
  Play,
  Pause,
  PhoneOff,
  MicOff,
  VideoOff,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, uploadFile } from '../../lib/api';
import { ChatMessageItem, ConversationItem } from '../../types';
import { RichMessageText, UserAvatar, VipBadge } from '../shared/LmBrandMark';

const QUICK_REACTIONS = ['❤️', '🔥', '👍', '😂', '🚀', '👏'];

/** Authentic Telegram Voice Note Waveform Player using open-source wavesurfer.js */
function TelegramVoiceNote({ url, isMine }: { url: string; isMine: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState('0:06');

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isMine ? 'rgba(255,255,255,0.42)' : 'rgba(135,116,225,0.42)',
      progressColor: isMine ? '#FFFFFF' : '#8774E1',
      cursorWidth: 0,
      barWidth: 2.5,
      barGap: 2,
      barRadius: 3,
      height: 28,
      url,
    });
    wsRef.current = ws;
    ws.on('ready', () => {
      const d = Math.round(ws.getDuration() || 6);
      setDuration(`${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`);
    });
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));
    return () => {
      ws.destroy();
    };
  }, [url, isMine]);

  return (
    <div className="flex items-center gap-3 min-w-[210px] sm:min-w-[245px] py-1">
      <button
        type="button"
        onClick={() => wsRef.current?.playPause()}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform active:scale-95 ${
          isMine ? 'bg-white text-[#766AC8]' : 'bg-[#8774E1] text-white'
        }`}
      >
        {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ms-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
        <div className="text-[10px] font-mono-num opacity-75 mt-0.5">{duration} • Voice</div>
      </div>
    </div>
  );
}

export function ChatView() {
  const { user, lang, toast, wsListeners, setActiveTab } = useApp();
  const isAr = lang === 'ar';

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('c_mariam');
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [folder, setFolder] = useState<'all' | 'personal' | 'groups' | 'channels'>('all');
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [filterText, setFilterText] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Telegram features: Reply, Emoji Picker, Info Drawer, Lightbox, Explicit @LM AI Consent
  const [replyTo, setReplyTo] = useState<ChatMessageItem | null>(null);
  const [sharedForAi, setSharedForAi] = useState<ChatMessageItem | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  // New group modal
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupType, setGroupType] = useState<'group' | 'community'>('group');

  // Voice recording
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
      setReplyTo(null);
      setSharedForAi(null);
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

  useEffect(() => {
    if (!callMode) {
      setCallSec(0);
      return;
    }
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
      await loadMessages(activeConvId);
      await loadConversations();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setSending(false);
    }
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
      toast(isAr ? 'يرجى السماح بصلاحية الميكروفون لتسجيل رسالة صوتية' : 'Mic permission required', 'warning');
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
      // fallback call screen
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
    <div className="h-full w-full flex overflow-hidden bg-[var(--tg-sidebar-bg)]">
      {/* ============================================================
          COLUMN 1: TELEGRAM WEB A LEFT CHAT LIST
         ============================================================ */}
      <aside
        className={`${
          mobileChatOpen ? 'hidden md:flex' : 'flex'
        } w-full md:w-[350px] lg:w-[380px] shrink-0 flex-col border-e border-white/[0.07] bg-[var(--tg-sidebar-bg)] select-none`}
      >
        {/* Top Search Pill + New Chat */}
        <div className="px-3 pt-3 pb-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--lm-text-muted)] absolute top-1/2 -translate-y-1/2 start-3.5" />
            <input
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={isAr ? 'بحث في تيليجرام LM...' : 'Search'}
              className="w-full h-10 rounded-full bg-[var(--tg-hover)] ps-10 pe-4 text-sm text-[var(--lm-text)] placeholder:text-[var(--lm-text-muted)] outline-none focus:ring-2 focus:ring-[#8774E1]/50 transition-all"
            />
          </div>
          <button
            onClick={() => setNewGroupOpen(true)}
            title={isAr ? 'محادثة أو قناة جديدة' : 'New Group / Channel'}
            className="w-10 h-10 rounded-full bg-[var(--tg-hover)] hover:bg-[#8774E1] hover:text-white flex items-center justify-center text-[var(--lm-text-secondary)] transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Telegram Folder Tabs */}
        <div className="px-3 flex items-center gap-5 border-b border-white/[0.07] text-xs font-semibold overflow-x-auto no-scrollbar">
          {[
            { id: 'all', ar: 'الكل', en: 'All' },
            { id: 'personal', ar: 'شخصي', en: 'Personal' },
            { id: 'groups', ar: 'المجموعات', en: 'Groups' },
            { id: 'channels', ar: 'القنوات', en: 'Channels' },
          ].map((f) => {
            const active = folder === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFolder(f.id as typeof folder)}
                className={`py-2.5 relative whitespace-nowrap transition-colors cursor-pointer ${
                  active ? 'text-[#8774E1]' : 'text-[var(--lm-text-muted)] hover:text-[var(--lm-text)]'
                }`}
              >
                {isAr ? f.ar : f.en}
                {active && <span className="absolute bottom-0 inset-x-0 h-[3px] rounded-t-full bg-[#8774E1]" />}
              </button>
            );
          })}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredConvs.map((c) => {
            const active = c.id === activeConvId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveConvId(c.id);
                  setMobileChatOpen(true);
                }}
                className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-2xl text-start transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#766AC8] text-white'
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
                    <span className="text-[14px] font-semibold truncate flex items-center gap-1.5">
                      {c.isEncrypted && <Lock className={`w-3 h-3 shrink-0 ${active ? 'text-white/80' : 'text-[#00C73E]'}`} />}
                      <span className="truncate">{c.title}</span>
                    </span>
                    <span className={`text-[11px] shrink-0 flex items-center gap-1 ${active ? 'text-white/80' : 'text-[var(--lm-text-muted)]'}`}>
                      <CheckCheck className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-[#8774E1]'}`} />
                      {c.lastMessageAt}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className={`text-[13px] truncate ${active ? 'text-white/85' : 'text-[var(--lm-text-muted)]'}`}>
                      {c.lastMessage || c.description}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.isPinned && <Pin className={`w-3.5 h-3.5 rotate-45 ${active ? 'text-white/75' : 'text-[var(--lm-text-muted)]'}`} />}
                      {c.unreadCount > 0 && !active && (
                        <span className="px-1.5 min-w-[20px] h-5 rounded-full bg-[#8774E1] text-white text-[11px] font-mono-num font-bold flex items-center justify-center">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ============================================================
          COLUMN 2: TELEGRAM WALLPAPER STAGE + SPEECH BUBBLES + COMPOSER
         ============================================================ */}
      <section className={`${mobileChatOpen ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 tg-wallpaper relative`}>
        {/* Telegram Chat Header */}
        <header className="h-14 px-4 bg-[var(--tg-sidebar-bg)]/95 backdrop-blur-md border-b border-white/[0.07] flex items-center justify-between gap-3 shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileChatOpen(false)}
              className="md:hidden p-1.5 rounded-full hover:bg-white/10 cursor-pointer"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            <button onClick={() => setInfoOpen(v => !v)} className="flex items-center gap-3 min-w-0 text-start cursor-pointer">
              <UserAvatar
                initials={activeConv?.title.slice(0, 2) || 'LM'}
                color={activeConv?.avatarColor || '#3390EC'}
                avatarUrl={activeConv?.avatarUrl}
                size={40}
                online={activeConv?.onlineText?.includes('متصل')}
              />
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{activeConv?.title}</div>
                <div className="text-xs text-[#8774E1] truncate">{activeConv?.onlineText}</div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1 text-[var(--lm-text-secondary)]">
            <button
              onClick={() => startCall('voice')}
              title={isAr ? 'مكالمة صوتية' : 'Voice Call'}
              className="w-9 h-9 rounded-full hover:bg-[var(--tg-hover)] flex items-center justify-center cursor-pointer"
            >
              <Phone className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => startCall('video')}
              title={isAr ? 'مكالمة فيديو' : 'Video Call'}
              className="w-9 h-9 rounded-full hover:bg-[var(--tg-hover)] flex items-center justify-center cursor-pointer"
            >
              <Video className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setInfoOpen(v => !v)}
              title={isAr ? 'معلومات المحادثة والوسائط' : 'Chat Info'}
              className={`w-9 h-9 rounded-full hover:bg-[var(--tg-hover)] flex items-center justify-center cursor-pointer ${
                infoOpen ? 'text-[#8774E1]' : ''
              }`}
            >
              <PanelRight className="w-[18px] h-[18px]" />
            </button>
          </div>
        </header>

        {/* Pinned Message Banner (Telegram Style) */}
        {activeConv?.pinnedMessage && (
          <div className="px-4 py-1.5 bg-[var(--tg-sidebar-bg)]/90 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between gap-3 text-xs z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-0.5 h-7 rounded-full bg-[#8774E1] shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#8774E1]">{isAr ? 'الرسالة المثبتة' : 'Pinned Message'}</div>
                <div className="text-xs text-[var(--lm-text-secondary)] truncate">{activeConv.pinnedMessage}</div>
              </div>
            </div>
            {activeConv.isLargeGroup && !user.adRemoval.largeGroups && (
              <button
                onClick={() => setActiveTab('vip')}
                className="px-2.5 py-1 rounded-full bg-[#8774E1]/15 text-[#8774E1] text-[11px] font-semibold shrink-0 cursor-pointer"
              >
                {isAr ? 'إزالة إعلانات القنوات (50 ج.م)' : 'Remove Ads'}
              </button>
            )}
          </div>
        )}

        {/* Messages Stream (Centered max-w-[740px] just like Telegram Web A!) */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
          <div className="max-w-[740px] mx-auto space-y-2.5">
            {/* Encryption Pill */}
            {activeConv?.isEncrypted && (
              <div className="flex justify-center my-2">
                <div className="px-3.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[11px] text-white/75 flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-[#00C73E]" />
                  <span>
                    {isAr
                      ? 'الرسائل والمكالمات مشفرة من الطرفين • معزولة تمامًا عن LM AI إلا بمشاركتك'
                      : 'Messages are end-to-end encrypted & isolated from LM AI'}
                  </span>
                </div>
              </div>
            )}

            {messages.map((m) => {
              const isMine = m.senderId === user.id;
              const isAi = m.senderId === 'lm_ai';
              const reactionEntries = Object.entries(m.reactions || {});

              return (
                <div
                  key={m.id}
                  onMouseEnter={() => setHoveredMsgId(m.id)}
                  onMouseLeave={() => setHoveredMsgId(prev => (prev === m.id ? null : prev))}
                  onDoubleClick={() => toggleReaction(m.id, '❤️')}
                  className={`group flex items-end gap-2 relative ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMine && (
                    <UserAvatar
                      initials={m.avatarInitials}
                      color={m.avatarColor}
                      avatarUrl={m.avatarUrl}
                      size={34}
                      vipTier={m.vipTier}
                    />
                  )}

                  <div className={`relative max-w-[82%] sm:max-w-[68%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* Hover Floating Quick Reactions + Reply + @LM AI Share */}
                    {hoveredMsgId === m.id && (
                      <div
                        className={`absolute -top-9 ${
                          isMine ? 'end-0' : 'start-0'
                        } z-20 flex items-center gap-0.5 px-2 py-1 rounded-full bg-[#212121]/95 border border-white/12 shadow-xl backdrop-blur-md`}
                      >
                        {QUICK_REACTIONS.slice(0, 4).map((emo) => (
                          <button
                            key={emo}
                            onClick={() => toggleReaction(m.id, emo)}
                            className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center text-xs transition-transform hover:scale-125 cursor-pointer"
                          >
                            {emo}
                          </button>
                        ))}
                        <span className="w-px h-4 bg-white/15 mx-1" />
                        <button
                          onClick={() => setReplyTo(m)}
                          title={isAr ? 'رد' : 'Reply'}
                          className="p-1 rounded-full hover:bg-white/15 text-white/80 cursor-pointer"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>
                        {!isAi && (
                          <button
                            onClick={() => {
                              setSharedForAi(m);
                              setDraft(`@LM AI ${isAr ? 'لخّص هذه الرسالة أو اقترح ردًا مناسبًا' : 'Summarize or suggest a reply'}`);
                            }}
                            title={isAr ? 'مشاركة هذه الرسالة فقط مع @LM AI' : 'Share with @LM AI'}
                            className="p-1 rounded-full hover:bg-white/15 text-[#8774E1] cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Telegram Speech Bubble */}
                    <div
                      style={{
                        backgroundColor: isAi ? '#162923' : isMine ? 'var(--tg-bubble-out)' : 'var(--tg-bubble-in)',
                      }}
                      className={`rounded-2xl ${
                        isMine ? 'rounded-ee-sm' : 'rounded-es-sm'
                      } px-3.5 py-2 shadow-sm text-[13.5px] leading-relaxed relative overflow-hidden ${
                        isAi ? 'border border-emerald-500/35 text-white' : ''
                      }`}
                    >
                      {/* Sender Name in Groups/AI */}
                      {(!isMine || isAi) && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-bold" style={{ color: isAi ? '#34D399' : m.avatarColor }}>
                            {m.displayName}
                          </span>
                          <VipBadge tier={m.vipTier} compact />
                        </div>
                      )}

                      {/* Reply Quote Block */}
                      {m.replyText && (
                        <div className="mb-1.5 ps-2.5 py-1 rounded-lg bg-black/20 border-s-2 border-white/60 text-xs">
                          <div className="font-semibold text-[11px] opacity-90">{m.replySender}</div>
                          <div className="opacity-75 truncate">{m.replyText}</div>
                        </div>
                      )}

                      {/* Photo Attachment */}
                      {m.msgType === 'image' && m.mediaUrl && (
                        <img
                          src={m.mediaUrl}
                          alt="Chat media"
                          onClick={() => setLightboxImg(m.mediaUrl)}
                          className="rounded-xl max-h-72 w-full object-cover mb-1.5 cursor-zoom-in"
                        />
                      )}

                      {/* Real WaveSurfer Voice Note */}
                      {m.msgType === 'audio' && m.mediaUrl && (
                        <TelegramVoiceNote url={m.mediaUrl} isMine={isMine} />
                      )}

                      {/* File Attachment */}
                      {m.msgType === 'file' && m.mediaUrl && (
                        <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="underline font-medium block py-1">
                          📎 {m.content}
                        </a>
                      )}

                      {/* Text Content + Inline Timestamp & Ticks */}
                      {m.msgType !== 'audio' && m.msgType !== 'file' && m.content && (
                        <div className="inline">
                          {isAi ? <RichMessageText text={m.content} /> : <span>{m.content}</span>}
                        </div>
                      )}

                      {/* Telegram Bottom-Corner Time & CheckCheck */}
                      <span className="float-end ms-3 mt-1 inline-flex items-center gap-1 text-[10px] opacity-65 select-none">
                        <span>{m.createdAt}</span>
                        {isMine && <CheckCheck className="w-3.5 h-3.5" />}
                      </span>

                      {/* Reaction Pills inside Bubble */}
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
                                className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
                              >
                                <span>{emo}</span>
                                <span className="text-[11px] font-mono-num font-semibold">{userIds.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </div>

        {/* ============================================================
            FLOATING TELEGRAM COMPOSER DOCK (Centered max-w-[740px])
           ============================================================ */}
        <div className="px-3 sm:px-6 pb-3 pt-1 shrink-0 relative z-20">
          <div className="max-w-[740px] mx-auto relative">
            {/* Emoji Picker Popover */}
            {emojiOpen && (
              <div className="absolute bottom-16 start-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                <EmojiPicker
                  theme={EmojiTheme.DARK}
                  width={320}
                  height={380}
                  onEmojiClick={(e) => setDraft(prev => prev + e.emoji)}
                />
              </div>
            )}

            {/* Reply / @LM AI Consent Preview Strip */}
            {(replyTo || sharedForAi) && (
              <div className="mb-1.5 px-4 py-2 rounded-2xl bg-[var(--tg-sidebar-bg)] border border-white/10 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-0.5 h-7 rounded-full ${sharedForAi ? 'bg-emerald-400' : 'bg-[#8774E1]'}`} />
                  <div className="min-w-0">
                    <div className={`font-semibold text-[11px] ${sharedForAi ? 'text-emerald-400' : 'text-[#8774E1]'}`}>
                      {sharedForAi
                        ? (isAr ? '✨ إذن مشاركة محدد مع @LM AI' : '✨ Consented Share with @LM AI')
                        : `${isAr ? 'الرد على' : 'Reply to'} ${replyTo?.displayName}`}
                    </div>
                    <div className="text-[var(--lm-text-secondary)] truncate">
                      {(sharedForAi || replyTo)?.content}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setReplyTo(null); setSharedForAi(null); }}
                  className="p-1 text-[var(--lm-text-muted)] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Pill Input + Separate Circular Send/Mic Button (Exact Telegram Web A!) */}
            <form onSubmit={sendMessage} className="flex items-center gap-2.5">
              <div className="flex-1 h-12 rounded-full bg-[var(--tg-sidebar-bg)] border border-white/[0.08] px-3 flex items-center gap-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => setEmojiOpen(v => !v)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                    emojiOpen ? 'text-[#8774E1]' : 'text-[var(--lm-text-muted)] hover:text-[var(--lm-text)]'
                  }`}
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
                  title={isAr ? 'إرفاق صورة أو ملف' : 'Attach'}
                  className="w-8 h-8 rounded-full text-[var(--lm-text-muted)] hover:text-[var(--lm-text)] flex items-center justify-center cursor-pointer"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
              </div>

              {draft.trim() ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="w-12 h-12 rounded-full bg-[#8774E1] hover:bg-[#766AC8] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleVoiceNote}
                  title={isAr ? 'رسالة صوتية' : 'Voice Note'}
                  className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0 ${
                    recording ? 'bg-[#FE2C55] text-white animate-pulse' : 'bg-[#8774E1] text-white hover:bg-[#766AC8]'
                  }`}
                >
                  {recording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* ============================================================
          COLUMN 3: TELEGRAM RIGHT PROFILE & SHARED MEDIA DRAWER
         ============================================================ */}
      {infoOpen && activeConv && (
        <aside className="hidden lg:flex w-[320px] shrink-0 flex-col border-s border-white/[0.07] bg-[var(--tg-sidebar-bg)] overflow-y-auto">
          <div className="h-14 px-4 flex items-center justify-between border-b border-white/[0.07] shrink-0">
            <span className="text-sm font-bold">{isAr ? 'معلومات المحادثة' : 'Info'}</span>
            <button onClick={() => setInfoOpen(false)} className="p-1.5 rounded-full hover:bg-[var(--tg-hover)] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 flex flex-col items-center text-center border-b border-white/[0.07]">
            <UserAvatar
              initials={activeConv.title.slice(0, 2)}
              color={activeConv.avatarColor}
              avatarUrl={activeConv.avatarUrl}
              size={88}
            />
            <h3 className="text-base font-bold mt-3">{activeConv.title}</h3>
            <p className="text-xs text-[#8774E1] mt-0.5">{activeConv.onlineText}</p>
            <p className="text-xs text-[var(--lm-text-secondary)] mt-2 leading-relaxed">{activeConv.description}</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="text-xs font-semibold text-[var(--lm-text-muted)]">
              {isAr ? 'الوسائط المشتركة' : 'Shared Media'} ({sharedPhotos.length})
            </div>
            {sharedPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {sharedPhotos.map((p) => (
                  <img
                    key={p.id}
                    src={p.mediaUrl!}
                    alt=""
                    onClick={() => setLightboxImg(p.mediaUrl)}
                    className="aspect-square rounded-lg object-cover cursor-pointer hover:opacity-85"
                  />
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--lm-text-muted)] py-4 text-center">
                {isAr ? 'لا توجد صور مشتركة بعد' : 'No shared photos yet'}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* PHOTO LIGHTBOX */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={lightboxImg} alt="Preview" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
        </div>
      )}

      {/* CALL MODAL */}
      {callMode && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#1C1D24] text-white border border-white/10 overflow-hidden shadow-2xl p-6 text-center space-y-5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-mono-num">
              <Lock className="w-3 h-3" /> E2EE WebRTC • {fmtTimer(callSec)}
            </div>
            {callMode === 'video' && !callCamOff ? (
              <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                <video ref={callVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center gap-3">
                <UserAvatar
                  initials={activeConv?.title.slice(0, 2) || 'LM'}
                  color={activeConv?.avatarColor || '#3390EC'}
                  avatarUrl={activeConv?.avatarUrl}
                  size={88}
                />
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
              <button onClick={endCall} className="w-14 h-14 rounded-full bg-[#FE2C55] text-white flex items-center justify-center cursor-pointer">
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW GROUP / CHANNEL MODAL */}
      {newGroupOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setNewGroupOpen(false)}>
          <form onSubmit={createGroup} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-[#212121] text-white border border-white/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'مجموعة أو قناة تيليجرام جديدة' : 'New Group / Channel'}</h3>
              <button type="button" onClick={() => setNewGroupOpen(false)} className="cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={groupTitle}
              onChange={(e) => setGroupTitle(e.target.value)}
              placeholder={isAr ? 'الاسم...' : 'Name...'}
              className="lm-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              required
            />
            <select value={groupType} onChange={(e) => setGroupType(e.target.value as 'group' | 'community')} className="lm-input w-full rounded-xl px-3.5 py-2.5 text-xs">
              <option value="group">{isAr ? 'مجموعة خاصة مشفرة' : 'Encrypted Private Group'}</option>
              <option value="community">{isAr ? 'قناة / مجتمع عام' : 'Public Channel'}</option>
            </select>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-[#8774E1] text-white text-xs font-semibold cursor-pointer">
              {isAr ? 'إنشاء الآن' : 'Create'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
