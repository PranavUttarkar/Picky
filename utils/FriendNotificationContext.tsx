import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  hasFriendNotification,
  triggerFriendNotification,
  clearFriendNotification,
  getStoredFriendCount,
  setStoredFriendCount,
} from './notifications';

interface FriendNotificationContextType {
  hasNewFriends: boolean;
  recordFriendSnapshot: (friendCount: number, pendingCount: number) => Promise<void>;
  markFriendsViewed: (friendCount: number) => Promise<void>;
}

const FriendNotificationContext = createContext<FriendNotificationContextType | null>(null);

export function FriendNotificationProvider({ children }: { children: ReactNode }) {
  const [hasNewFriends, setHasNewFriends] = useState(false);
  const [lastFriendCount, setLastFriendCount] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [queuedSnapshot, setQueuedSnapshot] = useState<{
    friendCount: number;
    pendingCount: number;
  } | null>(null);

  useEffect(() => {
    const hydrate = async () => {
      const [storedFlag, storedCount] = await Promise.all([
        hasFriendNotification(),
        getStoredFriendCount(),
      ]);
      setHasNewFriends(storedFlag);
      setLastFriendCount(storedCount);
      setHydrated(true);
    };
    hydrate();
  }, []);

  const persistFriendCount = useCallback(async (count: number) => {
    setLastFriendCount(count);
    await setStoredFriendCount(count);
  }, []);

  const recordFriendSnapshot = useCallback(
    async (friendCount: number, pendingCount: number) => {
      if (!hydrated) {
        setQueuedSnapshot({ friendCount, pendingCount });
        return;
      }

      if (pendingCount > 0) {
        await triggerFriendNotification();
        setHasNewFriends(true);
        await persistFriendCount(friendCount);
        return;
      }

      if (lastFriendCount === null) {
        await persistFriendCount(friendCount);
        return;
      }

      if (friendCount > lastFriendCount) {
        await triggerFriendNotification();
        setHasNewFriends(true);
      }

      await persistFriendCount(friendCount);
    },
    [hydrated, lastFriendCount, persistFriendCount],
  );

  const markFriendsViewed = useCallback(
    async (friendCount: number) => {
      await clearFriendNotification();
      setHasNewFriends(false);
      await persistFriendCount(friendCount);
    },
    [persistFriendCount],
  );

  useEffect(() => {
    if (hydrated && queuedSnapshot) {
      recordFriendSnapshot(queuedSnapshot.friendCount, queuedSnapshot.pendingCount);
      setQueuedSnapshot(null);
    }
  }, [hydrated, queuedSnapshot, recordFriendSnapshot]);

  return (
    <FriendNotificationContext.Provider
      value={{
        hasNewFriends,
        recordFriendSnapshot,
        markFriendsViewed,
      }}
    >
      {children}
    </FriendNotificationContext.Provider>
  );
}

export function useFriendNotification() {
  const context = useContext(FriendNotificationContext);
  if (!context) {
    throw new Error('useFriendNotification must be used within FriendNotificationProvider');
  }
  return context;
}

