import React, { useCallback, useEffect, useState } from 'react';
import { Lang, NavTab, NotificationItem, UserProfile } from './types';
import { apiGet, apiPost } from './lib/api';
import { LayoutProvider } from './context/LayoutContext';
import { AppShell } from './components/layout/AppShell';
import { AuthScreen } from './components/auth/AuthScreen';
import { SocialView } from './components/social/SocialView';
import { ShortVideosView } from './components/videos/ShortVideosView';
import { LiveView } from './components/live/LiveView';
import { ChatView } from './components/chat/ChatView';
import { AiView } from './components/ai/AiView';
import { ProfileView } from './components/profile/ProfileView';
import { ApiHubView } from './components/settings/ApiHubView';

const VALID_TABS: NavTab[] = ['social', 'videos', 'live', 'chat', 'ai', 'profile', 'settings'];

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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

  useEffect(() => {
    if (currentUser?.id) loadNotifications(currentUser.id);
  }, [currentUser?.id, loadNotifications]);

  useEffect(() => {
    if (lastWsEvent?.event === 'notification:new' && currentUser?.id) {
      const payload = lastWsEvent.payload as { userId?: string };
      if (!payload?.userId || payload.userId === currentUser.id) {
        loadNotifications(currentUser.id);
      }
    }
  }, [lastWsEvent, currentUser?.id, loadNotifications]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: number | undefined;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      ws.onopen = () => setWsOnline(true);
      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          setLastWsEvent(parsed);
        } catch {
          // ignore malformed frame
        }
      };
      ws.onclose = () => {
        setWsOnline(false);
        retryTimer = window.setTimeout(connect, 2500);
      };
    };

    connect();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

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
        onLogout={() => setLoggedOut(true)}
      >
        {activeTab === 'social' && (
          <SocialView
            user={currentUser}
            allUsers={users}
            lang={lang}
            lastWsEvent={lastWsEvent}
            activeHashtag={activeHashtag}
            onSelectHashtag={setActiveHashtag}
            onOpenProfile={openProfile}
            onOpenProfileByUsername={openProfileByUsername}
          />
        )}
        {activeTab === 'videos' && (
          <ShortVideosView
            user={currentUser}
            lang={lang}
            onOpenProfile={openProfile}
            onOpenProfileByUsername={openProfileByUsername}
            onOpenHashtag={openHashtagFeed}
          />
        )}
        {activeTab === 'live' && (
          <LiveView user={currentUser} lang={lang} lastWsEvent={lastWsEvent} onOpenProfile={openProfile} />
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
      </AppShell>
    </LayoutProvider>
  );
}

export default App;
