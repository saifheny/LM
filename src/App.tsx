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
import { InteractiveFxOverlay } from './components/shared/InteractiveEmojiEngine';

function MainRouter() {
  const { user, activeTab } = useApp();

  if (!user) {
    return (
      <>
        <AuthScreen />
        <InteractiveFxOverlay />
      </>
    );
  }

  return (
    <>
      <AppShell>
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'videos' && <ShortVideosView />}
        {activeTab === 'social' && <SocialView />}
        {activeTab === 'live' && <LiveView />}
        {activeTab === 'ai' && <AiView />}
        {activeTab === 'vip' && <VipStoreView />}
        {activeTab === 'finance' && <FinanceView />}
        {activeTab === 'settings' && <ApiHubView />}
      </AppShell>
      <InteractiveFxOverlay />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
