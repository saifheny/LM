import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Lang, NavTab, NotificationItem, UserProfile } from './types';
import { apiGet, apiPost } from './lib/api';
import { registerWsUser, subscribeWs, subscribeWsStatus } from './lib/wsHub';
import { LayoutProvider } from './context/LayoutContext';
import { AppShell } from './components/layout/AppShell';
import { AuthScreen } from './components/auth/AuthScreen';
import { CallLaunchRequest, WebRtcCallController } from './components/shared/WebRtcCallModal';
import { SharePayload, ShareSheetModal } from './components/shared/ShareSheetModal';

// React.lazy Route-Level Code Splitting for instant sub-second mobile startup!
const SocialView = lazy(() => import('./components/social/SocialView').then(m => ({ default: m.SocialView })));
const ShortVideosView = lazy(() => import('./components/videos/ShortVideosView').then(m => ({ default: m.ShortVideosView })));
const LiveView = lazy(() => import('./components/live/LiveView').then(m => ({ default: m.LiveView })));
const ChatView = lazy(() => import('./components/chat/ChatView').then(m => ({ default: m.ChatView })));
const AiView = lazy(() => import('./components/ai/AiView').then(m => ({ default: m.AiView })));
const ProfileView = lazy(() => import('./components/profile/ProfileView').then(m => ({ default: m.ProfileView })));
const ApiHubView = lazy(() => import('./components/settings/ApiHubView').then(m => ({ default: m.ApiHubView })));

const VALID_TABS: NavTab[] = ['social', 'videos', 'live', 'chat', 'ai', 'profile', 'settings'];

function ViewLoadingFallback() {
  return (
    <div className="h-full w-full bg-[#0A0A0C] flex items-center justify-center">
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FBBF24] animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#FB7185] animate-bounce [animation-delay:120ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-bounce [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function readInitialTab(): NavTab {
  try {
    const saved = localStorage.getItem('lm_active_tab') as NavTab | null;
    if (saved && VALID_TABS.includes(saved)) return saved;
  } catch {
    // ignore
  }
  return 'social';
}

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem('lm_lang');
    if (saved === 'en' || saved === 'ar') return saved;
  } catch {
    // ignore
  }
  return 'ar';
}

export function App() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const [activeTab, setActiveTabState] = useState<NavTab>(readInitialTab);
  const [lang, setLangState] = useState<Lang>(readInitialLang);
  const [wsOnline, setWsOnline] = useState(false);
  const [lastWsEvent, setLastWsEvent] = useState<{ event: string; payload: unknown; ts: number } | null>(null);

  const [profileUserId, setProfileUserId] = useState<string>(() => {
    try {
      return localStorage.getItem('lm_profile_user_id') || '';
    } catch {
      return '';
    }
  });
  const [pendingChatConvId, setPendingChatConvId] = useState<string | null>(null);
  const [activeHashtag, setActiveHashtag] = useState<string | null>(null);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [focusedVideoId, setFocusedVideoId] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [outgoingCall, setOutgoingCall] = useState<CallLaunchRequest | null>(null);

  const shareApp = useCallback(() => {
    setSharePayload({
      kind: 'app',
      title: 'LM — المنصة الرقمية المتكاملة',
      snippet: 'المجتمع، نبض، بث مباشر، دردشة فورية، وLM AI في تطبيق واحد.',
      path: '/',
    });
  }, []);

  const setActiveTab = useCallback((t: NavTab) => {
    setActiveTabState(t);
    try {
      localStorage.setItem('lm_active_tab', t);
    } catch {
      // ignore
    }
  }, []);

  const openProfile = useCallback(
    (uid: string) => {
      setProfileUserId(uid);
      try {
        localStorage.setItem('lm_profile_user_id', uid);
      } catch {
        // ignore
      }
      setActiveTab('profile');
    },
    [setActiveTab]
  );

  const openProfileByUsername = useCallback(
    async (username: string) => {
      const clean = username.replace(/^@/, '').trim().toLowerCase();
      if (!clean) return;
      const localMatch = users.find(u => u.username.toLowerCase() === clean);
      if (localMatch) {
        openProfile(localMatch.id);
        return;
      }
      try {
        const res = await apiGet<{ ok: boolean; user?: UserProfile }>(`/api/users/by-username/${encodeURIComponent(clean)}`);
        if (res.user?.id) openProfile(res.user.id);
      } catch {
        // user handle does not exist
      }
    },
    [users, openProfile]
  );

  const openHashtagFeed = useCallback(
    (tag: string) => {
      const clean = tag.replace(/^#/, '').trim();
      if (!clean) return;
      setActiveHashtag(clean);
      setActiveTab('social');
    },
    [setActiveTab]
  );

  const openDirectChatWithUser = useCallback(
    async (targetUserId: string) => {
      if (!currentUser) return;
      try {
        const res = await apiPost<{ ok: boolean; id: string }>('/api/conversations/dm', {
          userId: currentUser.id,
          targetUserId,
        });
        if (res.id) {
          setPendingChatConvId(res.id);
          try {
            localStorage.setItem('lm_chat_conv_id', res.id);
            localStorage.setItem('lm_chat_in_thread', '1');
          } catch {
            // ignore
          }
          setActiveTab('chat');
        }
      } catch {
        // ignore
      }
    },
    [currentUser, setActiveTab]
  );

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next: Lang = prev === 'ar' ? 'en' : 'ar';
      try {
        localStorage.setItem('lm_lang', next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const selectUser = useCallback((u: UserProfile) => {
    setLoggedOut(false);
    setCurrentUser(u);
    try {
      localStorage.setItem('lm_current_user_id', u.id);
    } catch {
      // ignore
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; users: UserProfile[] }>('/api/auth/users');
      setUsers(res.users);
      setCurrentUser(prev => {
        if (prev) return res.users.find(u => u.id === prev.id) || prev;
        try {
          const savedId = localStorage.getItem('lm_current_user_id');
          if (savedId) {
            const match = res.users.find(u => u.id === savedId);
            if (match) return match;
          }
        } catch {
          // ignore
        }
        return res.users[0] || null;
      });
    } catch {
      // retry on reconnect
    } finally {
      setAuthLoaded(true);
    }
  }, []);

  const loadNotifications = useCallback(async (uid: string) => {
    try {
      const res = await apiGet<{ ok: boolean; notifications: NotificationItem[]; unreadCount: number }>(
        `/api/notifications?userId=${uid}`
      );
      setNotifications(res.notifications);
      setUnreadNotifications(res.unreadCount);
    } catch {
      // ignore
    }
  }, []);

  const markNotificationsRead = useCallback(
    async (id?: string) => {
      if (!currentUser) return;
      await apiPost('/api/notifications/read', { userId: currentUser.id, id });
      loadNotifications(currentUser.id);
    },
    [currentUser, loadNotifications]
  );

  const handleOpenNotification = useCallback(
    (n: NotificationItem) => {
      markNotificationsRead(n.id);
      if (n.refTab === 'chat' && n.refId) {
        setPendingChatConvId(n.refId);
        try {
          localStorage.setItem('lm_chat_conv_id', n.refId);
          localStorage.setItem('lm_chat_in_thread', '1');
        } catch {
          // ignore
        }
        setActiveTab('chat');
      } else if (n.refTab === 'profile' && n.refId) {
        openProfile(n.refId);
      } else {
        setActiveTab(n.refTab || 'social');
      }
    },
    [markNotificationsRead, openProfile, setActiveTab]
  );

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Deep-Link Auto-Router: Opens the EXACT shared Post, Profile, Pulse Video, or Live Room!
  useEffect(() => {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    const postMatch = pathname.match(/^\/post\/([^/]+)$/);
    const postId = postMatch ? decodeURIComponent(postMatch[1]) : params.get('post');
    if (postId) {
      setFocusedPostId(postId);
      setActiveTab('social');
      return;
    }

    const userMatch = pathname.match(/^\/u\/([^/]+)$/);
    const handle = userMatch ? decodeURIComponent(userMatch[1]) : params.get('user');
    if (handle) {
      openProfileByUsername(handle);
      return;
    }

    const videoMatch = pathname.match(/^\/pulse\/([^/]+)$/);
    const videoId = videoMatch ? decodeURIComponent(videoMatch[1]) : params.get('video');
    if (videoId) {
      setFocusedVideoId(videoId);
      setActiveTab('videos');
      return;
    }

    const liveMatch = pathname.match(/^\/live\/([^/]+)$/);
    const liveId = liveMatch ? decodeURIComponent(liveMatch[1]) : params.get('live');
    if (liveId) {
      try {
        localStorage.setItem('lm_live_room_id', liveId);
      } catch {
        // ignore
      }
      setActiveTab('live');
    }
  }, [openProfileByUsername, setActiveTab]);

  // Register active user with zero-drop WebSocket Hub for targeted WebRTC signaling
  useEffect(() => {
    registerWsUser(currentUser?.id || null);
    if (currentUser?.id) loadNotifications(currentUser.id);
  }, [currentUser?.id, loadNotifications]);

  useEffect(() => {
    const unsubStatus = subscribeWsStatus(setWsOnline);
    const unsubEvents = subscribeWs(frame => {
      if (!frame.event.startsWith('rtc:')) {
        setLastWsEvent(frame);
      }
    });
    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, []);

  useEffect(() => {
    if (lastWsEvent?.event === 'notification:new' && currentUser?.id) {
      const payload = lastWsEvent.payload as { userId?: string };
      if (!payload?.userId || payload.userId === currentUser.id) {
        loadNotifications(currentUser.id);
      }
    }
  }, [lastWsEvent, currentUser?.id, loadNotifications]);

  if (!authLoaded) {
    return <div className="h-screen w-screen bg-[#0A0A0C]" />;
  }

  if (!currentUser || loggedOut) {
    return (
      <AuthScreen
        users={users}
        lang={lang}
        onToggleLang={toggleLang}
        onAuthenticated={(u) => {
          selectUser(u);
          loadUsers();
        }}
      />
    );
  }

  return (
    <LayoutProvider activeTab={activeTab} onSelectTab={setActiveTab}>
      <AppShell
        user={currentUser}
        allUsers={users}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        lang={lang}
        onToggleLang={toggleLang}
        wsOnline={wsOnline}
        onSwitchUser={selectUser}
        onOpenProfile={openProfile}
        notifications={notifications}
        unreadNotifications={unreadNotifications}
        onMarkNotificationsRead={markNotificationsRead}
        onOpenNotification={handleOpenNotification}
        onShareApp={shareApp}
        onLogout={() => setLoggedOut(true)}
      >
        <Suspense fallback={<ViewLoadingFallback />}>
          {activeTab === 'social' && (
            <SocialView
              user={currentUser}
              allUsers={users}
              lang={lang}
              lastWsEvent={lastWsEvent}
              activeHashtag={activeHashtag}
              focusedPostId={focusedPostId}
              onClearFocusedPost={() => setFocusedPostId(null)}
              onSelectHashtag={setActiveHashtag}
              onOpenProfile={openProfile}
              onOpenProfileByUsername={openProfileByUsername}
              onMessageUser={openDirectChatWithUser}
              onOpenVideo={vidId => {
                setFocusedVideoId(vidId);
                setActiveTab('videos');
              }}
              onShare={setSharePayload}
            />
          )}
          {activeTab === 'videos' && (
            <ShortVideosView
              user={currentUser}
              lang={lang}
              focusedVideoId={focusedVideoId}
              onOpenProfile={openProfile}
              onOpenProfileByUsername={openProfileByUsername}
              onOpenHashtag={openHashtagFeed}
            />
          )}
          {activeTab === 'live' && (
            <LiveView
              user={currentUser}
              lang={lang}
              lastWsEvent={lastWsEvent}
              onOpenProfile={openProfile}
              onShare={setSharePayload}
            />
          )}
          {activeTab === 'chat' && (
            <ChatView
              user={currentUser}
              lang={lang}
              lastWsEvent={lastWsEvent}
              openConvId={pendingChatConvId}
              onConsumedOpenConv={() => setPendingChatConvId(null)}
              onOpenProfile={openProfile}
              onOpenProfileByUsername={openProfileByUsername}
              onOpenHashtag={openHashtagFeed}
              onStartCall={setOutgoingCall}
            />
          )}
          {activeTab === 'ai' && (
            <AiView user={currentUser} lang={lang} />
          )}
          {activeTab === 'profile' && (
            <ProfileView
              profileUserId={profileUserId || currentUser.id}
              currentUser={currentUser}
              lang={lang}
              onOpenProfile={openProfile}
              onOpenProfileByUsername={openProfileByUsername}
              onOpenHashtag={openHashtagFeed}
              onShare={setSharePayload}
              onProfileUpdated={updated => {
                setCurrentUser(updated);
                loadUsers();
              }}
              onMessageUser={openDirectChatWithUser}
              onOpenVideos={() => setActiveTab('videos')}
            />
          )}
          {activeTab === 'settings' && (
            <ApiHubView lang={lang} />
          )}
        </Suspense>
      </AppShell>

      {/* Global Real WebRTC 1-on-1 Audio & Video Call Controller (Works across ALL tabs!) */}
      <WebRtcCallController
        currentUser={currentUser}
        outgoingRequest={outgoingCall}
        onClearOutgoing={() => setOutgoingCall(null)}
      />

      {/* Global Universal Context-Aware Share Sheet */}
      <ShareSheetModal
        payload={sharePayload}
        currentUser={currentUser}
        onClose={() => setSharePayload(null)}
      />
    </LayoutProvider>
  );
}

export default App;
