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

export function App() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('social');
  const [lang, setLang] = useState<Lang>('ar');
  const [wsOnline, setWsOnline] = useState(false);
  const [lastWsEvent, setLastWsEvent] = useState<{ event: string; payload: unknown; ts: number } | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; users: UserProfile[] }>('/api/auth/users');
      setUsers(res.users);
      setCurrentUser(prev => {
        if (prev) return res.users.find(u => u.id === prev.id) || prev;
        return res.users[0] || null;
      });
    } catch {
      // retry on reconnect
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

  if (!currentUser) {
    return (
      <AuthScreen
        users={users}
        lang={lang}
        onToggleLang={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}
        onAuthenticated={(u) => {
          setCurrentUser(u);
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
        onToggleLang={() => setLang(l => (l === 'ar' ? 'en' : 'ar'))}
        wsOnline={wsOnline}
        onSwitchUser={(u) => setCurrentUser(u)}
        onLogout={() => setCurrentUser(null)}
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
