import React, { useCallback, useEffect, useState } from 'react';
import { Lang, NavTab, UserProfile } from './types';
import { apiGet } from './lib/api';
import { LayoutProvider } from './context/LayoutContext';
import { AppShell } from './components/layout/AppShell';
import { AuthScreen } from './components/auth/AuthScreen';
import { SocialView } from './components/social/SocialView';
import { ShortVideosView } from './components/videos/ShortVideosView';
import { LiveView } from './components/live/LiveView';
import { ChatView } from './components/chat/ChatView';
import { AiView } from './components/ai/AiView';
import { ApiHubView } from './components/settings/ApiHubView';

const VALID_TABS: NavTab[] = ['social', 'videos', 'live', 'chat', 'ai', 'settings'];

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

  const setActiveTab = useCallback((t: NavTab) => {
    setActiveTabState(t);
    try {
      localStorage.setItem('lm_active_tab', t);
    } catch {
      // ignore
    }
  }, []);

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

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

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
        onLogout={() => setLoggedOut(true)}
      >
        {activeTab === 'social' && (
          <SocialView user={currentUser} lang={lang} lastWsEvent={lastWsEvent} />
        )}
        {activeTab === 'videos' && (
          <ShortVideosView user={currentUser} lang={lang} />
        )}
        {activeTab === 'live' && (
          <LiveView user={currentUser} lang={lang} lastWsEvent={lastWsEvent} />
        )}
        {activeTab === 'chat' && (
          <ChatView user={currentUser} lang={lang} lastWsEvent={lastWsEvent} />
        )}
        {activeTab === 'ai' && (
          <AiView user={currentUser} lang={lang} />
        )}
        {activeTab === 'settings' && (
          <ApiHubView lang={lang} />
        )}
      </AppShell>
    </LayoutProvider>
  );
}

export default App;
