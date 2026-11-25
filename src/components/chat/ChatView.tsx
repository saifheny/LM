import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Lock,
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
} from 'lucide-react';

import { ChatMessageItem, ConversationItem, Lang, UserProfile } from '../../types';
import { UserAvatar, RichMessageText } from '../shared/LmBrandMark';
import { ObsidianComposerPill, ChromeArrowButton } from '../shared/HardwareUI';
import { TelegramReactionStrip, TelegramReactionPill } from '../shared/TelegramReactions';
import { SmartVoicePill, LiveVoiceRecorder } from '../shared/VoiceStudio2026';
import { apiGet, apiPost, apiUploadFile } from '../../lib/api';

interface ChatViewProps {
  user: UserProfile;
  lang: Lang;
  lastWsEvent: { event: string; payload: unknown; ts: number } | null;
}

export function ChatView({ user, lang, lastWsEvent }: ChatViewProps) {
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

  // Voice & Video Note Recording + Calls
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [callOverlay, setCallOverlay] = useState<'audio' | 'video' | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  const [newChatType, setNewChatType] = useState<'group' | 'community'>('group');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const callVideoRef = useRef<HTMLVideoElement | null>(null);
  const callStreamRef = useRef<MediaStream | null>(null);

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
      if (payload.conversationId === activeConvId) {
        loadMessages(activeConvId);
      }
      loadConversations();
    }
  }, [lastWsEvent, activeConvId, loadMessages, loadConversations]);

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
        // fallback monochrome avatar view
      }
    }
  }

  function endCall() {
    callStreamRef.current?.getTracks().forEach(t => t.stop());
    callStreamRef.current = null;
    setCallOverlay(null);
  }

  async function handleSendText(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !activeConvId) return;
    const text = draft.trim();
    setDraft('');

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
      content: isImage ? 'صورة مرفقة' : isVideo ? 'مقطع فيديو' : f.name,
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
      transcript: 'رسالة صوتية مسجّلة ومشفرة.',
    });
    loadMessages(activeConvId);
  }

  async function sendQuickVideoNote() {
    if (!activeConvId) return;
    await apiPost(`/api/conversations/${activeConvId}/messages`, {
      senderId: user.id,
      content: 'رسالة فيديو دائرية',
      msgType: 'video_note',
      mediaUrl: '/uploads/seed/reel4.mp4',
    });
    loadMessages(activeConvId);
  }

  async function toggleReaction(msgId: string, reactionKey: string) {
    setOpenPickerMsgId(null);
    await apiPost(`/api/messages/${msgId}/react`, {
      userId: user.id,
      emoji: reactionKey,
    });
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

  return (
    <div className="h-[calc(100vh-76px)] w-full bg-black text-[#F5F5F7] flex overflow-hidden border-b border-white/[0.08]">
      {/* Left Conversation List (Pure #000000 + 1px Hairline Border) */}
      <aside
        className={`${
          mobileShowList ? 'flex' : 'hidden md:flex'
        } w-full md:w-[330px] lg:w-[360px] shrink-0 flex-col bg-black border-e border-white/[0.08]`}
      >
        {/* Search & New Chat */}
        <div className="p-3.5 border-b border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 rounded-full bg-[#09090B] border border-white/[0.09] px-3.5 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#71717A]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث في المحادثات...' : 'Search chats...'}
                className="flex-1 bg-transparent text-xs text-white placeholder:text-[#52525B] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              title="إنشاء مجموعة أو مجتمع"
              className="w-9 h-9 rounded-full bg-[#09090B] border border-white/[0.09] hover:border-white/25 text-[#E4E4E7] flex items-center justify-center cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Folder Filter Tabs */}
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

        {/* Hairline Conversation Rows */}
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
                  active ? 'bg-[#0D0D10]' : 'hover:bg-white/[0.02]'
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
                      <span className="text-[13.5px] font-semibold text-[#F5F5F7] truncate">{conv.title}</span>
                      {conv.isEncrypted && <Lock className="w-3 h-3 text-[#71717A] shrink-0" />}
                    </div>
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
        {/* Clean Hairline Header */}
        {activeConv && (
          <header className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-3 bg-black">
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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{activeConv.title}</span>
                  {activeConv.isEncrypted && (
                    <span className="px-2 py-0.5 rounded-full border border-white/[0.1] text-[10px] text-[#A1A1AA] flex items-center gap-1 shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      <span>E2EE</span>
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#71717A] truncate">{activeConv.onlineText}</div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => startCall('audio')}
                title="مكالمة صوتية"
                className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Phone className="w-4 h-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => startCall('video')}
                title="مكالمة مرئية"
                className="w-8 h-8 rounded-full hover:bg-white/[0.06] text-[#A1A1AA] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <Video className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          </header>
        )}

        {/* Pinned Strip */}
        {activeConv?.pinnedMessage && (
          <div className="px-4 py-2 border-b border-white/[0.06] bg-[#050507] flex items-center gap-2 text-xs text-[#A1A1AA]">
            <Pin className="w-3.5 h-3.5 text-[#71717A] shrink-0" />
            <span className="truncate">{activeConv.pinnedMessage}</span>
          </div>
        )}

        {/* Pure #000000 Message Stream (Zero Doodle Wallpaper, Zero Lag) */}
        <div
          onClick={() => setOpenPickerMsgId(null)}
          className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-black"
        >
          {messages.map(msg => {
            const isMine = msg.senderId === user.id;
            const isAi = msg.senderId === 'lm_ai' || msg.msgType === 'ai_reply';
            const reactionEntries = Object.entries(msg.reactions || {}).filter(([, arr]) => arr.length > 0);
            const showHoverActions = hoveredMsgId === msg.id || openPickerMsgId === msg.id;

            return (
              <div
                key={msg.id}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className={`relative max-w-[82%] sm:max-w-[68%] group flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  {!isMine && (
                    <UserAvatar initials={msg.avatarInitials} avatarUrl={msg.avatarUrl} size={28} />
                  )}

                  <div className="relative">
                    {/* Hover Quick Telegram Reaction Strip */}
                    <AnimatePresence>
                      {openPickerMsgId === msg.id && (
                        <div className={`absolute -top-11 z-30 ${isMine ? 'end-0' : 'start-0'}`}>
                          <TelegramReactionStrip onSelect={rId => toggleReaction(msg.id, rId)} />
                        </div>
                      )}
                    </AnimatePresence>

                    {/* Circular Video Note (Frameless Circle on #000000) */}
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
                      /* Matte Obsidian / Graphite Message Bubble */
                      <div
                        className={`px-3.5 py-2.5 text-[14px] leading-relaxed border ${
                          isAi
                            ? 'rounded-2xl bg-[#0D0D11] border-white/[0.18] text-[#F5F5F7]'
                            : isMine
                            ? 'rounded-2xl rounded-ee-sm bg-[#16161A] border-white/[0.09] text-[#F5F5F7]'
                            : 'rounded-2xl rounded-es-sm bg-[#0B0B0D] border-white/[0.06] text-[#F5F5F7]'
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
                          <img
                            src={msg.mediaUrl}
                            alt=""
                            className="rounded-xl max-h-[260px] w-full object-cover mb-2 border border-white/[0.08]"
                          />
                        )}

                        {msg.msgType === 'audio' && msg.mediaUrl ? (
                          <SmartVoicePill url={msg.mediaUrl} transcript={msg.transcript} isMine={isMine} />
                        ) : msg.isSpoiler && !revealedSpoilers[msg.id] ? (
                          <button
                            type="button"
                            onClick={() => setRevealedSpoilers(prev => ({ ...prev, [msg.id]: true }))}
                            className="px-2.5 py-1 rounded bg-white/[0.08] text-xs text-[#A1A1AA] cursor-pointer"
                          >
                            محتوى مخفي • اضغط للكشف
                          </button>
                        ) : (
                          <RichMessageText text={msg.content} />
                        )}

                        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] font-mono-num text-[#71717A]">
                          <span>{msg.createdAt}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subtle Message Actions: React, Reply, Explicit Share with AI */}
                  <div
                    className={`flex items-center gap-0.5 transition-opacity ${
                      showHoverActions ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setOpenPickerMsgId(openPickerMsgId === msg.id ? null : msg.id);
                      }}
                      title="تفاعل"
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <SmilePlus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyTarget(msg)}
                      title="رد"
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
                      title="مشاركة هذه الرسالة فقط بإذن صريح مع LM AI"
                      className="w-7 h-7 rounded-full hover:bg-white/[0.08] text-[#71717A] hover:text-white flex items-center justify-center cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Telegram Localized Interactive Reaction Pills */}
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

        {/* Bottom Composer Area (Exact Image 1 Pitch-Black Pill + Chrome Rim ↑ Button) */}
        <div className="px-4 py-3 border-t border-white/[0.08] bg-black">
          {(replyTarget || sharedForAi) && (
            <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-[#09090B] border border-white/[0.08] flex items-center justify-between text-xs">
              <div className="truncate text-[#D4D4D8]">
                {sharedForAi ? (
                  <span>إذن مشاركة صريح مع LM AI: &ldquo;{sharedForAi.content.slice(0, 55)}&rdquo;</span>
                ) : (
                  <span>الرد على {replyTarget?.displayName}: {replyTarget?.content.slice(0, 55)}</span>
                )}
              </div>
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

          <input ref={fileInputRef} type="file" onChange={handleAttachFile} className="hidden" />

          {recordingVoice ? (
            <LiveVoiceRecorder onCancel={() => setRecordingVoice(false)} onSend={handleSendVoice} />
          ) : (
            <ObsidianComposerPill
              value={draft}
              onChange={setDraft}
              onSubmit={handleSendText}
              placeholder={
                invokeAiMode
                  ? 'اسأل @LM AI حول الرسالة المحددة...'
                  : lang === 'ar'
                  ? 'اكتب رسالة...'
                  : 'Message...'
              }
              onAttach={() => fileInputRef.current?.click()}
              onSparkle={() => setInvokeAiMode(v => !v)}
              sparkleActive={invokeAiMode}
              extraEnd={
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRecordingVoice(true)}
                    title="رسالة صوتية"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#E4E4E7] cursor-pointer"
                  >
                    <Mic className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={sendQuickVideoNote}
                    title="رسالة فيديو دائرية"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#71717A] hover:text-[#E4E4E7] cursor-pointer"
                  >
                    <CircleDot className="w-[17px] h-[17px]" strokeWidth={1.8} />
                  </button>
                </div>
              }
              disabled={!draft.trim()}
            />
          )}
        </div>
      </section>

      {/* Monochrome Voice / Video Call Overlay */}
      {callOverlay && activeConv && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between py-14 px-6">
          <div className="text-center space-y-1">
            <div className="text-xs text-[#71717A] font-mono-num">E2EE ENCRYPTED CALL</div>
            <div className="text-xl font-semibold text-white">{activeConv.title}</div>
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

      {/* Create New Group / Community Modal */}
      {newChatOpen && (
        <div onClick={() => setNewChatOpen(false)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={createConversation}
            className="w-full max-w-[380px] rounded-2xl bg-[#070709] border border-white/[0.12] p-5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">إنشاء مساحة محادثة</span>
              <button type="button" onClick={() => setNewChatOpen(false)} className="text-[#71717A] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={newChatTitle}
              onChange={e => setNewChatTitle(e.target.value)}
              placeholder="اسم المجموعة أو المجتمع..."
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
                  مجموعة مشفرة
                </button>
                <button
                  type="button"
                  onClick={() => setNewChatType('community')}
                  className={`px-3 py-1.5 rounded-full border cursor-pointer ${
                    newChatType === 'community' ? 'bg-white text-black border-white font-semibold' : 'border-white/[0.1] text-[#A1A1AA]'
                  }`}
                >
                  مجتمع عام
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
