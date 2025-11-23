import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_NOTIFICATION_KEY = 'saved_notification';
const GROUP_DECISION_NOTIFICATION_KEY = 'group_decision_notification';
const FRIEND_NOTIFICATION_KEY = 'friend_notification';
const FRIEND_COUNT_KEY = 'friend_last_count';

/**
 * Trigger saved item notification (red dot on saved tab)
 */
export const triggerSavedNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(SAVED_NOTIFICATION_KEY, 'true');
  } catch (error) {
    // Silently fail if storage is not available
    console.warn('Failed to set saved notification:', error);
  }
};

/**
 * Clear saved item notification
 */
export const clearSavedNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(SAVED_NOTIFICATION_KEY, 'false');
  } catch (error) {
    // Silently fail if storage is not available
    console.warn('Failed to clear saved notification:', error);
  }
};

/**
 * Check if there are new saved items
 */
export const hasSavedNotification = async (): Promise<boolean> => {
  try {
    const hasNotification = await AsyncStorage.getItem(SAVED_NOTIFICATION_KEY);
    return hasNotification === 'true';
  } catch (error) {
    console.warn('Failed to check saved notification:', error);
    return false;
  }
};

/**
 * Trigger group decision notification (red dot on groups tab)
 */
export const triggerGroupDecisionNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROUP_DECISION_NOTIFICATION_KEY, 'true');
  } catch (error) {
    // Silently fail if storage is not available
    console.warn('Failed to set group decision notification:', error);
  }
};

/**
 * Clear group decision notification
 */
export const clearGroupDecisionNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(GROUP_DECISION_NOTIFICATION_KEY, 'false');
  } catch (error) {
    // Silently fail if storage is not available
    console.warn('Failed to clear group decision notification:', error);
  }
};

/**
 * Check if there are new group decisions
 */
export const hasGroupDecisionNotification = async (): Promise<boolean> => {
  try {
    const hasNotification = await AsyncStorage.getItem(GROUP_DECISION_NOTIFICATION_KEY);
    return hasNotification === 'true';
  } catch (error) {
    console.warn('Failed to check group decision notification:', error);
    return false;
  }
};

/**
 * Trigger friend notification (new friends or requests)
 */
export const triggerFriendNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(FRIEND_NOTIFICATION_KEY, 'true');
  } catch (error) {
    console.warn('Failed to set friend notification:', error);
  }
};

/**
 * Clear friend notification flag
 */
export const clearFriendNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(FRIEND_NOTIFICATION_KEY, 'false');
  } catch (error) {
    console.warn('Failed to clear friend notification:', error);
  }
};

/**
 * Check if there are unseen friend updates
 */
export const hasFriendNotification = async (): Promise<boolean> => {
  try {
    const hasNotification = await AsyncStorage.getItem(FRIEND_NOTIFICATION_KEY);
    return hasNotification === 'true';
  } catch (error) {
    console.warn('Failed to check friend notification:', error);
    return false;
  }
};

/**
 * Persist last known friend count so we can flag increases across sessions
 */
export const setStoredFriendCount = async (count: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(FRIEND_COUNT_KEY, count.toString());
  } catch (error) {
    console.warn('Failed to store friend count:', error);
  }
};

/**
 * Load the last known friend count from storage
 */
export const getStoredFriendCount = async (): Promise<number | null> => {
  try {
    const stored = await AsyncStorage.getItem(FRIEND_COUNT_KEY);
    if (!stored) return null;
    const parsed = Number.parseInt(stored, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch (error) {
    console.warn('Failed to load stored friend count:', error);
    return null;
  }
};