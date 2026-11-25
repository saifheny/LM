import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Phone,
  Video,
  Mic,
  SmilePlus,
  CornerUpLeft,
  Sparkles,
  X,
  Pin,
  ArrowRight,
  CircleDot,
  Languages,
} from 'lucide-react';

import { ChatMessageItem, ConversationItem, Lang, UserProfile } from '../../types';
import { UserAvatar, RichMessageText } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { TelegramReactionStrip, TelegramReactionPill } from '../shared/TelegramReactions';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { MobileInlineNavTrigger } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface ChatViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

const TRANSLATE_LANGS = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'tr', label: 'Türkçe' },
];

function isMostlyLatin(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z\u0600-\u06FF]/g, '');
  if (letters.length < 6) return false;
  const latin = (letters.match(/[a-zA-Z]/g) || []).length;
  return latin / letters.length > 0.65;
}

export function ChatView({ user, lang, lastWsEvent }: ChatViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded } = useLayout();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('c_mariam');
  const [mobileShowList, setMobileShowList] = useState(false);
  const [folder, setFolder] = useState<'all' | 'personal' | 'groups' | 'channels'>('all');
  const [search, setSearch] = useState('');

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);
  const [sharedForAi, setSharedForAi] = useState<ChatMessageItem | null>(null);
  const [invokeAiMode, setInvokeAiMode] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [expandedVideoNote, setExpandedVideoNote] = useState<string | null>(null);

  // Instant Message Translation state
  const [translateMenuMsgId, setTranslateMenuMsgId] = useState<string | null>(null);
  const [translations, setTranslations] = useState<Record<string, { text: string; langLabel: string; loading?: boolean }>>({});

  // Telegram Single Action Button Mode Toggle: Voice <-> Circular Video Note
  const [mediaBtnMode, setMediaBtnMode] = useState<'voice' | 'video'>('voice');
  const [showQuickRecordHint, setShowQuickRecordHint] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [recordingVideoNote, setRecordingVideoNote] = useState(false);

  const [callOverlay, setCallOverlay] = useState<'audio' | 'video' | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatType, setNewChatType] = useState<'group' | 'community'>('group');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const callVideoRef = useRef<HTMLVideoElement | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);
  const noteVideoRef = useRef<HTMLVideoElement | null>(null);
  const noteStreamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);

  const loadConversations = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; conversations: ConversationItem[] }>('/api/conversations');
    setConversations(res.conversations);
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    const res = await apiGet<{ ok: boolean; messages: ChatMessageItem[] }>(`/api/conversations/${convId}/messages`);
    setMessages(res.messages);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConvId]);

  useEffect(() => {
    if (lastWsEvent?.event === 'chat:message') {
      const payload = lastWsEvent.payload as { conversationId: string };
      if (payload.conversationId === activeConvId) loadMessages(activeConvId);
      loadConversations();
    }
  }, [lastWsEvent, activeConvId, loadMessages, loadConversations]);

  useEffect(() => {
    return () => {
      callStreamRef.current?.getTracks().forEach(t => t.stop());
      noteStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function translateMessage(msg: ChatMessageItem, targetCode: string, targetLabel: string) {
    setTranslateMenuMsgId(null);
    setTranslations(prev => ({ ...prev, [msg.id]: { text: '...', langLabel: targetLabel, loading: true } }));
    try {
      const res = await apiPost<{ ok: boolean; translated: string }>('/api/translate', {
        text: msg.content,
        targetLang: targetCode,
      });
      setTranslations(prev => ({ ...prev, [msg.id]: { text: res.translated, langLabel: targetLabel, loading: false } }));
    } catch {
      setTranslations(prev => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
    }
  }

  async function startCall(kind: 'audio' | 'video') {
    setCallOverlay(kind);
    if (kind === 'video') {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        callStreamRef.current = s;
        setTimeout(() => {
          if (callVideoRef.current) callVideoRef.current.srcObject = s;
        }, 80);
      } catch {
        // fallback avatar
      }
    }
  }

  function endCall() {
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    callStreamRef.current = null;
    setCallOverlay(null);
  }

  async function startVideoNoteCapture() {
    setShowQuickRecordHint(false);
    setRecordingVideoNote(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      noteStreamRef.current = s;
      setTimeout(() => {
        if (noteVideoRef.current) noteVideoRef.current.srcObject = s;
      }, 60);
    } catch {
      // clean demo preview fallback
    }
  }

  async function finishVideoNoteCapture(send: boolean) {
    noteStreamRef.current?.getTracks().forEach(t => t.stop());
    noteStreamRef.current = null;
    setRecordingVideoNote(false);
    if (send && activeConvId) {
      await apiPost(`/api/conversations/${activeConvId}/messages`, {
        senderId: user.id,
        content: 'رسالة فيديو دائرية',
        msgType: 'video_note',
        mediaUrl: '/uploads/seed/reel4.mp4',
      });
      loadMessages(activeConvId);
    }
  }

  function handleMediaBtnDown() {
    didHoldRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      didHoldRef.current = true;
      if (mediaBtnMode === 'voice') {
        setShowQuickRecordHint(false);
        setRecordingVoice(true);
      } else {
        startVideoNoteCapture();
      }
    }, 320);
  }

  function handleMediaBtnUp() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (!didHoldRef.current) {
      // Exact Telegram single-tap toggle: Voice <-> Circular Video Note
      setMediaBtnMode(prev => (prev === 'voice' ? 'video' : 'voice'));
      setShowQuickRecordHint(true);
    }
  }

  async function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeConvId) return;
    const text = draft.trim();
    setDraft('');
    setComposerFocused(false);

    const shouldInvokeAi = invokeAiMode || /@LM\s*AI/i.test(text) || Boolean(sharedForAi);
    await apiPost(`/api/conversations/${activeConvId}/messages`, {
      senderId: user.id,
      content: text,
      msgType: 'text',
      replyToId: replyTarget?.id || null,
      replySender: replyTarget?.displayName || null,
      replyText: replyTarget?.content?.slice(0, 80) || null,
      invokeAi: shouldInvokeAi,
      sharedSnippet: sharedForAi ? `${sharedForAi.displayName}: ${sharedForAi.content}` : undefined,
    });

    setReplyTarget(null);
    setSharedForAi(null);
    setInvokeAiMode(false);
    loadMessages(activeConvId);
    loadConversations();
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !activeConvId) return;
    const up = await apiUploadFile(f);
    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    await apiPost(`/api/conversations/${activeConvId}/messages`, {
      senderId: user.id,
      content: isImage ? 'صورة' : isVideo ? 'فيديو' : f.name,
      msgType: isImage ? 'image' : isVideo ? 'video_note' : 'file',
      mediaUrl: up.url,
    });
    e.target.value = '';
    loadMessages(activeConvId);
  }

  async function handleSendVoice(file: File) {
    setRecordingVoice(false);
    if (!activeConvId) return;
    const up = await apiUploadFile(file);
    await apiPost(`/api/conversations/${activeConvId}/messages`, {
      senderId: user.id,
      content: 'رسالة صوتية',
      msgType: 'audio',
      mediaUrl: up.url,
      transcript: 'رسالة صوتية.',
    });
    loadMessages(activeConvId);
  }

  async function toggleReaction(msgId: string, reactionKey: string) {
    setOpenPickerMsgId(null);
    await apiPost(`/api/messages/${msgId}/react`, { userId: user.id, emoji: reactionKey });
    loadMessages(activeConvId);
  }

  async function createConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatTitle.trim()) return;
    const res = await apiPost<{ ok: boolean; id: string }>('/api/conversations', {
      title: newChatTitle.trim(),
      type: newChatType,
    });
    setNewChatOpen(false);
    setNewChatTitle('');
    await loadConversations();
    setActiveConvId(res.id);
  }

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const filteredConvs = conversations.filter(c => {
    if (folder !== 'all' && c.folder !== folder) return false;
    if (search.trim() && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasText = draft.trim().length > 0;

  return (
    <div className="h-full w-full bg-black text-[#F5F5F7] flex overflow-hidden">
      {/* Left Conversation Column (Zero Containers, Pure #000000 + 1px Hairline) */}
      <aside
        className={`${
          mobileShowList ? 'flex' : 'hidden md:flex'
        } w-full md:w-[310px] lg:w-[340px] shrink-0 flex-col bg-black border-e border-white/[0.08]`}
      >
        <div className="p-3.5 border-b border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 rounded-full bg-[#09090B] border border-white/[0.09] px-3.5 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#71717A]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
                className="flex-1 bg-transparent text-xs text-white placeholder:text-[#52525B] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className="w-9 h-9 rounded-full bg-[#09090B] border border-white/[0.09] hover:border-white/25 text-[#E4E4E7] flex items-center justify-center cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {[
              { id: 'all' as const, ar: 'الكل', en: 'All' },
              { id: 'personal' as const, ar: 'شخصي', en: 'Direct' },
              { id: 'groups' as const, ar: 'مجموعات', en: 'Groups' },
              { id: 'channels' as const, ar: 'مجتمعات', en: 'Communities' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={`pb-1 border-b-2 transition-colors cursor-pointer ${
                  folder === f.id ? 'border-white text-white font-semibold' : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
                }`}
              >
                {lang === 'ar' ? f.ar : f.en}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
          {filteredConvs.map(conv => {
            const active = conv.id === activeConvId;
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => {
                  setActiveConvId(conv.id);
                  setMobileShowList(false);
                }}
                className={`w-full px-3.5 py-3 flex items-center gap-3 text-start transition-colors cursor-pointer ${
                  active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <UserAvatar
                  initials={conv.title.slice(0, 2)}
                  avatarUrl={conv.avatarUrl}
                  size={44}
                  online={conv.onlineText.includes('متصل')}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-[#F5F5F7] truncate">{conv.title}</span>
                    <span className="text-[10.5px] text-[#71717A] font-mono-num shrink-0">{conv.lastMessageAt}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="text-xs text-[#8E8E93] truncate">{conv.lastMessage || conv.description}</span>
                    {conv.unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-white text-black text-[10px] font-mono-num font-bold shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Active Monochrome Conversation Stage */}
      <section className={`${mobileShowList ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-black min-w-0 relative`}>
        {/* Minimal Header (Zero E2EE/Encrypted Clutter Badges!) */}
        {activeConv && (
          <header className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-black/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileShowList(true)}
                className="md:hidden w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center text-white cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <UserAvatar
                initials={activeConv.title.slice(0, 2)}
                avatarUrl={activeConv.avatarUrl}
                size={38}
                online={activeConv.onlineText.includes('متصل')}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{activeConv.title}</div>
                <div className="text-[11px] text-[#71717A] truncate">{activeConv.onlineText}</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => startCall('audio')}
                className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Phone className="w-4 h-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => startCall('video')}
                className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Video className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          </header>
        )}

        {activeConv?.pinnedMessage && (
          <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2 text-xs text-[#A1A1AA]">
            <Pin className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
            <span className="truncate">{activeConv.pinnedMessage}</span>
          </div>
        )}

        {/* Open Message Stream (Extra bottom padding for Floating Composer) */}
        <div
          onClick={() => {
            setOpenPickerMsgId(null);
            setTranslateMenuMsgId(null);
            setShowQuickRecordHint(false);
            setComposerFocused(false);
            setMobileNavExpanded(false);
          }}
          className="flex-1 overflow-y-auto px-4 pt-5 pb-28 space-y-3 bg-black"
        >
          {messages.map(msg => {
            const isMine = msg.senderId === user.id;
            const isAi = msg.senderId === 'lm_ai' || msg.msgType === 'ai_reply';
            const reactionEntries = Object.entries(msg.reactions || {}).filter(([, arr]) => arr.length > 0);
            const showHoverActions = hoveredMsgId === msg.id || openPickerMsgId === msg.id || translateMenuMsgId === msg.id;
            const translated = translations[msg.id];
            const showAutoTranslateChip =
              msg.msgType !== 'audio' && msg.msgType !== 'video_note' && isMostlyLatin(msg.content) && !translated;

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className={`relative max-w-[82%] sm:max-w-[68%] flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && <UserAvatar initials={msg.avatarInitials} avatarUrl={msg.avatarUrl} size={28} />}

                  <div className="relative">
                    {/* Instant Reaction Strip */}
                    {openPickerMsgId === msg.id && (
                      <div className={`absolute -top-11 z-30 ${isMine ? 'end-0' : 'start-0'}`}>
                        <TelegramReactionStrip onSelect={rId => toggleReaction(msg.id, rId)} />
                      </div>
                    )}

                    {/* Translation Language Picker Popover */}
                    {translateMenuMsgId === msg.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className={`absolute -top-12 z-30 px-1.5 py-1 rounded-full bg-[#111114] border border-white/[0.14] flex items-center gap-1 whitespace-nowrap ${
                          isMine ? 'end-0' : 'start-0'
                        }`}
                      >
                        {TRANSLATE_LANGS.map(l => (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => translateMessage(msg, l.code, l.label)}
                            className="px-2.5 py-1 rounded-full text-[11px] text-[#E4E4E7] hover:bg-white hover:text-black transition-colors cursor-pointer"
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Circular Video Note */}
                    {msg.msgType === 'video_note' && msg.mediaUrl ? (
                      <div
                        onClick={() => setExpandedVideoNote(expandedVideoNote === msg.id ? null : msg.id)}
                        className={`rounded-full overflow-hidden border border-white/[0.16] cursor-pointer transition-all duration-200 ${
                          expandedVideoNote === msg.id ? 'w-60 h-60' : 'w-44 h-44'
                        }`}
                      >
                        <video
                          src={msg.mediaUrl}
                          autoPlay
                          loop
                          playsInline
                          muted={expandedVideoNote !== msg.id}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        className={`px-3.5 py-2.5 text-[14px] leading-relaxed ${
                          isAi
                            ? 'rounded-2xl bg-[#0D0D11] border border-white/[0.14] text-[#F5F5F7]'
                            : isMine
                            ? 'rounded-2xl rounded-ee-sm bg-[#16161A] text-[#F5F5F7]'
                            : 'rounded-2xl rounded-es-sm bg-[#0C0C0E] text-[#F5F5F7]'
                        }`}
                      >
                        {isAi && (
                          <div className="text-[10.5px] font-mono-num text-[#A1A1AA] mb-1 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span>LM AI</span>
                          </div>
                        )}

                        {msg.replyText && (
                          <div className="mb-1.5 ps-2.5 border-s-2 border-white/30 text-xs text-[#A1A1AA] line-clamp-1">
                            <span className="font-semibold text-white me-1">{msg.replySender}:</span>
                            <span>{msg.replyText}</span>
                          </div>
                        )}

                        {msg.msgType === 'image' && msg.mediaUrl && (
                          <img src={msg.mediaUrl} alt="" className="rounded-xl max-h-[260px] w-full object-cover mb-2" />
                        )}

                        {msg.msgType === 'audio' && msg.mediaUrl ? (
                          <SmartVoicePill url={msg.mediaUrl} transcript={msg.transcript} isMine={isMine} />
                        ) : msg.isSpoiler && !revealedSpoilers[msg.id] ? (
                          <button
                            type="button"
                            onClick={() => setRevealedSpoilers(prev => ({ ...prev, [msg.id]: true }))}
                            className="px-2.5 py-1 rounded bg-white/[0.08] text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            محتوى مخفي
                          </button>
                        ) : (
                          <RichMessageText text={msg.content} />
                        )}

                        {/* Inline Translated Result */}
                        {translated && (
                          <div className="mt-2 pt-2 border-t border-white/[0.1] space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-[#8E8E93]">
                              <span className="flex items-center gap-1">
                                <Languages className="w-3 h-3" />
                                <span>{translated.langLabel}</span>
                              </span>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  setTranslations(prev => {
                                    const copy = { ...prev };
                                    delete copy[msg.id];
                                    return copy;
                                  });
                                }}
                                className="hover:text-white cursor-pointer"
                              >
                                إخفاء
                              </button>
                            </div>
                            <div className="text-[13.5px] text-white leading-relaxed">{translated.text}</div>
                          </div>
                        )}

                        {/* 1-Click Translate Chip for Foreign Language Messages */}
                        {showAutoTranslateChip && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setTranslateMenuMsgId(translateMenuMsgId === msg.id ? null : msg.id);
                            }}
                            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[#8E8E93] hover:text-white cursor-pointer"
                          >
                            <Languages className="w-3 h-3" />
                            <span>ترجمة</span>
                          </button>
                        )}

                        <div className="mt-1 flex items-center justify-end text-[10px] font-mono-num text-[#71717A]">
                          <span>{msg.createdAt}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subtle Message Hover Controls: React, Translate, Reply, Share w/ AI */}
                  <div
                    className={`flex items-center gap-0.5 transition-opacity ${
                      showHoverActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setTranslateMenuMsgId(null);
                        setOpenPickerMsgId(openPickerMsgId === msg.id ? null : msg.id);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <SmilePlus className="w-3.5 h-3.5" />
                    </button>

                    {msg.msgType !== 'audio' && msg.msgType !== 'video_note' && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setOpenPickerMsgId(null);
                          setTranslateMenuMsgId(translateMenuMsgId === msg.id ? null : msg.id);
                        }}
                        title="ترجمة الرسالة"
                        className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <Languages className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setReplyTarget(msg)}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSharedForAi(msg);
                        setInvokeAiMode(true);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Clean Restrained Reaction Pills */}
                {reactionEntries.length > 0 && (
                  <div className={`mt-1 flex flex-wrap gap-1 ${isMine ? 'pe-1' : 'ps-9'}`}>
                    {reactionEntries.map(([rKey, usersList]) => (
                      <TelegramReactionPill
                        key={rKey}
                        reactionKey={rKey}
                        count={usersList.length}
                        active={usersList.includes(user.id)}
                        onToggle={() => toggleReaction(msg.id, rKey)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Circular Video Note Live Recorder Overlay */}
        {recordingVideoNote && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-5">
            <div className="w-56 h-56 rounded-full overflow-hidden border-2 border-white/30 bg-[#0D0D10] flex items-center justify-center">
              <video ref={noteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => finishVideoNoteCapture(false)}
                className="px-5 py-2 rounded-full bg-white/[0.08] text-xs text-white cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => finishVideoNoteCapture(true)}
                className="px-6 py-2 rounded-full bg-white text-black text-xs font-semibold cursor-pointer"
              >
                إرسال الفيديو الدائري
              </button>
            </div>
          </div>
        )}

        {/* FLOATING TELEGRAM-STYLE COMPOSER (Zero Solid Bottom Strip!) */}
        <div className="pointer-events-none absolute bottom-3.5 inset-x-3.5 md:inset-x-6 z-20 flex flex-col items-center">
          <div className="pointer-events-auto w-full max-w-[740px] space-y-2">
            {(replyTarget || sharedForAi) && (
              <div className="px-3.5 py-1.5 rounded-full bg-[#09090B]/95 backdrop-blur-md border border-white/[0.1] flex items-center justify-between text-xs">
                <span className="truncate text-[#D4D4D8]">
                  {sharedForAi
                    ? `LM AI ← "${sharedForAi.content.slice(0, 50)}"`
                    : `${replyTarget?.displayName}: ${replyTarget?.content.slice(0, 50)}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTarget(null);
                    setSharedForAi(null);
                    setInvokeAiMode(false);
                  }}
                  className="text-[#71717A] hover:text-white ms-2 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Record Pill Appears Above the Single Mic/Video Switcher Button */}
            {showQuickRecordHint && !hasText && !recordingVoice && (
              <div className="flex justify-end px-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickRecordHint(false);
                    if (mediaBtnMode === 'voice') setRecordingVoice(true);
                    else startVideoNoteCapture();
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#111115] border border-white/[0.15] text-xs text-white flex items-center gap-1.5 cursor-pointer hover:bg-white hover:text-black transition-colors"
                >
                  {mediaBtnMode === 'voice' ? <Mic className="w-3.5 h-3.5" /> : <CircleDot className="w-3.5 h-3.5" />}
                  <span>{mediaBtnMode === 'voice' ? 'تسجيل رسالة صوتية' : 'تسجيل فيديو دائري'}</span>
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" onChange={handleAttachFile} className="hidden" />

            <div className="flex items-center gap-2">
              <MobileInlineNavTrigger lang={lang} />

              {!mobileNavExpanded && (
                <div className="flex-1 min-w-0">
                  {recordingVoice ? (
                    <LiveVoiceRecorder onCancel={() => setRecordingVoice(false)} onSend={handleSendVoice} />
                  ) : (
                    <ObsidianComposerPill
                      value={draft}
                      onChange={v => {
                        setDraft(v);
                        if (v.trim()) setShowQuickRecordHint(false);
                      }}
                      onSubmit={handleSendText}
                      onFocus={() => setComposerFocused(true)}
                      onBlur={() => setTimeout(() => setComposerFocused(false), 140)}
                      placeholder={
                        invokeAiMode
                          ? '@LM AI...'
                          : lang === 'ar'
                          ? 'اكتب رسالة...'
                          : 'Message...'
                      }
                      onAttach={() => fileInputRef.current?.click()}
                      onSparkle={() => setInvokeAiMode(v => !v)}
                      sparkleActive={invokeAiMode}
                      /* Exact Telegram Morphing End Button: Typing -> Chrome ↑ Send | Empty -> Single Voice/Circular-Video Toggle Button */
                      customAction={
                        hasText ? (
                          <ChromeArrowButton type="submit" size={40} />
                        ) : (
                          <button
                            type="button"
                            onPointerDown={handleMediaBtnDown}
                            onPointerUp={handleMediaBtnUp}
                            onPointerLeave={() => {
                              if (holdTimerRef.current) {
                                window.clearTimeout(holdTimerRef.current);
                                holdTimerRef.current = null;
                              }
                            }}
                            title={
                              mediaBtnMode === 'voice'
                                ? 'اضغط للتبديل إلى فيديو دائري أو اضغط مطولًا للتسجيل'
                                : 'اضغط للتبديل إلى صوت أو اضغط مطولًا للتسجيل'
                            }
                            className="chrome-rim-btn w-10 h-10 shrink-0 cursor-pointer"
                          >
                            <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                              {mediaBtnMode === 'voice' ? (
                                <Mic className="w-[18px] h-[18px]" strokeWidth={1.9} />
                              ) : (
                                <CircleDot className="w-[18px] h-[18px]" strokeWidth={1.9} />
                              )}
                            </span>
                          </button>
                        )
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Voice / Video Call Overlay */}
      {callOverlay && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between py-14 px-6">
          <div className="text-center space-y-1">
            <div className="text-xl font-semibold text-white">{activeConv.title}</div>
            <div className="text-xs text-[#71717A]">جارٍ الاتصال...</div>
          </div>

          {callOverlay === 'video' ? (
            <div className="w-full max-w-[360px] h-[420px] rounded-3xl overflow-hidden border border-white/[0.12] bg-[#070709] flex items-center justify-center">
              <video ref={callVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>
          ) : (
            <UserAvatar initials={activeConv.title.slice(0, 2)} avatarUrl={activeConv.avatarUrl} size={110} online />
          )}

          <button
            type="button"
            onClick={endCall}
            className="px-8 py-3 rounded-full bg-[#EF4444] text-white text-sm font-semibold cursor-pointer"
          >
            إنهاء المكالمة
          </button>
        </div>
      )}

      {/* New Chat Modal */}
      {newChatOpen && (
        <div onClick={() => setNewChatOpen(false)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={createConversation}
            className="w-full max-w-[380px] rounded-2xl bg-[#070709] border border-white/[0.12] p-5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">محادثة جديدة</span>
              <button type="button" onClick={() => setNewChatOpen(false)} className="text-[#71717A] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newChatTitle}
              onChange={e => setNewChatTitle(e.target.value)}
              placeholder="الاسم..."
              className="w-full h-11 rounded-xl bg-black border border-white/[0.1] px-3.5 text-xs text-white outline-none"
            />
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setNewChatType('group')}
                  className={`px-3 py-1.5 rounded-full border cursor-pointer ${
                    newChatType === 'group' ? 'bg-white text-black border-white font-semibold' : 'border-white/[0.1] text-[#A1A1AA]'
                  }`}
                >
                  مجموعة
                </button>
                <button
                  type="button"
                  onClick={() => setNewChatType('community')}
                  className={`px-3 py-1.5 rounded-full border cursor-pointer ${
                    newChatType === 'community' ? 'bg-white text-black border-white font-semibold' : 'border-white/[0.1] text-[#A1A1AA]'
                  }`}
                >
                  مجتمع
                </button>
              </div>
              <ChromeArrowButton type="submit" disabled={!newChatTitle.trim()} size={36} />
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
