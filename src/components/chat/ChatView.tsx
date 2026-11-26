import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search,
  Plus,
  Phone,
  PhoneCall,
  Mic,
  SmilePlus,
  CornerUpLeft,
  Sparkles,
  X,
  Pin,
  ArrowRight,
  ArrowLeft,
  Languages,
  Check,
  CheckCheck,
  ChevronUp,
  ChevronDown,
  Users,
  ShieldCheck,
  Link2,
  Eraser,
  AlertTriangle,
  Image as ImageIcon,
} from 'lucide-react';

import { ChatMessageItem, ConversationItem, Lang, UserProfile, VoiceCallLogItem } from '../../types';
import { AiSummonBadge, LmBrandMark, MARKDOWN_LINK_COMPONENTS, UserAvatar, RichMessageText } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { TelegramReactionStrip, TelegramReactionPill } from '../shared/TelegramReactions';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { NavAiIcon, TelegramVideoNoteIcon } from '../shared/Icons2026Pro';
import { ActionMenuOrb } from '../shared/ActionOrb2026';
import { CloseOrbButton, PublishActionButton, StudioModalOverlay } from '../shared/ModalChrome2026';
import type { CallLaunchRequest } from '../shared/WebRtcCallModal';
import { SplitComposerOrb } from '../layout/AppShell';
import { useLayout } from '../../context/LayoutContext';
import { MessageListSkeleton } from '../shared/EmptyState2026';
import { api, apiGet, apiPost, apiUploadFile } from '../../lib/api';
import { t } from '../../lib/i18n';

interface ChatViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
  openConvId?: string | null;
  onConsumedOpenConv?: () => void;
  onOpenProfile?: (userId: string) => void;
  onOpenProfileByUsername?: (username: string) => void;
  onOpenHashtag?: (tag: string) => void;
  onStartCall?: (req: CallLaunchRequest) => void;
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

export function ChatView({
  user,
  lang,
  lastWsEvent,
  openConvId,
  onConsumedOpenConv,
  onOpenProfile,
  onOpenProfileByUsername,
  onOpenHashtag,
  onStartCall,
}: ChatViewProps) {
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
  const [folder, setFolder] = useState<'all' | 'personal' | 'groups' | 'channels' | 'calls'>('all');
  const [search, setSearch] = useState('');
  const [callLogs, setCallLogs] = useState<VoiceCallLogItem[]>([]);
  const [copiedCallId, setCopiedCallId] = useState<string | null>(null);

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
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesCacheRef = useRef<Record<string, ChatMessageItem[]>>({});
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

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatDesc, setNewChatDesc] = useState('');
  const [newChatType, setNewChatType] = useState<'dm' | 'group' | 'community'>('dm');
  const [newChatAiEnabled, setNewChatAiEnabled] = useState(false);
  const [newChatMemberIds, setNewChatMemberIds] = useState<string[]>([]);
  const [newChatMemberSearch, setNewChatMemberSearch] = useState('');
  const [dmSearch, setDmSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [aiTypingConvId, setAiTypingConvId] = useState<string | null>(null);
  const [togglingAiMode, setTogglingAiMode] = useState(false);

  // Full-Screen Group / Community Info Page State
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMemberSearch, setInfoMemberSearch] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [editConvTitle, setEditConvTitle] = useState('');
  const [editConvDesc, setEditConvDesc] = useState('');
  const [savingConvInfo, setSavingConvInfo] = useState(false);
  const [uploadingConvAvatar, setUploadingConvAvatar] = useState(false);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(false);
  const [infoFeedback, setInfoFeedback] = useState<string | null>(null);
  const convAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Real Circular Video Note MediaRecorder state
  const [videoNoteError, setVideoNoteError] = useState<string | null>(null);
  const [videoNoteSec, setVideoNoteSec] = useState(0);
  const [uploadingVideoNote, setUploadingVideoNote] = useState(false);
  const noteRecorderRef = useRef<MediaRecorder | null>(null);
  const noteChunksRef = useRef<Blob[]>([]);
  const noteTimerRef = useRef<number | null>(null);
  const noteSendFlagRef = useRef<boolean>(false);

  // Inline Edit Message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');

  // WhatsApp-Style In-Chat Search (Replaces Top Header, Jump-to-Message + Flash Highlight!)
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearchQ, setMsgSearchQ] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const msgNodeMapRef = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimerRef = useRef<number | null>(null);
  const [remoteTypingName, setRemoteTypingName] = useState<string | null>(null);
  const lastTypingSentRef = useRef(0);
  const typingClearTimerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
    const res = await apiGet<{ ok: boolean; conversations: ConversationItem[] }>(`/api/conversations?userId=${user.id}`);
    setConversations(res.conversations);
  }, [user.id]);

  const loadCalls = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; calls: VoiceCallLogItem[] }>(`/api/calls?userId=${user.id}`);
      setCallLogs(res.calls || []);
    } catch {
      // ignore
    }
  }, [user.id]);

  const loadMessages = useCallback(async (convId: string, showLoader = false) => {
    const cached = messagesCacheRef.current[convId];
    if (showLoader && !cached) {
      setMessages([]);
      setLoadingMessages(true);
    } else if (showLoader && cached) {
      setMessages(cached);
    }
    try {
      const res = await apiGet<{ ok: boolean; messages: ChatMessageItem[] }>(`/api/conversations/${convId}/messages`);
      messagesCacheRef.current[convId] = res.messages;
      setMessages(res.messages);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadCalls();
  }, [loadConversations, loadCalls]);

  useEffect(() => {
    if (folder === 'calls') loadCalls();
  }, [folder, loadCalls]);

  useEffect(() => {
    if (openConvId) {
      loadConversations().then(() => {
        setActiveConvId(openConvId);
        setMobileShowList(false);
        onConsumedOpenConv?.();
      });
    }
  }, [openConvId, loadConversations, setActiveConvId, setMobileShowList, onConsumedOpenConv]);

  useEffect(() => {
    if (newChatOpen || infoOpen) {
      apiGet<{ ok: boolean; users: UserProfile[] }>('/api/auth/users')
        .then(r => setAllUsers(r.users))
        .catch(() => {});
    }
  }, [newChatOpen, infoOpen]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId, true);
      setMsgSearchOpen(false);
      setMsgSearchQ('');
      setSearchMatchIdx(0);
    }
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    if (!msgSearchOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activeConvId, aiTypingConvId, msgSearchOpen]);

  useEffect(() => {
    if (lastWsEvent?.event === 'chat:message') {
      const payload = lastWsEvent.payload as { conversationId: string };
      if (payload.conversationId === activeConvId) {
        loadMessages(activeConvId);
        setRemoteTypingName(null);
      }
      loadConversations();
    } else if (lastWsEvent?.event === 'call:updated') {
      loadCalls();
    } else if (lastWsEvent?.event === 'chat:typing') {
      const payload = lastWsEvent.payload as { conversationId?: string; userId?: string; displayName?: string };
      if (payload.conversationId === activeConvId && payload.userId && payload.userId !== user.id) {
        setRemoteTypingName(payload.displayName || 'يكتب الآن');
        if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current);
        typingClearTimerRef.current = window.setTimeout(() => setRemoteTypingName(null), 3200);
      }
    }
  }, [lastWsEvent, activeConvId, user.id, loadMessages, loadConversations, loadCalls]);

  useEffect(() => {
    return () => {
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

  function startVoiceCall() {
    if (!activeConv || !onStartCall) return;
    onStartCall({
      targetUserId: activeConv.peerUserId || null,
      targetName: activeConv.title,
      targetInitials: activeConv.title.slice(0, 2),
      targetAvatarUrl: activeConv.avatarUrl,
      callScope: activeConv.type,
      convId: activeConv.id,
    });
  }

  async function togglePinConversation(convId: string) {
    try {
      const res = await apiPost<{ ok: boolean; isPinned: boolean }>(`/api/conversations/${convId}/pin`, {});
      setConversations(prev =>
        prev
          .map(c => (c.id === convId ? { ...c, isPinned: res.isPinned } : c))
          .sort((a, b) => Number(b.isPinned) - Number(a.isPinned))
      );
    } catch {
      // ignore
    }
  }

  function jumpToMessage(msgId: string) {
    const node = msgNodeMapRef.current[msgId];
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedMsgId(msgId);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMsgId(cur => (cur === msgId ? null : cur));
    }, 2200);
  }

  async function startVideoNoteCapture() {
    setShowQuickRecordHint(false);
    setVideoNoteError(null);
    setVideoNoteSec(0);
    setUploadingVideoNote(false);
    setRecordingVideoNote(true);
    noteChunksRef.current = [];
    noteSendFlagRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setVideoNoteError('المتصفح لا يدعم تسجيل الفيديو من الكاميرا.');
      return;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      });
      noteStreamRef.current = s;
      setTimeout(() => {
        if (noteVideoRef.current) noteVideoRef.current.srcObject = s;
      }, 60);

      const mimeCandidates = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const mimeType = mimeCandidates.find(m => {
        try {
          return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m);
        } catch {
          return false;
        }
      }) || '';
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const rec = mimeType ? new MediaRecorder(s, { mimeType }) : new MediaRecorder(s);

      rec.ondataavailable = ev => {
        if (ev.data && ev.data.size > 0) noteChunksRef.current.push(ev.data);
      };

      rec.onstop = async () => {
        if (noteTimerRef.current) {
          window.clearInterval(noteTimerRef.current);
          noteTimerRef.current = null;
        }
        s.getTracks().forEach(t => t.stop());
        noteStreamRef.current = null;

        if (noteSendFlagRef.current && noteChunksRef.current.length > 0 && activeConvId) {
          setUploadingVideoNote(true);
          try {
            const actualType = mimeType || rec.mimeType || 'video/webm';
            const blob = new Blob(noteChunksRef.current, { type: actualType });
            const file = new File([blob], `videonote-${Date.now()}.${ext}`, { type: actualType });
            const up = await apiUploadFile(file, 'chat_media');
            await apiPost(`/api/conversations/${activeConvId}/messages`, {
              senderId: user.id,
              content: 'رسالة فيديو دائرية',
              msgType: 'video_note',
              mediaUrl: up.url,
            });
            await loadMessages(activeConvId);
            loadConversations();
          } finally {
            setUploadingVideoNote(false);
            setRecordingVideoNote(false);
          }
        } else {
          setRecordingVideoNote(false);
        }
      };

      noteRecorderRef.current = rec;
      rec.start(200);
      noteTimerRef.current = window.setInterval(() => setVideoNoteSec(sec => sec + 1), 1000);
    } catch {
      setVideoNoteError('يرجى السماح بالوصول للكاميرا والميكروفون لتسجيل فيديو دائري.');
    }
  }

  function finishVideoNoteCapture(send: boolean) {
    noteSendFlagRef.current = send;
    if (noteTimerRef.current) {
      window.clearInterval(noteTimerRef.current);
      noteTimerRef.current = null;
    }
    const rec = noteRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      try {
        rec.requestData();
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        if (rec.state !== 'inactive') rec.stop();
      }, 90);
    } else {
      noteStreamRef.current?.getTracks().forEach(t => t.stop());
      noteStreamRef.current = null;
      setRecordingVideoNote(false);
    }
  }

  async function saveEditedMessage(msgId: string) {
    if (!editingMsgText.trim()) return;
    await api(`/api/messages/${msgId}`, {
      method: 'PATCH',
      body: JSON.stringify({ userId: user.id, content: editingMsgText.trim() }),
    });
    setEditingMsgId(null);
    setEditingMsgText('');
    await loadMessages(activeConvId);
    loadConversations();
  }

  async function deleteMessage(msgId: string) {
    await api(`/api/messages/${msgId}?userId=${user.id}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== msgId));
    loadConversations();
  }

  async function startDirectDmWith(targetUser: UserProfile) {
    const res = await apiPost<{ ok: boolean; id: string }>('/api/conversations/dm', {
      userId: user.id,
      targetUserId: targetUser.id,
    });
    setNewChatOpen(false);
    setDmSearch('');
    await loadConversations();
    setActiveConvId(res.id);
    setMobileShowList(false);
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
    if (v.trim()) {
      setShowQuickRecordHint(false);
      const now = Date.now();
      if (activeConvId && now - lastTypingSentRef.current > 2200) {
        lastTypingSentRef.current = now;
        apiPost(`/api/conversations/${activeConvId}/typing`, {
          userId: user.id,
          displayName: user.displayName,
        }).catch(() => {});
      }
    }
  }

  function handleSelectReply(msg: ChatMessageItem) {
    setReplyTarget(msg);
    setSharedForAi(null);
    // Replying directly to LM AI automatically keeps AI mode ON so you converse seamlessly!
    if (msg.senderId === 'lm_ai' || msg.msgType === 'ai_reply') {
      setInvokeAiMode(true);
    }
  }

  async function activatePermanentGroupAi() {
    if (!activeConv || activeConv.type === 'dm' || activeConv.aiEnabled || togglingAiMode) return;
    setTogglingAiMode(true);
    try {
      await apiPost(`/api/conversations/${activeConv.id}/ai-mode`, {
        userId: user.id,
        aiEnabled: true,
      });
      setConversations(prev =>
        prev.map(c => (c.id === activeConv.id ? { ...c, aiEnabled: true } : c))
      );
      setInfoFeedback(lang === 'en' ? 'LM AI is now permanently active!' : 'تم تفعيل LM AI كعضو دائم بنجاح');
      setTimeout(() => setInfoFeedback(null), 3000);
    } catch (err) {
      setInfoFeedback(err instanceof Error ? err.message : 'تعذر التفعيل');
      setTimeout(() => setInfoFeedback(null), 3000);
    } finally {
      setTogglingAiMode(false);
    }
  }

  async function saveConvDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConv || !editConvTitle.trim() || savingConvInfo) return;
    setSavingConvInfo(true);
    try {
      await api(`/api/conversations/${activeConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          userId: user.id,
          title: editConvTitle.trim(),
          description: editConvDesc.trim(),
        }),
      });
      await loadConversations();
      setEditingInfo(false);
      setInfoFeedback(lang === 'en' ? 'Updated successfully' : 'تم حفظ التعديلات');
      setTimeout(() => setInfoFeedback(null), 2500);
    } finally {
      setSavingConvInfo(false);
    }
  }

  async function handleConvAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !activeConv) return;
    setUploadingConvAvatar(true);
    try {
      const up = await apiUploadFile(f, 'avatar');
      await api(`/api/conversations/${activeConv.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ userId: user.id, avatarUrl: up.url }),
      });
      await loadConversations();
    } catch (err) {
      setInfoFeedback(err instanceof Error ? err.message : 'تعذر تحديث الصورة');
      setTimeout(() => setInfoFeedback(null), 3000);
    } finally {
      setUploadingConvAvatar(false);
    }
  }

  async function clearActiveChatMessages() {
    if (!activeConv) return;
    await api(`/api/conversations/${activeConv.id}/messages`, { method: 'DELETE' });
    setMessages([]);
    setConfirmClearChat(false);
    await loadConversations();
    setInfoFeedback(lang === 'en' ? 'Chat history cleared' : 'تم مسح جميع رسائل المحادثة');
    setTimeout(() => setInfoFeedback(null), 2600);
  }

  async function deleteActiveConversation() {
    if (!activeConv) return;
    const deletedId = activeConv.id;
    await api(`/api/conversations/${deletedId}?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
    setConfirmDeleteConv(false);
    setInfoOpen(false);
    const nextList = conversations.filter(c => c.id !== deletedId);
    setConversations(nextList);
    if (nextList[0]) {
      setActiveConvId(nextList[0].id);
    } else {
      setActiveConvId('');
      setMessages([]);
    }
    setMobileShowList(true);
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
    e.target.value = '';
    if (!f || !activeConvId) return;
    try {
      const up = await apiUploadFile(f, 'chat_media');
      const isVideo = up.category === 'video' || f.type.startsWith('video/');
      const isImage = up.category === 'image' || f.type.startsWith('image/');
      const isAudio = up.category === 'audio' || f.type.startsWith('audio/');
      await apiPost(`/api/conversations/${activeConvId}/messages`, {
        senderId: user.id,
        content: isImage ? 'صورة' : isVideo ? 'فيديو' : isAudio ? 'ملف صوتي' : f.name,
        msgType: isImage ? 'image' : isVideo ? 'video_note' : isAudio ? 'audio' : 'file',
        mediaUrl: up.url,
      });
      loadMessages(activeConvId);
    } catch (err) {
      setVideoNoteError(err instanceof Error ? err.message : 'تعذر رفع هذا الملف لأسباب أمنية أو تجاوز الحجم.');
      setTimeout(() => setVideoNoteError(null), 4000);
    }
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
      const up = await apiUploadFile(file, 'voice');
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
    setHoveredMsgId(null);
    // 0ms Instant Optimistic Strictly-Single-Reaction-Per-User Update!
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId) return m;
        const nextRx: Record<string, string[]> = {};
        let alreadyHad = false;
        for (const [k, usersArr] of Object.entries(m.reactions || {})) {
          if (k === reactionKey && usersArr.includes(user.id)) alreadyHad = true;
          const cleaned = usersArr.filter(uid => uid !== user.id);
          if (cleaned.length > 0) nextRx[k] = cleaned;
        }
        if (!alreadyHad) {
          nextRx[reactionKey] = [...(nextRx[reactionKey] || []), user.id];
        }
        return { ...m, reactions: nextRx };
      })
    );
    try {
      const res = await apiPost<{ ok: boolean; reactions?: Record<string, string[]> }>(
        `/api/messages/${msgId}/react`,
        { userId: user.id, emoji: reactionKey }
      );
      if (res.reactions) {
        setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, reactions: res.reactions! } : m)));
        if (activeConvId && messagesCacheRef.current[activeConvId]) {
          messagesCacheRef.current[activeConvId] = messagesCacheRef.current[activeConvId].map(m =>
            m.id === msgId ? { ...m, reactions: res.reactions! } : m
          );
        }
      }
    } catch {
      if (activeConvId) loadMessages(activeConvId);
    }
  }

  async function createConversation(e: React.FormEvent) {
    e.preventDefault();
    if (!newChatTitle.trim()) return;
    const res = await apiPost<{ ok: boolean; id: string }>('/api/conversations', {
      title: newChatTitle.trim(),
      description: newChatDesc.trim() || undefined,
      type: newChatType,
      creatorId: user.id,
      aiEnabled: newChatAiEnabled,
      memberCount: Math.max(2, newChatMemberIds.length + 1),
    });
    setNewChatOpen(false);
    setNewChatTitle('');
    setNewChatDesc('');
    setNewChatMemberIds([]);
    setNewChatMemberSearch('');
    setNewChatAiEnabled(false);
    await loadConversations();
    setActiveConvId(res.id);
    setMobileShowList(false);
  }

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const filteredConvs = conversations
    .filter(c => {
      if (folder !== 'all' && folder !== 'calls' && c.folder !== folder) return false;
      if (search.trim() && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

  const searchMatches = React.useMemo(() => {
    const q = msgSearchQ.trim().toLowerCase();
    if (!q) return [];
    return messages.filter(m =>
      `${m.content || ''} ${m.transcript || ''} ${m.displayName || ''}`.toLowerCase().includes(q)
    );
  }, [messages, msgSearchQ]);

  const BackIcon = lang === 'en' ? ArrowLeft : ArrowRight;

  const hasText = draft.trim().length > 0;

  return (
    <div className="h-full w-full bg-[#0A0A0C] text-[#F2F2F5] flex overflow-hidden">
      {/* Left Conversations List — Floating Borderless Controls (ZERO Outer Container Boxes!) */}
      <aside
        className={`${
          mobileShowList ? 'flex' : 'hidden md:flex'
        } w-full md:w-[310px] lg:w-[340px] shrink-0 flex-col bg-[#0A0A0C] md:border-e md:border-white/[0.06]`}
      >
        <div className="px-3.5 pt-3.5 pb-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 rounded-full bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] focus-within:border-[#34D399]/40 px-3.5 flex items-center gap-2 transition-colors">
              <Search className="w-3.5 h-3.5 text-[#7A7A85]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث في المحادثات...' : 'Search chats...'}
                className="flex-1 bg-transparent text-xs text-white placeholder:text-[#63636C] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              title="محادثة جديدة"
              className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-[#10B981]/20 border border-white/[0.1] hover:border-[#34D399]/45 text-[#E4E4E7] hover:text-[#6EE7B7] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3.5 text-xs border-b border-white/[0.06] overflow-x-auto no-scrollbar">
            {[
              { id: 'all' as const, label: t(lang, 'all') },
              { id: 'personal' as const, label: t(lang, 'chat_personal') },
              { id: 'groups' as const, label: t(lang, 'chat_groups') },
              { id: 'channels' as const, label: t(lang, 'chat_communities') },
              { id: 'calls' as const, label: t(lang, 'chat_calls') },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={`pb-2.5 relative transition-colors cursor-pointer shrink-0 ${
                  folder === f.id ? 'text-white font-semibold' : 'text-[#7A7A85] hover:text-[#D4D4D8]'
                }`}
              >
                <span>{f.label}</span>
                {folder === f.id && (
                  <span className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-gradient-to-r from-[#34D399] to-[#10B981]" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div onScroll={handleConvListScroll} className="flex-1 overflow-y-auto divide-y divide-white/[0.05] pb-20 md:pb-0">
          {folder === 'calls' ? (
            callLogs.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/[0.05] border border-white/[0.1] flex items-center justify-center text-[#8E8E93]">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-white">
                  {lang === 'en' ? 'No voice calls yet' : 'لا توجد مكالمات صوتية بعد'}
                </div>
                <div className="text-[11px] text-[#7A7A85] leading-relaxed">
                  {lang === 'en'
                    ? 'Start a voice call from any chat, group, or community to see it here.'
                    : 'ابدأ مكالمة صوتية من أي محادثة أو مجموعة لتظهر هنا مع رابط الانضمام.'}
                </div>
              </div>
            ) : (
              callLogs.map(call => {
                const isActive = call.status === 'active';
                return (
                  <div
                    key={call.id}
                    className="px-3.5 py-3 flex items-center gap-3 hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar initials={call.hostInitials} avatarUrl={call.hostAvatarUrl} size={42} />
                      {isActive && (
                        <span className="absolute -bottom-0.5 -end-0.5 w-3.5 h-3.5 rounded-full bg-[#34D399] border-2 border-[#0A0A0C] animate-pulse" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-start">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-white truncate">{call.title}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#10B981]/20 text-[#6EE7B7] text-[9.5px] font-bold shrink-0">
                            {t(lang, 'active_call')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8E8E93] flex items-center gap-1.5 truncate mt-0.5">
                        <span>{call.hostName}</span>
                        <span>·</span>
                        <span className="font-mono-num">{call.createdAt}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(`${window.location.origin}/call/${call.roomCode}`);
                              setCopiedCallId(call.id);
                              setTimeout(() => setCopiedCallId(cur => (cur === call.id ? null : cur)), 1800);
                            }}
                            title={t(lang, 'copy_call_link')}
                            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer"
                          >
                            {copiedCallId === call.id ? (
                              <Check className="w-3.5 h-3.5 text-[#34D399]" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onStartCall?.({
                                targetName: call.title,
                                targetInitials: call.hostInitials,
                                targetAvatarUrl: call.hostAvatarUrl,
                                joinRoomCode: call.roomCode,
                              })
                            }
                            className="px-3 py-1.5 rounded-full bg-[#34D399] text-black text-[11px] font-bold cursor-pointer hover:opacity-90"
                          >
                            {lang === 'en' ? 'Join' : 'انضمام'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onStartCall?.({
                              targetUserId: call.peerId || (call.hostId !== user.id ? call.hostId : null),
                              targetName: call.title,
                              targetInitials: call.hostInitials,
                              targetAvatarUrl: call.hostAvatarUrl,
                              callScope: call.callScope,
                              convId: call.convId || undefined,
                            })
                          }
                          title={t(lang, 'voice_call')}
                          className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-[#10B981]/20 text-[#D4D4D8] hover:text-[#6EE7B7] flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            filteredConvs.map(conv => {
              const active = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConvId(conv.id);
                    setMobileShowList(false);
                  }}
                  className={`group w-full px-3.5 py-3 flex items-center gap-3 text-start transition-colors cursor-pointer ${
                    active ? 'bg-white/[0.05]' : 'hover:bg-white/[0.025]'
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[13.5px] font-semibold text-[#F2F2F5] truncate">{conv.title}</span>
                        {conv.isPinned && <Pin className="w-3 h-3 text-[#34D399] shrink-0" />}
                      </div>
                      <span className="text-[10.5px] text-[#7A7A85] font-mono-num shrink-0">{conv.lastMessageAt}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="text-xs text-[#8E8E93] truncate">{conv.lastMessage || conv.description}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            togglePinConversation(conv.id);
                          }}
                          title={conv.isPinned ? t(lang, 'unpin_chat') : t(lang, 'pin_chat')}
                          className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                            conv.isPinned
                              ? 'text-[#34D399] bg-[#10B981]/14 opacity-100'
                              : 'text-[#7A7A85] hover:text-white hover:bg-white/[0.08] opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-gradient-to-tr from-[#10B981] to-[#34D399] text-black text-[10px] font-mono-num font-bold flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Active Conversation Stage */}
      <section className={`${mobileShowList ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#0A0A0C] min-w-0 relative`}>
        {/* FLOATING HEADER — Replaced cleanly by WhatsApp-Style Search Bar (Back Arrow, NO X, Jump-to-Message!) */}
        {activeConv && (
          msgSearchOpen ? (
            <header
              onClick={e => e.stopPropagation()}
              className="absolute top-3 inset-x-3.5 md:inset-x-5 z-30 flex flex-col items-center gap-2"
            >
              <div className="w-full max-w-[680px] h-11 rounded-full bg-[#13131A]/96 backdrop-blur-2xl border border-[#34D399]/35 px-2 flex items-center gap-2 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setMsgSearchOpen(false);
                    setMsgSearchQ('');
                    setSearchMatchIdx(0);
                  }}
                  title={t(lang, 'back')}
                  className="w-8 h-8 rounded-full hover:bg-white/[0.1] text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <BackIcon className="w-4 h-4" />
                </button>
                <input
                  autoFocus
                  value={msgSearchQ}
                  onChange={e => {
                    setMsgSearchQ(e.target.value);
                    setSearchMatchIdx(0);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchMatches.length > 0) {
                      e.preventDefault();
                      const nextIdx = (searchMatchIdx + 1) % searchMatches.length;
                      setSearchMatchIdx(nextIdx);
                      jumpToMessage(searchMatches[nextIdx].id);
                    }
                  }}
                  placeholder={lang === 'en' ? 'Search messages in this chat...' : 'ابحث داخل رسائل هذه المحادثة...'}
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-[#63636C] outline-none"
                />
                {msgSearchQ.trim() && (
                  <div className="flex items-center gap-1 shrink-0 pe-1">
                    <span className="text-[11px] font-mono-num text-[#6EE7B7] px-1">
                      {searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0'}
                    </span>
                    <button
                      type="button"
                      disabled={searchMatches.length === 0}
                      onClick={() => {
                        if (searchMatches.length === 0) return;
                        const prev = (searchMatchIdx - 1 + searchMatches.length) % searchMatches.length;
                        setSearchMatchIdx(prev);
                        jumpToMessage(searchMatches[prev].id);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.1] text-white disabled:opacity-35 flex items-center justify-center cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={searchMatches.length === 0}
                      onClick={() => {
                        if (searchMatches.length === 0) return;
                        const next = (searchMatchIdx + 1) % searchMatches.length;
                        setSearchMatchIdx(next);
                        jumpToMessage(searchMatches[next].id);
                      }}
                      className="w-7 h-7 rounded-full hover:bg-white/[0.1] text-white disabled:opacity-35 flex items-center justify-center cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Clickable WhatsApp-Style Search Matches Dropdown */}
              {msgSearchQ.trim() && (
                <div className="w-full max-w-[680px] max-h-[240px] overflow-y-auto rounded-2xl bg-[#13131A]/97 backdrop-blur-2xl border border-white/[0.12] shadow-2xl divide-y divide-white/[0.06]">
                  {searchMatches.length === 0 ? (
                    <div className="py-5 text-center text-xs text-[#8E8E93]">
                      {lang === 'en' ? 'No matching messages' : 'لا توجد رسائل مطابقة للبحث'}
                    </div>
                  ) : (
                    searchMatches.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSearchMatchIdx(idx);
                          jumpToMessage(m.id);
                        }}
                        className={`w-full px-3.5 py-2.5 text-start flex items-center justify-between gap-3 hover:bg-white/[0.06] cursor-pointer transition-colors ${
                          idx === searchMatchIdx ? 'bg-[#10B981]/12' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-semibold text-[#34D399] truncate">{m.displayName}</div>
                          <div className="text-xs text-white/90 truncate">{m.transcript || m.content}</div>
                        </div>
                        <span className="text-[10px] font-mono-num text-[#7A7A85] shrink-0">{m.createdAt}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </header>
          ) : (
            <header className="pointer-events-none absolute top-3 inset-x-3.5 md:inset-x-5 z-20 flex items-center justify-between gap-2">
              <div className="pointer-events-auto flex items-center gap-2.5 ps-1.5 pe-3.5 py-1.5 rounded-full bg-[#131318]/80 backdrop-blur-xl border border-white/[0.1] min-w-0 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMobileShowList(true);
                    setMobileNavExpanded(false);
                  }}
                  className="md:hidden w-7 h-7 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white cursor-pointer shrink-0"
                >
                  <BackIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (activeConv.type !== 'dm') {
                      setEditConvTitle(activeConv.title);
                      setEditConvDesc(activeConv.description || '');
                      setEditingInfo(false);
                      setConfirmClearChat(false);
                      setConfirmDeleteConv(false);
                      setInfoOpen(true);
                    } else if (activeConv.peerUserId && onOpenProfile) {
                      onOpenProfile(activeConv.peerUserId);
                    }
                  }}
                  className="flex items-center gap-2.5 min-w-0 text-start cursor-pointer group"
                >
                  <UserAvatar
                    initials={activeConv.title.slice(0, 2)}
                    avatarUrl={activeConv.avatarUrl}
                    size={34}
                    online={activeConv.onlineText.includes('متصل')}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white group-hover:underline truncate max-w-[175px] sm:max-w-[260px] flex items-center gap-1.5">
                      <span className="truncate">{activeConv.title}</span>
                      {activeConv.type !== 'dm' && activeConv.aiEnabled && (
                        <Sparkles className="w-3 h-3 text-[#34D399] shrink-0" />
                      )}
                    </div>
                    <div className={`text-[10.5px] truncate ${remoteTypingName ? 'text-[#34D399] font-medium' : 'text-[#9E9EA8]'}`}>
                      {remoteTypingName
                        ? `${remoteTypingName} ${lang === 'en' ? 'is typing...' : 'يكتب الآن...'}`
                        : activeConv.type !== 'dm'
                          ? lang === 'en'
                            ? `${activeConv.memberCount} members · Tap for info`
                            : `${activeConv.memberCount} عضو · اضغط للتفاصيل`
                          : activeConv.onlineText}
                    </div>
                  </div>
                </button>
              </div>

              {/* Clean Header Controls: In-Chat Search + Voice Call ONLY (ZERO Video Call & ZERO Top AI Toggle!) */}
              <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-full bg-[#131318]/80 backdrop-blur-xl border border-white/[0.1] shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMsgSearchOpen(true);
                    setMsgSearchQ('');
                    setSearchMatchIdx(0);
                  }}
                  title={lang === 'en' ? 'Search in chat' : 'بحث داخل المحادثة'}
                  className="w-8 h-8 rounded-full hover:bg-white/[0.09] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Search className="w-4 h-4" strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={startVoiceCall}
                  title={t(lang, 'voice_call')}
                  className="w-8 h-8 rounded-full hover:bg-[#10B981]/20 text-[#D4D4D8] hover:text-[#6EE7B7] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Phone className="w-4 h-4" strokeWidth={1.8} />
                </button>
              </div>
            </header>
          )
        )}

        {/* Open Message Stream (Tap empty space closes search, translation, menus, & mobile bottom dock!) */}
        <div
          onClick={() => {
            setOpenPickerMsgId(null);
            setTranslateMenuMsgId(null);
            setTranslations({});
            setShowQuickRecordHint(false);
            setComposerFocused(false);
            setMobileNavExpanded(false);
            if (msgSearchOpen) {
              setMsgSearchOpen(false);
              setMsgSearchQ('');
            }
          }}
          className="flex-1 overflow-y-auto px-4 pt-20 pb-28 space-y-3 bg-[#0A0A0C]"
        >
          {activeConv?.pinnedMessage && (
            <div className="mx-auto w-fit max-w-full px-3.5 py-1.5 rounded-full bg-[#131318]/80 border border-white/[0.08] flex items-center gap-2 text-[11.5px] text-[#A1A1AA] mb-2">
              <Pin className="w-3 h-3 text-[#7A7A85] shrink-0" />
              <span className="truncate">{activeConv.pinnedMessage}</span>
            </div>
          )}

          {/* Loading Skeleton While Fetching Messages (NEVER flashes Empty Welcome while loading!) */}
          {loadingMessages && <MessageListSkeleton />}

          {/* Sculpted Empty-Chat Welcome State */}
          {!loadingMessages && messages.length === 0 && (
            <div className="h-full min-h-[340px] flex flex-col items-center justify-center text-center px-6 py-10 space-y-4">
              <div className="relative flex items-center justify-center">
                {activeConv ? (
                  <div className="relative">
                    <UserAvatar initials={activeConv.title.slice(0, 2)} avatarUrl={activeConv.avatarUrl} size={76} />
                    <span className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-[#0A0A0C] border border-white/15 flex items-center justify-center">
                      <LmBrandMark size={16} />
                    </span>
                  </div>
                ) : (
                  <LmBrandMark size={52} />
                )}
              </div>
              <div className="space-y-1 max-w-[300px]">
                <h3 className="text-base font-bold text-white">
                  {activeConv
                    ? lang === 'en'
                      ? `Start chatting now with ${activeConv.title}`
                      : `ابدأ المحادثة الآن مع ${activeConv.title}`
                    : t(lang, 'start_chat_now')}
                </h3>
                <p className="text-xs text-[#8E8E93] leading-relaxed">
                  {activeConv
                    ? lang === 'en'
                      ? 'Send a text, voice note, circular video, or start a voice call directly on LM.'
                      : 'أرسل رسالة نصية أو صوتية أو فيديو دائري أو ابدأ مكالمة صوتية مباشرة على LM.'
                    : t(lang, 'select_chat_hint')}
                </p>
              </div>
              {activeConv && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleDraftChange(lang === 'en' ? 'Hello! 👋' : 'مرحبًا، كيف حالك؟');
                  }}
                  className="px-4 py-2 rounded-full bg-white/[0.07] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-medium text-white cursor-pointer transition-colors"
                >
                  {lang === 'en' ? 'Say Hello' : 'ابدأ بالتحية'}
                </button>
              )}
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

            const isHighlighted = highlightedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                ref={el => {
                  msgNodeMapRef.current[msg.id] = el;
                }}
                data-msg-id={msg.id}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                className={`flex flex-col rounded-2xl transition-all duration-300 ${
                  isMine ? 'items-end' : 'items-start'
                } ${isHighlighted ? 'bg-[#34D399]/16 ring-1 ring-[#34D399]/50 p-1.5 -mx-1.5' : ''}`}
              >
                <div
                  className={`relative w-full flex items-end gap-2 ${
                    isMine ? 'flex-row-reverse justify-start' : 'flex-row justify-start'
                  }`}
                >
                  {!isMine && (
                    isAi ? (
                      <UserAvatar initials={msg.avatarInitials} avatarUrl={msg.avatarUrl} size={28} />
                    ) : (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onOpenProfile?.(msg.senderId);
                        }}
                        className="shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                      >
                        <UserAvatar initials={msg.avatarInitials} avatarUrl={msg.avatarUrl} size={28} />
                      </button>
                    )
                  )}

                  {/* Full Natural Telegram/WhatsApp Horizontal Bubble Width (NEVER crushed by invisible side buttons!) */}
                  <div className="relative max-w-[82%] sm:max-w-[70%] min-w-0">
                    {/* Mobile Floating Action Bar Above/Below Tapped Bubble (Takes 0px horizontal layout space!) */}
                    {showHoverActions && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className={`md:hidden absolute ${popoverPosClass} ${isMine ? 'end-0' : 'start-0'} z-20 flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-[#16161E]/95 backdrop-blur-xl border border-white/[0.14] shadow-2xl`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setTranslateMenuMsgId(null);
                            setOpenPickerMsgId(openPickerMsgId === msg.id ? null : msg.id);
                          }}
                          className="w-7 h-7 rounded-full hover:bg-white/[0.1] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
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
                            className="w-7 h-7 rounded-full hover:bg-white/[0.1] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
                          >
                            <Languages className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setHoveredMsgId(null);
                            handleSelectReply(msg);
                          }}
                          className="w-7 h-7 rounded-full hover:bg-white/[0.1] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHoveredMsgId(null);
                            setReplyTarget(msg);
                            setSharedForAi(msg);
                            setInvokeAiMode(true);
                          }}
                          className="w-7 h-7 rounded-full hover:bg-white/[0.1] text-[#D4D4D8] hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        {isMine && (
                          <ActionMenuOrb
                            compact
                            align={isMine ? 'start' : 'end'}
                            direction={openPopoverDownward ? 'down' : 'up'}
                            editLabel="تعديل الرسالة"
                            removeLabel="إزالة الرسالة"
                            onEdit={
                              msg.msgType === 'text'
                                ? () => {
                                    setHoveredMsgId(null);
                                    setEditingMsgId(msg.id);
                                    setEditingMsgText(msg.content);
                                  }
                                : undefined
                            }
                            onRemove={() => deleteMessage(msg.id)}
                          />
                        )}
                      </div>
                    )}
                    {/* 2026 Custom Vector Reaction Picker (Auto-Flips Downward for Top Messages!) */}
                    {openPickerMsgId === msg.id && (
                      <div className={`absolute ${popoverPosClass} z-30 ${isMine ? 'end-0' : 'start-0'}`}>
                        <TelegramReactionStrip onSelect={rId => toggleReaction(msg.id, rId)} lang={lang} />
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
                        onClick={e => {
                          e.stopPropagation();
                          setHoveredMsgId(cur => (cur === msg.id ? null : msg.id));
                        }}
                        className={`px-3.5 py-2.5 text-[14px] leading-relaxed break-words ${
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

                        {!isMine && !isAi && activeConv?.type !== 'dm' && (
                          <button
                            type="button"
                            onClick={() => onOpenProfile?.(msg.senderId)}
                            className="mb-1 block text-[11px] font-semibold text-[#34D399] hover:underline cursor-pointer"
                          >
                            {msg.displayName}
                          </button>
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
                        ) : editingMsgId === msg.id ? (
                          <div className="space-y-2 min-w-[220px]">
                            <textarea
                              rows={2}
                              value={editingMsgText}
                              onChange={e => setEditingMsgText(e.target.value)}
                              className="w-full rounded-xl bg-[#0A0A0C] border border-white/[0.15] p-2 text-xs text-white outline-none resize-none"
                            />
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingMsgId(null)}
                                className="px-2.5 py-1 rounded-full bg-white/[0.08] text-[11px] text-[#A1A1AA] hover:text-white cursor-pointer"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditedMessage(msg.id)}
                                className="px-2.5 py-1 rounded-full bg-white text-black text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>حفظ</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {isAi && !translated ? (
                              <div className="prose-sm space-y-1.5 text-[#F2F2F5] leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_LINK_COMPONENTS}>
                                  {msg.content}
                                </ReactMarkdown>
                              </div>
                            ) : (
                              <RichMessageText
                                text={translated ? translated.text : msg.content}
                                maxChars={380}
                                lang={lang}
                                onMentionClick={onOpenProfileByUsername}
                                onHashtagClick={onOpenHashtag}
                              />
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

                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] font-mono-num text-[#7A7A85]">
                          {msg.isEdited && <span>معدّلة ·</span>}
                          <span>{msg.createdAt}</span>
                          {isMine && <CheckCheck className="w-3.5 h-3.5 text-[#34D399]" strokeWidth={2.2} />}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Desktop-Only Side Hover Controls (Hidden on mobile so bubble keeps full 82% horizontal width!) */}
                  <div
                    onClick={e => e.stopPropagation()}
                    className={`hidden md:flex items-center gap-0.5 shrink-0 transition-opacity focus-within:opacity-100 focus-within:pointer-events-auto ${
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

                    {isMine && (
                      <ActionMenuOrb
                        compact
                        align={isMine ? 'start' : 'end'}
                        direction={openPopoverDownward ? 'down' : 'up'}
                        editLabel="تعديل الرسالة"
                        removeLabel="إزالة الرسالة"
                        onEdit={
                          msg.msgType === 'text'
                            ? () => {
                                setEditingMsgId(msg.id);
                                setEditingMsgText(msg.content);
                              }
                            : undefined
                        }
                        onRemove={() => deleteMessage(msg.id)}
                      />
                    )}
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

        {/* Circular Video Note REAL MediaRecorder Live Capture Overlay */}
        {recordingVideoNote && (
          <div className="absolute inset-0 z-30 bg-black/88 backdrop-blur-md flex flex-col items-center justify-center gap-5 p-4">
            <div className="relative w-60 h-60 rounded-full overflow-hidden border-2 border-white/30 bg-[#131317] flex items-center justify-center shadow-2xl">
              {videoNoteError ? (
                <div className="px-6 text-center text-xs text-[#F87171] leading-relaxed">{videoNoteError}</div>
              ) : (
                <video ref={noteVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              )}
              {!videoNoteError && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/75 border border-white/15 flex items-center gap-1.5 text-xs font-mono-num text-white">
                  <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
                  <span>{`${Math.floor(videoNoteSec / 60)}:${String(videoNoteSec % 60).padStart(2, '0')}`}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={uploadingVideoNote}
                onClick={() => finishVideoNoteCapture(false)}
                className="px-5 py-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-xs text-white cursor-pointer"
              >
                إلغاء
              </button>
              {!videoNoteError && (
                <button
                  type="button"
                  disabled={uploadingVideoNote}
                  onClick={() => finishVideoNoteCapture(true)}
                  className="px-6 py-2 rounded-full bg-white text-black text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {uploadingVideoNote ? 'جارٍ الإرسال...' : 'إرسال الفيديو'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* FLOATING AUTO-EXPANDING COMPOSER + SPLIT ORB (Lifts ONLY composer above mobile keyboard!) */}
        {!mobileNavExpanded && (
          <div
            style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom) + 10px) + var(--lm-kb-offset, 0px))' }}
            className="pointer-events-none absolute inset-x-3.5 md:inset-x-6 z-20 flex flex-col items-center transition-[bottom] duration-150"
          >
            <div className="pointer-events-auto w-full max-w-[780px] flex flex-col gap-2">
              {/* Compact Side-Aligned Reply / AI Context Card (Never oversized or paper-thin!) */}
              {(replyTarget || sharedForAi) && (
                <div className="w-fit max-w-[300px] sm:max-w-[340px] self-start rounded-2xl bg-[#15151C]/96 backdrop-blur-xl border border-white/[0.12] px-3 py-2 flex items-center gap-2.5 shadow-xl">
                  <span className="w-[2.5px] self-stretch rounded-full shrink-0 bg-white/55" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white flex items-center gap-1 truncate">
                      {sharedForAi ? (
                        <>
                          <Sparkles className="w-3 h-3 text-[#D4D4D8] shrink-0" />
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

              {videoNoteError && !recordingVideoNote && (
                <div className="px-3.5 py-2 rounded-2xl bg-[#EF4444]/15 border border-[#FB7185]/35 text-xs text-[#FDA4AF] flex items-center justify-between gap-2">
                  <span>{videoNoteError}</span>
                  <CloseOrbButton size="xs" onClick={() => setVideoNoteError(null)} />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,application/pdf"
                onChange={handleAttachFile}
                className="hidden"
              />

              <div className="flex items-end gap-2">
                {/* Split Orb: Expands upward into "إرفاق ملف" + "الشريط السفلي"! */}
                <SplitComposerOrb onAttach={() => fileInputRef.current?.click()} showNavOption />

                <div className="flex-1 min-w-0">
                  {recordingVoice ? (
                    <LiveVoiceRecorder
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
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            invokeAiMode
                              ? 'bg-white/[0.15] text-white border border-white/25'
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
                            title="تسجيل رسالة صوتية"
                            className="chrome-rim-btn w-[38px] h-[38px] shrink-0 cursor-pointer"
                          >
                            <span className="chrome-rim-btn-inner text-[#D4D4D8] hover:text-white transition-colors">
                              <Mic className="w-[17px] h-[17px]" strokeWidth={1.9} />
                            </span>
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

      {/* 2026 Upgraded New Chat Modal: 1-on-1 DM Search + Group (up to 1,000) + Community (up to 100,000) */}
      {newChatOpen && (
        <StudioModalOverlay onClose={() => setNewChatOpen(false)}>
          <div className="p-5 space-y-3.5 max-h-[86vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <span className="text-sm font-bold text-white">{t(lang, 'new_chat')}</span>
              <CloseOrbButton onClick={() => setNewChatOpen(false)} />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              {[
                { id: 'dm' as const, label: lang === 'en' ? 'Direct Chat' : 'محادثة فردية' },
                { id: 'group' as const, label: lang === 'en' ? 'Group' : 'مجموعة' },
                { id: 'community' as const, label: lang === 'en' ? 'Community' : 'مجتمع' },
              ].map(tabItem => (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setNewChatType(tabItem.id)}
                  className={`flex-1 py-2 rounded-full border cursor-pointer transition-colors ${
                    newChatType === tabItem.id
                      ? 'bg-white text-black border-white font-semibold'
                      : 'border-white/[0.1] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>

            {newChatType === 'dm' ? (
              <div className="space-y-2.5">
                <div className="h-10 rounded-full bg-[#0A0A0C] border border-white/[0.1] px-3.5 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-[#7A7A85]" />
                  <input
                    autoFocus
                    value={dmSearch}
                    onChange={e => setDmSearch(e.target.value)}
                    placeholder={lang === 'en' ? 'Search by name or @username...' : 'ابحث بالاسم أو @اسم_المستخدم...'}
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-[#585860] outline-none"
                  />
                </div>

                <div className="max-h-[260px] overflow-y-auto divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-[#0B0B0F]">
                  {allUsers
                    .filter(u => u.id !== user.id)
                    .filter(
                      u =>
                        !dmSearch.trim() ||
                        u.displayName.toLowerCase().includes(dmSearch.toLowerCase()) ||
                        u.username.toLowerCase().includes(dmSearch.toLowerCase())
                    )
                    .map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => startDirectDmWith(u)}
                        className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/[0.05] text-start cursor-pointer transition-colors"
                      >
                        <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-white truncate">{u.displayName}</div>
                          <div className="text-[11px] text-[#7A7A85] font-mono-num truncate">@{u.username}</div>
                        </div>
                        <span className="text-[11px] text-[#34D399] font-medium">{t(lang, 'message')}</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <form onSubmit={createConversation} className="space-y-3">
                {/* Capacity Indicator */}
                <div className="px-3.5 py-2 rounded-2xl bg-[#10B981]/10 border border-[#34D399]/25 flex items-center justify-between text-[11px]">
                  <span className="text-[#6EE7B7] font-semibold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {newChatType === 'community'
                        ? lang === 'en'
                          ? 'Community Capacity'
                          : 'سعة المجتمع'
                        : lang === 'en'
                          ? 'Group Capacity'
                          : 'سعة المجموعة'}
                    </span>
                  </span>
                  <span className="font-mono-num font-bold text-white">
                    {newChatType === 'community'
                      ? lang === 'en'
                        ? 'Up to 100,000 members'
                        : 'حتى 100,000 عضو'
                      : lang === 'en'
                        ? 'Up to 1,000 members'
                        : 'حتى 1,000 عضو'}
                  </span>
                </div>

                <input
                  value={newChatTitle}
                  onChange={e => setNewChatTitle(e.target.value)}
                  placeholder={
                    newChatType === 'group'
                      ? lang === 'en'
                        ? 'Group name...'
                        : 'اسم المجموعة...'
                      : lang === 'en'
                        ? 'Community name...'
                        : 'اسم المجتمع...'
                  }
                  className="w-full h-11 rounded-2xl bg-[#0A0A0C] border border-white/[0.1] px-3.5 text-xs text-white outline-none focus:border-[#34D399]/50"
                />

                <input
                  value={newChatDesc}
                  onChange={e => setNewChatDesc(e.target.value)}
                  placeholder={lang === 'en' ? 'Short description (optional)...' : 'وصف مختصر (اختياري)...'}
                  className="w-full h-10 rounded-2xl bg-[#0A0A0C] border border-white/[0.1] px-3.5 text-xs text-white outline-none focus:border-[#34D399]/50"
                />

                {/* Searchable Initial Members Picker */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] px-1">
                    <span>{lang === 'en' ? 'Add initial members' : 'إضافة أعضاء (اختياري)'}</span>
                    <span className="font-mono-num text-[#34D399]">{newChatMemberIds.length}</span>
                  </div>
                  <div className="h-9 rounded-full bg-[#0A0A0C] border border-white/[0.09] px-3 flex items-center gap-2">
                    <Search className="w-3 h-3 text-[#7A7A85]" />
                    <input
                      value={newChatMemberSearch}
                      onChange={e => setNewChatMemberSearch(e.target.value)}
                      placeholder={lang === 'en' ? 'Filter people...' : 'ابحث عن أعضاء...'}
                      className="flex-1 bg-transparent text-[11.5px] text-white placeholder:text-[#585860] outline-none"
                    />
                  </div>
                  <div className="max-h-[130px] overflow-y-auto divide-y divide-white/[0.05] rounded-2xl border border-white/[0.07] bg-[#0B0B0F]">
                    {allUsers
                      .filter(u => u.id !== user.id)
                      .filter(
                        u =>
                          !newChatMemberSearch.trim() ||
                          u.displayName.toLowerCase().includes(newChatMemberSearch.toLowerCase()) ||
                          u.username.toLowerCase().includes(newChatMemberSearch.toLowerCase())
                      )
                      .map(u => {
                        const selected = newChatMemberIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() =>
                              setNewChatMemberIds(prev =>
                                prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              )
                            }
                            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-white/[0.05] text-start cursor-pointer"
                          >
                            <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={28} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11.5px] font-semibold text-white truncate">{u.displayName}</div>
                              <div className="text-[10px] text-[#7A7A85] font-mono-num truncate">@{u.username}</div>
                            </div>
                            <span
                              className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center ${
                                selected ? 'bg-[#34D399] border-[#34D399] text-black' : 'border-white/25'
                              }`}
                            >
                              {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setNewChatAiEnabled(v => !v)}
                  className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-colors text-start gap-2 ${
                    newChatAiEnabled
                      ? 'bg-white/[0.08] border-white/25 text-white'
                      : 'bg-[#0A0A0C] border-white/[0.08] text-[#8E8E93]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>{t(lang, 'ai_permanent_member')}</span>
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${newChatAiEnabled ? 'bg-[#34D399]' : 'bg-[#585860]'}`} />
                </button>

                <div className="flex justify-end pt-1">
                  <PublishActionButton
                    type="submit"
                    variant="luminous"
                    disabled={!newChatTitle.trim()}
                    label={
                      newChatType === 'group'
                        ? lang === 'en'
                          ? 'Create Group'
                          : 'إنشاء المجموعة'
                        : lang === 'en'
                          ? 'Create Community'
                          : 'إنشاء المجتمع'
                    }
                  />
                </div>
              </form>
            )}
          </div>
        </StudioModalOverlay>
      )}

      {/* FULL-SCREEN 2026 GROUP / COMMUNITY INFO PAGE */}
      {infoOpen && activeConv && (
        <div className="fixed inset-0 z-[72] bg-[#08080B] text-white flex flex-col overflow-hidden">
          <input
            ref={convAvatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleConvAvatarUpload}
            className="hidden"
          />

          {/* Top Bar with Sculpted Back Arrow */}
          <div className="px-4 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-[660px] w-full mx-auto">
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="w-10 h-10 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <BackIcon className="w-5 h-5" />
            </button>
            <div className="text-sm font-bold text-white">
              {activeConv.type === 'community' ? t(lang, 'community_info') : t(lang, 'group_info')}
            </div>
            <button
              type="button"
              onClick={() => togglePinConversation(activeConv.id)}
              title={activeConv.isPinned ? t(lang, 'unpin_chat') : t(lang, 'pin_chat')}
              className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                activeConv.isPinned
                  ? 'bg-[#10B981]/20 text-[#34D399]'
                  : 'bg-white/[0.07] hover:bg-white/[0.14] text-white'
              }`}
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6 max-w-[660px] w-full mx-auto space-y-6 pb-20">
            {infoFeedback && (
              <div className="px-4 py-2.5 rounded-2xl bg-[#10B981]/15 border border-[#34D399]/35 text-xs text-[#6EE7B7] text-center">
                {infoFeedback}
              </div>
            )}

            {/* Group Identity Hero */}
            <div className="flex flex-col items-center text-center gap-3">
              <div className="relative">
                <UserAvatar initials={activeConv.title.slice(0, 2)} avatarUrl={activeConv.avatarUrl} size={92} />
                {activeConv.creatorId === user.id && (
                  <button
                    type="button"
                    disabled={uploadingConvAvatar}
                    onClick={() => convAvatarInputRef.current?.click()}
                    title={lang === 'en' ? 'Change photo' : 'تغيير الصورة'}
                    className="absolute -bottom-1 -end-1 w-9 h-9 rounded-full bg-[#15151C] border border-white/20 text-white hover:bg-white hover:text-black flex items-center justify-center cursor-pointer transition-colors shadow-xl"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                )}
              </div>

              {editingInfo ? (
                <form onSubmit={saveConvDetails} className="w-full max-w-[420px] space-y-2.5 text-start">
                  <input
                    value={editConvTitle}
                    onChange={e => setEditConvTitle(e.target.value)}
                    className="w-full h-11 rounded-2xl bg-[#121218] border border-white/[0.15] px-4 text-sm text-white outline-none"
                  />
                  <textarea
                    rows={2}
                    value={editConvDesc}
                    onChange={e => setEditConvDesc(e.target.value)}
                    placeholder={lang === 'en' ? 'Description...' : 'الوصف...'}
                    className="w-full rounded-2xl bg-[#121218] border border-white/[0.15] p-3 text-xs text-white outline-none resize-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingInfo(false)}
                      className="px-3.5 py-1.5 rounded-full bg-white/[0.08] text-xs text-[#C4C4CC] cursor-pointer"
                    >
                      {t(lang, 'cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={savingConvInfo || !editConvTitle.trim()}
                      className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {t(lang, 'save')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1.5">
                  <h2 className="text-xl font-bold text-white">{activeConv.title}</h2>
                  {activeConv.description && (
                    <p className="text-xs text-[#A1A1AA] max-w-[420px] leading-relaxed">{activeConv.description}</p>
                  )}
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <span className="px-3 py-1 rounded-full bg-white/[0.06] border border-white/[0.1] text-[11px] font-mono-num text-[#D4D4D8] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#34D399]" />
                      <span>
                        {activeConv.memberCount.toLocaleString()} /{' '}
                        {(activeConv.maxMembers || (activeConv.type === 'community' ? 100000 : 1000)).toLocaleString()}{' '}
                        {lang === 'en' ? 'max' : 'عضو'}
                      </span>
                    </span>
                    {activeConv.creatorId === user.id && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditConvTitle(activeConv.title);
                          setEditConvDesc(activeConv.description || '');
                          setEditingInfo(true);
                        }}
                        className="px-3 py-1 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-[11px] font-medium text-white cursor-pointer transition-colors"
                      >
                        {t(lang, 'edit')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Group Voice Call Trigger */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setInfoOpen(false);
                    startVoiceCall();
                  }}
                  className="h-10 px-5 rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] text-black text-xs font-bold flex items-center gap-2 cursor-pointer hover:opacity-95"
                >
                  <Phone className="w-4 h-4" />
                  <span>{lang === 'en' ? 'Start Group Voice Call' : 'بدء مكالمة صوتية جماعية'}</span>
                </button>
              </div>
            </div>

            {/* ONE-TIME PERMANENT LM AI MEMBER ACTIVATION (Owner-Only Inside Group Info!) */}
            {activeConv.type !== 'dm' && (
              <div className="p-4 rounded-2xl bg-[#111117] border border-white/[0.1] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#34D399]" />
                    <span className="text-xs font-bold text-white">LM AI</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                      activeConv.aiEnabled
                        ? 'bg-[#10B981]/20 text-[#6EE7B7]'
                        : 'bg-white/[0.07] text-[#8E8E93]'
                    }`}
                  >
                    {activeConv.aiEnabled
                      ? lang === 'en'
                        ? 'Active Permanently'
                        : 'مفعّل بشكل دائم'
                      : lang === 'en'
                        ? 'Not Activated'
                        : 'غير مفعّل'}
                  </span>
                </div>

                {activeConv.aiEnabled ? (
                  <p className="text-xs text-[#A1A1AA] leading-relaxed flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#34D399] shrink-0" />
                    <span>{t(lang, 'ai_already_active')}</span>
                  </p>
                ) : activeConv.creatorId === user.id ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-[#9E9EA8] leading-relaxed">
                      {lang === 'en'
                        ? 'Activate LM AI once as a permanent member who understands group context when mentioned. Once activated, it stays active permanently.'
                        : 'فعّل LM AI مرة واحدة كعضو دائم يقرأ سياق المجموعة عند استدعائه. بمجرد التفعيل يبقى نشطًا بشكل دائم.'}
                    </p>
                    <button
                      type="button"
                      disabled={togglingAiMode}
                      onClick={activatePermanentGroupAi}
                      className="w-full h-10 rounded-full bg-white text-black text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {togglingAiMode
                          ? lang === 'en'
                            ? 'Activating...'
                            : 'جارٍ التفعيل...'
                          : t(lang, 'ai_permanent_member')}
                      </span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#8E8E93]">
                    {lang === 'en'
                      ? 'Only the group creator can activate LM AI as a permanent member.'
                      : 'منشئ المجموعة فقط يمكنه تفعيل LM AI كعضو دائم.'}
                  </p>
                )}
              </div>
            )}

            {/* Searchable Members List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#E4E4E7]">
                  {lang === 'en' ? 'Members' : 'الأعضاء'} ({activeConv.memberCount.toLocaleString()})
                </span>
              </div>
              <div className="h-10 rounded-full bg-[#111117] border border-white/[0.1] px-3.5 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#7A7A85]" />
                <input
                  value={infoMemberSearch}
                  onChange={e => setInfoMemberSearch(e.target.value)}
                  placeholder={lang === 'en' ? 'Search members...' : 'ابحث في الأعضاء...'}
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-[#63636C] outline-none"
                />
              </div>
              <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0D0D12] overflow-hidden">
                {allUsers
                  .filter(
                    u =>
                      !infoMemberSearch.trim() ||
                      u.displayName.toLowerCase().includes(infoMemberSearch.toLowerCase()) ||
                      u.username.toLowerCase().includes(infoMemberSearch.toLowerCase())
                  )
                  .map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setInfoOpen(false);
                        onOpenProfile?.(member.id);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.05] text-start cursor-pointer transition-colors"
                    >
                      <UserAvatar initials={member.avatarInitials} avatarUrl={member.avatarUrl} size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                          <span>{member.displayName}</span>
                          {member.id === activeConv.creatorId && (
                            <span className="px-2 py-0.5 rounded-full bg-[#FBBF24]/18 text-[#FBBF24] text-[9.5px] font-semibold">
                              {lang === 'en' ? 'Owner' : 'المؤسس'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#7A7A85] font-mono-num truncate">@{member.username}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Clear Chat & Delete Group Controls (2-Step Safe Confirmations — ZERO Trash2!) */}
            <div className="space-y-2.5 pt-2 border-t border-white/[0.08]">
              {confirmClearChat ? (
                <div className="p-3.5 rounded-2xl bg-[#15151C] border border-white/[0.15] flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-white">
                    {lang === 'en' ? 'Clear all messages in this chat?' : 'هل تريد مسح جميع الرسائل في هذه المحادثة؟'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmClearChat(false)}
                      className="px-3 py-1.5 rounded-full bg-white/[0.08] text-xs text-[#C4C4CC] cursor-pointer"
                    >
                      {t(lang, 'cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={clearActiveChatMessages}
                      className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-bold cursor-pointer"
                    >
                      {lang === 'en' ? 'Confirm Clear' : 'تأكيد المسح'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearChat(true)}
                  className="w-full px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-[#E4E4E7] flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Eraser className="w-4 h-4 text-[#FBBF24]" />
                  <span>{t(lang, 'clear_chat')}</span>
                </button>
              )}

              {activeConv.type !== 'dm' && activeConv.creatorId === user.id && (
                confirmDeleteConv ? (
                  <div className="p-3.5 rounded-2xl bg-[#EF4444]/12 border border-[#FB7185]/35 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-[#FDA4AF] font-medium">
                      {lang === 'en'
                        ? 'Permanently delete this entire group and its messages?'
                        : 'سيتم حذف المجموعة وجميع رسائلها نهائيًا. هل أنت متأكد؟'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteConv(false)}
                        className="px-3 py-1.5 rounded-full bg-white/[0.08] text-xs text-white cursor-pointer"
                      >
                        {t(lang, 'cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={deleteActiveConversation}
                        className="px-3.5 py-1.5 rounded-full bg-[#EF4444] text-white text-xs font-bold cursor-pointer"
                      >
                        {lang === 'en' ? 'Delete Permanently' : 'حذف نهائي'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteConv(true)}
                    className="w-full px-4 py-3 rounded-2xl bg-[#EF4444]/10 hover:bg-[#EF4444]/20 border border-[#FB7185]/25 text-xs font-semibold text-[#FDA4AF] flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>{t(lang, 'delete_group')}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
