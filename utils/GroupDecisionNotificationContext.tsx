import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  hasGroupDecisionNotification,
  clearGroupDecisionNotification,
  triggerGroupDecisionNotification,
} from './notifications';

interface GroupDecisionNotificationContextType {
  hasNewGroupDecisions: boolean;
  triggerNotification: () => Promise<void>;
  clearNotification: () => Promise<void>;
}

const GroupDecisionNotificationContext = createContext<GroupDecisionNotificationContextType | null>(
  null,
);

export function GroupDecisionNotificationProvider({ children }: { children: ReactNode }) {
  const [hasNewGroupDecisions, setHasNewGroupDecisions] = useState(false);

  // Check for group decision notification on mount
  useEffect(() => {
    const checkGroupDecisionNotification = async () => {
      const hasNotification = await hasGroupDecisionNotification();
      setHasNewGroupDecisions(hasNotification);
    };
    checkGroupDecisionNotification();
  }, []);

  const triggerNotification = async () => {
    await triggerGroupDecisionNotification();
    setHasNewGroupDecisions(true);
  };

  const clearNotification = async () => {
    await clearGroupDecisionNotification();
    setHasNewGroupDecisions(false);
  };

  return (
    <GroupDecisionNotificationContext.Provider
      value={{
        hasNewGroupDecisions,
        triggerNotification,
        clearNotification,
      }}
    >
      {children}
    </GroupDecisionNotificationContext.Provider>
  );
}

export function useGroupDecisionNotification() {
  const context = useContext(GroupDecisionNotificationContext);
  if (!context) {
    throw new Error(
      'useGroupDecisionNotification must be used within GroupDecisionNotificationProvider',
    );
  }
  return context;
}
