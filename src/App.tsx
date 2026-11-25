import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { AppShell } from './components/layout/AppShell';
import { SocialView } from './components/social/SocialView';
import { ShortVideosView } from './components/videos/ShortVideosView';
import { LiveView } from './components/live/LiveView';
import { ChatView } from './components/chat/ChatView';
import { AiView } from './components/ai/AiView';
import { VipStoreView } from './components/vip/VipStoreView';
import { FinanceView } from './components/finance/FinanceView';
import { ApiHubView } from './components/settings/ApiHubView';

function MainRouter() {
  const { user, activeTab } = useApp();

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <AppShell>
      {activeTab === 'social' && <SocialView />}
      {activeTab === 'videos' && <ShortVideosView />}
      {activeTab === 'live' && <LiveView />}
      {activeTab === 'chat' && <ChatView />}
      {activeTab === 'ai' && <AiView />}
      {activeTab === 'vip' && <VipStoreView />}
      {activeTab === 'finance' && <FinanceView />}
      {activeTab === 'settings' && <ApiHubView />}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
