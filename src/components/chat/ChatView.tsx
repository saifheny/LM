import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Languages,
} from 'lucide-react';

import { ChatMessageItem, ConversationItem, Lang, UserProfile } from '../../types';
import { AiSummonBadge, MARKDOWN_LINK_COMPONENTS, UserAvatar, RichMessageText } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { TelegramReactionStrip, TelegramReactionPill } from '../shared/TelegramReactions';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { NavAiIcon, TelegramVideoNoteIcon } from '../shared/Icons2026Pro';
import { SplitComposerOrb } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface ChatViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

const WORLD_LANGUAGES = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh-CN', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ru', label: 'Русский' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'it', label: 'Italiano' },
  { code: 'ur', label: 'اردو' },
  { code: 'fa', label: 'فارسی' },
  { code: 'id', label: 'Indonesia' },
];

function isMostlyLatin(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z\u0600-\u06FF]/g, '');
  if (letters.length < 6) return false;
  const latin = (letters.match(/[a-zA-Z]/g) || []).length;
  return latin / letters.length > 0.65;
}

export function ChatView({ user, lang, lastWsEvent }: ChatViewProps) {
  const { setComposerFocused, mobileNavExpanded, setMobileNavExpanded, setChatInThread, setBottomDockHidden } = useLayout();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_chat_conv_id') || 'c_mariam';
    } catch {
      return 'c_mariam';
    }
  });
  const [mobileShowList, setMobileShowListState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('lm_chat_in_thread') !== '1';
    } catch {
      return true;
    }
  });
  const [folder, setFolder] = useState<'all' | 'personal' | 'groups' | 'channels'>('all');
  const [search, setSearch] = useState('');

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [draft, setDraftState] = useState<string>(() => {
    try {
      const cid = localStorage.getItem('lm_chat_conv_id') || 'c_mariam';
      return localStorage.getItem(`lm_draft_chat_${cid}`) || '';
    } catch {
      return '';
    }
  });
  const [replyTarget, setReplyTarget] = useState<ChatMessageItem | null>(null);
  const [sharedForAi, setSharedForAi] = useState<ChatMessageItem | null>(null);
  const [invokeAiMode, setInvokeAiMode] = useState(false);

  const setActiveConvId = useCallback((cid: string) => {
    setActiveConvIdState(cid);
    try {
      localStorage.setItem('lm_chat_conv_id', cid);
      setDraftState(localStorage.getItem(`lm_draft_chat_${cid}`) || '');
    } catch {
      setDraftState('');
    }
  }, []);

  const setMobileShowList = useCallback((showList: boolean) => {
    setMobileShowListState(showList);
    try {
      localStorage.setItem('lm_chat_in_thread', showList ? '0' : '1');
    } catch {
      // ignore
    }
  }, []);

  const setDraft = useCallback(
    (v: string) => {
      setDraftState(v);
      try {
        localStorage.setItem(`lm_draft_chat_${activeConvId}`, v);
      } catch {
        // ignore
      }
    },
    [activeConvId]
  );

  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});
  const [expandedVideoNote, setExpandedVideoNote] = useState<string | null>(null);

  // In-Place Message Translation (replaces bubble content directly, clears on empty-space click!)
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
  const [newChatAiEnabled, setNewChatAiEnabled] = useState(true);
  const [aiTypingConvId, setAiTypingConvId] = useState<string | null>(null);
  const [togglingAiMode, setTogglingAiMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const callVideoRef = useRef<HTMLVideoElement | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);
  const noteVideoRef = useRef<HTMLVideoElement | null>(null);
  const noteStreamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const didHoldRef = useRef(false);
  const listScrollRef = useRef(0);

  // Sync whether mobile is viewing Chat List (show Bottom Dock!) vs active Thread (show Floating Composer + Split Orb!)
  useEffect(() => {
    setChatInThread(!mobileShowList);
    return () => setChatInThread(false);
  }, [mobileShowList, setChatInThread]);

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
  }, [messages.length, activeConvId, aiTypingConvId]);

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

  function handleConvListScroll(e: React.UIEvent<HTMLDivElement>) {
    const top = e.currentTarget.scrollTop;
    const delta = top - listScrollRef.current;
    if (top < 20) setBottomDockHidden(false);
    else if (delta > 10) setBottomDockHidden(true);
    else if (delta < -6) setBottomDockHidden(false);
    listScrollRef.current = top;
  }

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
      // clean fallback
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
      setMediaBtnMode(prev => (prev === 'voice' ? 'video' : 'voice'));
      setShowQuickRecordHint(true);
    }
  }

  function handleDraftChange(v: string) {
    setDraft(v);
    if (v.trim()) setShowQuickRecordHint(false);
  }

  function handleSelectReply(msg: ChatMessageItem) {
    setReplyTarget(msg);
    setSharedForAi(null);
    // Replying directly to LM AI automatically keeps AI mode ON so you converse seamlessly!
    if (msg.senderId === 'lm_ai' || msg.msgType === 'ai_reply') {
      setInvokeAiMode(true);
    }
  }

  async function toggleGroupAiMode() {
    if (!activeConv || activeConv.type === 'dm' || togglingAiMode) return;
    setTogglingAiMode(true);
    const nextEnabled = !activeConv.aiEnabled;
    try {
      await apiPost(`/api/conversations/${activeConv.id}/ai-mode`, {
        userId: user.id,
        aiEnabled: nextEnabled,
      });
      setConversations(prev =>
        prev.map(c => (c.id === activeConv.id ? { ...c, aiEnabled: nextEnabled } : c))
      );
    } finally {
      setTogglingAiMode(false);
    }
  }

  async function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeConvId) return;
    const raw = draft.trim();
    const cleaned = raw.replace(/^(\/ai|-ai|\/|-)\s*/i, '').trim() || raw;
    const convTargetId = activeConvId;
    const explicitShared = sharedForAi;
    const activeReply = replyTarget;
    const replyingToAi = Boolean(activeReply && (activeReply.senderId === 'lm_ai' || activeReply.msgType === 'ai_reply'));
    const shouldInvokeAi =
      invokeAiMode ||
      replyingToAi ||
      /^(\/ai|-ai|@lm\s*ai|\/)/i.test(raw) ||
      /@(lm\s*ai|ai)\b/i.test(raw) ||
      Boolean(explicitShared);

    setDraft('');
    setComposerFocused(false);
    setReplyTarget(null);
    setSharedForAi(null);
    setInvokeAiMode(false);

    // 1. Optimistically render the user's message IMMEDIATELY (0ms feedback!)
    const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const tempId = `tmp_${Date.now()}`;
    const optimisticMsg: ChatMessageItem = {
      id: tempId,
      conversationId: convTargetId,
      senderId: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarInitials: user.avatarInitials,
      avatarUrl: user.avatarUrl,
      content: cleaned,
      msgType: 'text',
      mediaUrl: null,
      transcript: null,
      isSpoiler: false,
      aiSummoned: shouldInvokeAi,
      replyToId: activeReply?.id || null,
      replySender: activeReply?.displayName || null,
      replyText: activeReply?.content?.slice(0, 80) || null,
      reactions: {},
      aiConsentRef: null,
      createdAt: nowStr,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    // 2. If calling AI, show live "LM AI يكتب الآن..." indicator right inside the conversation!
    if (shouldInvokeAi) {
      setAiTypingConvId(convTargetId);
    }

    try {
      // When replying to a person AND summoning AI, pass that person's message as context automatically!
      const contextSnippet = explicitShared
        ? `${explicitShared.displayName}: ${explicitShared.transcript || explicitShared.content}`
        : activeReply && shouldInvokeAi
        ? `${activeReply.senderId === 'lm_ai' ? 'LM AI (ردك السابق)' : activeReply.displayName}: ${activeReply.transcript || activeReply.content}`
        : undefined;

      await apiPost(`/api/conversations/${convTargetId}/messages`, {
        senderId: user.id,
        content: cleaned,
        msgType: 'text',
        replyToId: activeReply?.id || null,
        replySender: activeReply?.displayName || null,
        replyText: activeReply?.content?.slice(0, 80) || null,
        invokeAi: shouldInvokeAi,
        sharedSnippet: contextSnippet,
      });
      await loadMessages(convTargetId);
      loadConversations();
    } catch {
      await loadMessages(convTargetId);
    } finally {
      setAiTypingConvId(cur => (cur === convTargetId ? null : cur));
    }
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

  async function handleSendVoice(file: File, _durationSec: number, liveTranscript?: string | null) {
    setRecordingVoice(false);
    if (!activeConvId) return;
    const convTargetId = activeConvId;
    const activeReply = replyTarget;
    const explicitShared = sharedForAi;
    const replyingToAi = Boolean(activeReply && (activeReply.senderId === 'lm_ai' || activeReply.msgType === 'ai_reply'));
    const shouldInvokeAi = invokeAiMode || replyingToAi || Boolean(explicitShared);

    setReplyTarget(null);
    setSharedForAi(null);
    setInvokeAiMode(false);

    if (shouldInvokeAi) setAiTypingConvId(convTargetId);
    try {
      const up = await apiUploadFile(file);
      const contextSnippet = explicitShared
        ? `${explicitShared.displayName}: ${explicitShared.transcript || explicitShared.content}`
        : activeReply && shouldInvokeAi
        ? `${activeReply.senderId === 'lm_ai' ? 'LM AI (ردك السابق)' : activeReply.displayName}: ${activeReply.transcript || activeReply.content}`
        : undefined;

      await apiPost(`/api/conversations/${convTargetId}/messages`, {
        senderId: user.id,
        content: 'رسالة صوتية',
        msgType: 'audio',
        mediaUrl: up.url,
        transcript: liveTranscript || null,
        replyToId: activeReply?.id || null,
        replySender: activeReply?.displayName || null,
        replyText: activeReply?.content?.slice(0, 80) || null,
        invokeAi: shouldInvokeAi,
        sharedSnippet: contextSnippet,
      });
      await loadMessages(convTargetId);
      loadConversations();
    } finally {
      setAiTypingConvId(cur => (cur === convTargetId ? null : cur));
    }
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
      creatorId: user.id,
      aiEnabled: newChatAiEnabled,
    });
    setNewChatOpen(false);
    setNewChatTitle('');
    await loadConversations();
    setActiveConvId(res.id);
    setMobileShowList(false);
  }

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const filteredConvs = conversations.filter(c => {
    if (folder !== 'all' && c.folder !== folder) return false;
    if (search.trim() && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hasText = draft.trim().length > 0;

  return (
    <div className="h-full w-full bg-[#0A0A0C] text-[#F2F2F5] flex overflow-hidden">
      {/* Left Conversations List (Bottom Dock stays visible outside here on mobile!) */}
      <aside
        className={`${
          mobileShowList ? 'flex' : 'hidden md:flex'
        } w-full md:w-[310px] lg:w-[340px] shrink-0 flex-col bg-[#0A0A0C] border-e border-white/[0.07]`}
      >
        <div className="p-2.5">
          <div className="p-3 rounded-[22px] bg-[#121217]/92 backdrop-blur-xl border border-white/[0.08] space-y-2.5 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 rounded-full bg-[#0A0A0E] border border-white/[0.08] px-3.5 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#71717A]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-[#585860] outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setNewChatOpen(true)}
                className="w-9 h-9 rounded-full bg-[#0A0A0E] border border-white/[0.08] hover:border-white/25 text-[#E4E4E7] flex items-center justify-center cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3.5 text-xs px-1">
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
                    folder === f.id ? 'border-white text-white font-semibold' : 'border-transparent text-[#7A7A85] hover:text-[#D4D4D8]'
                  }`}
                >
                  {lang === 'ar' ? f.ar : f.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div onScroll={handleConvListScroll} className="flex-1 overflow-y-auto divide-y divide-white/[0.06] pb-20 md:pb-0">
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
                  active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
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
                    <span className="text-[13.5px] font-semibold text-[#F2F2F5] truncate">{conv.title}</span>
                    <span className="text-[10.5px] text-[#7A7A85] font-mono-num shrink-0">{conv.lastMessageAt}</span>
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

      {/* Active Conversation Stage */}
      <section className={`${mobileShowList ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#0A0A0C] min-w-0 relative`}>
        {/* FLOATING TRANSPARENT HEADER PILLS (Messages scroll smoothly beneath!) */}
        {activeConv && (
          <header className="pointer-events-none absolute top-3 inset-x-3.5 md:inset-x-5 z-20 flex items-center justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-2.5 ps-1.5 pe-3.5 py-1.5 rounded-full bg-[#131318]/78 backdrop-blur-xl border border-white/[0.1] min-w-0 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMobileShowList(true);
                  setMobileNavExpanded(false);
                }}
                className="md:hidden w-7 h-7 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white cursor-pointer shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <UserAvatar
                initials={activeConv.title.slice(0, 2)}
                avatarUrl={activeConv.avatarUrl}
                size={34}
                online={activeConv.onlineText.includes('متصل')}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-white truncate max-w-[160px] sm:max-w-[240px]">
                  {activeConv.title}
                </div>
                <div className="text-[10.5px] text-[#9E9EA8] truncate">{activeConv.onlineText}</div>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              {/* Group Creator AI Member Permission Toggle (Groups & Communities only — DMs remain isolated!) */}
              {activeConv.type !== 'dm' && (
                activeConv.creatorId === user.id ? (
                  <button
                    type="button"
                    disabled={togglingAiMode}
                    onClick={toggleGroupAiMode}
                    title={
                      activeConv.aiEnabled
                        ? 'AI عضو أساسي يرى محادثة المجموعة — اضغط للتعطيل'
                        : 'تفعيل AI كعضو أساسي يرى محادثة المجموعة'
                    }
                    className={`h-9 px-3 rounded-full backdrop-blur-xl border text-[11px] font-medium flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors ${
                      activeConv.aiEnabled
                        ? 'bg-white text-black border-white font-semibold'
                        : 'bg-[#131318]/80 border-white/[0.12] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${activeConv.aiEnabled ? 'bg-[#16A34A]' : 'bg-[#585860]'}`} />
                    <Sparkles className="w-3 h-3" />
                    <span className="hidden sm:inline">{activeConv.aiEnabled ? 'AI عضو نشط' : 'تفعيل AI'}</span>
                  </button>
                ) : activeConv.aiEnabled ? (
                  <div className="h-9 px-3 rounded-full bg-[#131318]/80 backdrop-blur-xl border border-white/[0.12] text-[11px] text-[#E4E4E7] flex items-center gap-1.5 shadow-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    <Sparkles className="w-3 h-3" />
                    <span className="hidden sm:inline">AI عضو</span>
                  </div>
                ) : null
              )}

              <div className="flex items-center gap-1 p-1 rounded-full bg-[#131318]/78 backdrop-blur-xl border border-white/[0.1] shadow-lg">
                <button
                  type="button"
                  onClick={() => startCall('audio')}
                  className="w-8 h-8 rounded-full hover:bg-white/[0.09] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <Phone className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => startCall('video')}
                  className="w-8 h-8 rounded-full hover:bg-white/[0.09] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <Video className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </header>
        )}

        {/* Open Message Stream (Tap empty space clears translation, menus, & mobile bottom dock!) */}
        <div
          onClick={() => {
            setOpenPickerMsgId(null);
            setTranslateMenuMsgId(null);
            setTranslations({});
            setShowQuickRecordHint(false);
            setComposerFocused(false);
            setMobileNavExpanded(false);
          }}
          className="flex-1 overflow-y-auto px-4 pt-20 pb-28 space-y-3 bg-[#0A0A0C]"
        >
          {activeConv?.pinnedMessage && (
            <div className="mx-auto w-fit max-w-full px-3.5 py-1.5 rounded-full bg-[#131318]/80 border border-white/[0.08] flex items-center gap-2 text-[11.5px] text-[#A1A1AA] mb-2">
              <Pin className="w-3 h-3 text-[#7A7A85] shrink-0" />
              <span className="truncate">{activeConv.pinnedMessage}</span>
            </div>
          )}

          {messages.map((msg, msgIdx) => {
            const isMine = msg.senderId === user.id;
            const isAi = msg.senderId === 'lm_ai' || msg.msgType === 'ai_reply';
            const reactionEntries = Object.entries(msg.reactions || {}).filter(([, arr]) => arr.length > 0);
            const showHoverActions = hoveredMsgId === msg.id || openPickerMsgId === msg.id || translateMenuMsgId === msg.id;
            const translated = translations[msg.id];
            const showAutoTranslateChip =
              msg.msgType !== 'audio' && msg.msgType !== 'video_note' && isMostlyLatin(msg.content) && !translated;

            // Prevent clipping behind floating top header for top messages!
            const openPopoverDownward = msgIdx < 2;
            const popoverPosClass = openPopoverDownward ? 'top-full mt-2' : 'bottom-full mb-2';

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className={`relative max-w-[84%] sm:max-w-[68%] flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && <UserAvatar initials={msg.avatarInitials} avatarUrl={msg.avatarUrl} size={28} />}

                  <div className="relative">
                    {/* 2026 Custom Vector Reaction Picker (Auto-Flips Downward for Top Messages!) */}
                    {openPickerMsgId === msg.id && (
                      <div className={`absolute ${popoverPosClass} z-30 ${isMine ? 'end-0' : 'start-0'}`}>
                        <TelegramReactionStrip onSelect={rId => toggleReaction(msg.id, rId)} />
                      </div>
                    )}

                    {/* 16 Major World Languages Translation Picker (Auto-Flips Downward for Top Messages!) */}
                    {translateMenuMsgId === msg.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className={`absolute ${popoverPosClass} z-30 w-[268px] p-2 rounded-2xl bg-[#16161C]/96 backdrop-blur-xl border border-white/[0.14] shadow-2xl grid grid-cols-3 gap-1 ${
                          isMine ? 'end-0' : 'start-0'
                        }`}
                      >
                        {WORLD_LANGUAGES.map(l => (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => translateMessage(msg, l.code, l.label)}
                            className="px-2 py-1.5 rounded-xl text-[11px] text-[#E4E4E7] hover:bg-white hover:text-black transition-colors cursor-pointer truncate text-center"
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Circular Video Note */}
                    {msg.msgType === 'video_note' && msg.mediaUrl ? (
                      <div
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedVideoNote(expandedVideoNote === msg.id ? null : msg.id);
                        }}
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
                        onClick={e => e.stopPropagation()}
                        className={`px-3.5 py-2.5 text-[14px] leading-relaxed ${
                          isAi
                            ? 'rounded-2xl bg-[#15151B] border border-white/[0.14] text-[#F2F2F5]'
                            : msg.aiSummoned
                            ? `rounded-2xl ${isMine ? 'rounded-ee-sm' : 'rounded-es-sm'} border lm-ai-summon-ring text-[#F2F2F5]`
                            : isMine
                            ? 'rounded-2xl rounded-ee-sm bg-[#1B1B21] text-[#F2F2F5]'
                            : 'rounded-2xl rounded-es-sm bg-[#131317] text-[#F2F2F5]'
                        }`}
                      >
                        {isAi && (
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <AiSummonBadge label="LM AI" compact />
                          </div>
                        )}

                        {!isAi && msg.aiSummoned && (
                          <div className="mb-1.5 flex items-center justify-end">
                            <AiSummonBadge label="AI" compact />
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

                        {/* IN-PLACE TRANSLATION: Replaces message text directly! Click empty space anywhere to restore original. */}
                        {msg.msgType === 'audio' && msg.mediaUrl ? (
                          <SmartVoicePill
                            url={msg.mediaUrl}
                            transcript={msg.transcript}
                            recordId={msg.id}
                            table="messages"
                            accent={msg.aiSummoned ? 'ai' : 'default'}
                            isMine={isMine}
                          />
                        ) : msg.isSpoiler && !revealedSpoilers[msg.id] ? (
                          <button
                            type="button"
                            onClick={() => setRevealedSpoilers(prev => ({ ...prev, [msg.id]: true }))}
                            className="px-2.5 py-1 rounded bg-white/[0.08] text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            محتوى مخفي
                          </button>
                        ) : (
                          <div>
                            {isAi && !translated ? (
                              <div className="prose-sm space-y-1.5 text-[#F2F2F5] leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <RichMessageText text={translated ? translated.text : msg.content} />
                            )}
                            {translated && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-[#8E8E93]">
                                <Languages className="w-2.5 h-2.5" />
                                <span>{translated.langLabel}</span>
                              </div>
                            )}
                          </div>
                        )}

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

                        <div className="mt-1 flex items-center justify-end text-[10px] font-mono-num text-[#7A7A85]">
                          <span>{msg.createdAt}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subtle Message Hover Controls */}
                  <div
                    onClick={e => e.stopPropagation()}
                    className={`flex items-center gap-0.5 transition-opacity ${
                      showHoverActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setTranslateMenuMsgId(null);
                        setOpenPickerMsgId(openPickerMsgId === msg.id ? null : msg.id);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <SmilePlus className="w-3.5 h-3.5" />
                    </button>

                    {msg.msgType !== 'audio' && msg.msgType !== 'video_note' && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenPickerMsgId(null);
                          setTranslateMenuMsgId(translateMenuMsgId === msg.id ? null : msg.id);
                        }}
                        title="ترجمة"
                        className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <Languages className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSelectReply(msg)}
                      title={isAi ? 'الرد على LM AI' : 'رد'}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <CornerUpLeft className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setReplyTarget(msg);
                        setSharedForAi(msg);
                        setInvokeAiMode(true);
                      }}
                      title="اسأل AI عن هذه الرسالة"
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#7A7A85] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Custom Vector Reaction Pills */}
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
          {/* Live LM AI Typing Indicator inside Chat Stream */}
          {aiTypingConvId === activeConvId && (
            <div className="flex flex-col items-start">
              <div className="flex items-end gap-2 max-w-[78%]">
                <UserAvatar initials="AI" avatarUrl={null} size={28} />
                <div className="px-3.5 py-2.5 rounded-2xl bg-[#15151B] border border-white/[0.14] text-xs text-[#D4D4D8] flex items-center gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                  <span>LM AI يكتب الآن</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/75 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/75 animate-bounce [animation-delay:140ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/75 animate-bounce [animation-delay:280ms]" />
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Circular Video Note Live Recorder Overlay */}
        {recordingVideoNote && (
          <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-5">
            <div className="w-56 h-56 rounded-full overflow-hidden border-2 border-white/30 bg-[#131317] flex items-center justify-center">
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
                إرسال
              </button>
            </div>
          </div>
        )}

        {/* FLOATING AUTO-EXPANDING COMPOSER + SPLIT ORB (Hidden when mobile full bottom dock is expanded!) */}
        {!mobileNavExpanded && (
          <div className="pointer-events-none absolute bottom-3.5 inset-x-3.5 md:inset-x-6 z-20 flex flex-col items-center">
            <div className="pointer-events-auto w-full max-w-[780px] flex flex-col gap-2">
              {/* Compact Side-Aligned Reply / AI Context Card (Never oversized or paper-thin!) */}
              {(replyTarget || sharedForAi) && (
                <div className="w-fit max-w-[300px] sm:max-w-[340px] self-start rounded-2xl bg-[#15151C]/96 backdrop-blur-xl border border-white/[0.12] px-3 py-2 flex items-center gap-2.5 shadow-xl">
                  <span
                    className={`w-[2.5px] self-stretch rounded-full shrink-0 ${
                      sharedForAi ? 'bg-[#A78BFA]' : 'bg-white/55'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white flex items-center gap-1 truncate">
                      {sharedForAi ? (
                        <>
                          <Sparkles className="w-3 h-3 text-[#C4B5FD] shrink-0" />
                          <span>سياق AI • {sharedForAi.displayName}</span>
                        </>
                      ) : (
                        <span>الرد على {replyTarget?.displayName}</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[#A1A1AA] truncate max-w-[215px]">
                      {(sharedForAi ? sharedForAi.content : replyTarget?.content || '').slice(0, 68)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTarget(null);
                      setSharedForAi(null);
                      setInvokeAiMode(false);
                    }}
                    className="w-5 h-5 rounded-full bg-white/[0.07] hover:bg-white/[0.16] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Quick Record Trigger Above Single Voice/Video Toggle */}
              {showQuickRecordHint && !hasText && !recordingVoice && (
                <div className="flex justify-end px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickRecordHint(false);
                      if (mediaBtnMode === 'voice') setRecordingVoice(true);
                      else startVideoNoteCapture();
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[#16161C] border border-white/[0.15] text-xs text-white flex items-center gap-1.5 cursor-pointer hover:bg-white hover:text-black transition-colors"
                  >
                    {mediaBtnMode === 'voice' ? <Mic className="w-3.5 h-3.5" /> : <TelegramVideoNoteIcon className="w-4 h-4" />}
                    <span>{mediaBtnMode === 'voice' ? (invokeAiMode ? 'تسجيل صوتي لـ AI' : 'تسجيل صوتي') : 'تسجيل فيديو دائري'}</span>
                  </button>
                </div>
              )}

              <input ref={fileInputRef} type="file" onChange={handleAttachFile} className="hidden" />

              <div className="flex items-end gap-2">
                {/* Split Orb: Expands upward into "إرفاق ملف" + "الشريط السفلي"! */}
                <SplitComposerOrb onAttach={() => fileInputRef.current?.click()} showNavOption />

                <div className="flex-1 min-w-0">
                  {recordingVoice ? (
                    <LiveVoiceRecorder
                      accent={invokeAiMode ? 'ai' : 'default'}
                      onCancel={() => setRecordingVoice(false)}
                      onSend={handleSendVoice}
                    />
                  ) : (
                    <ObsidianComposerPill
                      value={draft}
                      onChange={handleDraftChange}
                      onSubmit={handleSendText}
                      onFocus={() => setComposerFocused(true)}
                      onBlur={() => setTimeout(() => setComposerFocused(false), 140)}
                      placeholder={
                        invokeAiMode
                          ? replyTarget
                            ? `اسأل AI عن رسالة ${replyTarget.displayName}...`
                            : 'اسأل الذكاء الاصطناعي...'
                          : lang === 'ar'
                          ? 'اكتب رسالة...'
                          : 'Message...'
                      }
                      extraEnd={
                        <button
                          type="button"
                          onClick={() => setInvokeAiMode(v => !v)}
                          title={invokeAiMode ? 'إيقاف استدعاء AI' : 'تفعيل استدعاء الذكاء الاصطناعي'}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                            invokeAiMode
                              ? 'bg-gradient-to-br from-[#0EA5E9] via-[#6366F1] to-[#A855F7] text-white shadow-[0_2px_12px_rgba(99,102,241,0.5)]'
                              : 'text-[#7A7A85] hover:text-white'
                          }`}
                        >
                          <NavAiIcon active={invokeAiMode} className="w-[18px] h-[18px]" />
                        </button>
                      }
                      customAction={
                        hasText ? (
                          <ChromeArrowButton type="submit" size={38} />
                        ) : invokeAiMode ? (
                          <button
                            type="button"
                            onClick={() => setRecordingVoice(true)}
                            title="تسجيل رسالة صوتية للذكاء الاصطناعي"
                            className="w-[38px] h-[38px] rounded-full bg-gradient-to-br from-[#0EA5E9] via-[#6366F1] to-[#A855F7] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-[0_4px_16px_rgba(99,102,241,0.45)] active:scale-95 transition-transform"
                          >
                            <Mic className="w-[17px] h-[17px]" strokeWidth={2} />
                          </button>
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
                            className="chrome-rim-btn w-[38px] h-[38px] shrink-0 cursor-pointer"
                          >
                            <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                              {mediaBtnMode === 'voice' ? (
                                <Mic className="w-[17px] h-[17px]" strokeWidth={1.9} />
                              ) : (
                                <TelegramVideoNoteIcon className="w-[18px] h-[18px]" />
                              )}
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
      </section>

      {/* Voice / Video Call Overlay */}
      {callOverlay && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between py-14 px-6">
          <div className="text-center space-y-1">
            <div className="text-xl font-semibold text-white">{activeConv.title}</div>
            <div className="text-xs text-[#7A7A85]">جارٍ الاتصال...</div>
          </div>
          {callOverlay === 'video' ? (
            <div className="w-full max-w-[360px] h-[420px] rounded-3xl overflow-hidden border border-white/[0.12] bg-[#131317] flex items-center justify-center">
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
            className="w-full max-w-[380px] rounded-2xl bg-[#131318] border border-white/[0.12] p-5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">محادثة جديدة</span>
              <button type="button" onClick={() => setNewChatOpen(false)} className="text-[#7A7A85] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newChatTitle}
              onChange={e => setNewChatTitle(e.target.value)}
              placeholder="الاسم..."
              className="w-full h-11 rounded-xl bg-[#0A0A0C] border border-white/[0.1] px-3.5 text-xs text-white outline-none"
            />
            <button
              type="button"
              onClick={() => setNewChatAiEnabled(v => !v)}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                newChatAiEnabled
                  ? 'bg-white/[0.08] border-white/25 text-white'
                  : 'bg-[#0A0A0C] border-white/[0.08] text-[#8E8E93]'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>تفعيل LM AI كعضو أساسي يرى المحادثة</span>
              </span>
              <span className={`w-2.5 h-2.5 rounded-full ${newChatAiEnabled ? 'bg-[#22C55E]' : 'bg-[#585860]'}`} />
            </button>
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
