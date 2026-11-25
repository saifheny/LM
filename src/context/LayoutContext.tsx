import React, { createContext, useContext, useState } from 'react';
import { NavTab } from '../types';

interface LayoutContextValue {
  composerFocused: boolean;
  setComposerFocused: (v: boolean) => void;
  mobileNavExpanded: boolean;
  setMobileNavExpanded: (v: boolean) => void;
  bottomDockHidden: boolean;
  setBottomDockHidden: (v: boolean) => void;
  chatInThread: boolean;
  setChatInThread: (v: boolean) => void;
  activeTab: NavTab;
  onSelectTab: (t: NavTab) => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  composerFocused: false,
  setComposerFocused: () => {},
  mobileNavExpanded: false,
  setMobileNavExpanded: () => {},
  bottomDockHidden: false,
  setBottomDockHidden: () => {},
  chatInThread: false,
  setChatInThread: () => {},
  activeTab: 'social',
  onSelectTab: () => {},
});

export function LayoutProvider({
  activeTab,
  onSelectTab,
  children,
}: {
  activeTab: NavTab;
  onSelectTab: (t: NavTab) => void;
  children: React.ReactNode;
}) {
  const [composerFocused, setComposerFocused] = useState(false);
  const [mobileNavExpanded, setMobileNavExpanded] = useState(false);
  const [bottomDockHidden, setBottomDockHidden] = useState(false);
  const [chatInThread, setChatInThread] = useState(false);

  return (
    <LayoutContext.Provider
      value={{
        composerFocused,
        setComposerFocused,
        mobileNavExpanded,
        setMobileNavExpanded,
        bottomDockHidden,
        setBottomDockHidden,
        chatInThread,
        setChatInThread,
        activeTab,
        onSelectTab,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
