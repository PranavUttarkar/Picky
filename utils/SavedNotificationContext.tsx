import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  hasSavedNotification,
  clearSavedNotification,
  triggerSavedNotification,
} from './notifications';

interface SavedNotificationContextType {
  hasNewSavedItems: boolean;
  triggerNotification: () => Promise<void>;
  clearNotification: () => Promise<void>;
}

const SavedNotificationContext = createContext<SavedNotificationContextType | null>(null);

export function SavedNotificationProvider({ children }: { children: ReactNode }) {
  const [hasNewSavedItems, setHasNewSavedItems] = useState(false);

  // Check for saved notification on mount
  useEffect(() => {
    const checkSavedNotification = async () => {
      const hasNotification = await hasSavedNotification();
      setHasNewSavedItems(hasNotification);
    };
    checkSavedNotification();
  }, []);

  const triggerNotification = async () => {
    await triggerSavedNotification();
    setHasNewSavedItems(true);
  };

  const clearNotification = async () => {
    await clearSavedNotification();
    setHasNewSavedItems(false);
  };

  return (
    <SavedNotificationContext.Provider
      value={{
        hasNewSavedItems,
        triggerNotification,
        clearNotification,
      }}
    >
      {children}
    </SavedNotificationContext.Provider>
  );
}

export function useSavedNotification() {
  const context = useContext(SavedNotificationContext);
  if (!context) {
    throw new Error('useSavedNotification must be used within SavedNotificationProvider');
  }
  return context;
}
