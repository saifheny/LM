import React, { createContext, useContext, useState } from 'react';
import { NavTab } from '../types';

interface LayoutContextValue {
  composerFocused: boolean;
  setComposerFocused: (v: boolean) => void;
  mobileNavExpanded: boolean;
  setMobileNavExpanded: (v: boolean) => void;
  activeTab: NavTab;
  onSelectTab: (t: NavTab) => void;
  hideMobileDock: boolean;
  setHideMobileDock: (v: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  composerFocused: false,
  setComposerFocused: () => {},
  mobileNavExpanded: false,
  setMobileNavExpanded: () => {},
  activeTab: 'social',
  onSelectTab: () => {},
  hideMobileDock: false,
  setHideMobileDock: () => {},
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
  const [hideMobileDock, setHideMobileDock] = useState(false);

  return (
    <LayoutContext.Provider
      value={{
        composerFocused,
        setComposerFocused,
        mobileNavExpanded,
        setMobileNavExpanded,
        activeTab,
        onSelectTab,
        hideMobileDock,
        setHideMobileDock,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  return useContext(LayoutContext);
}
