import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Trigger saved item notification (red dot on saved tab)
 */
export const triggerSavedNotification = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem('saved_notification', 'true');
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
    await AsyncStorage.setItem('saved_notification', 'false');
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
    const hasNotification = await AsyncStorage.getItem('saved_notification');
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
    await AsyncStorage.setItem('group_decision_notification', 'true');
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
    await AsyncStorage.setItem('group_decision_notification', 'false');
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
    const hasNotification = await AsyncStorage.getItem('group_decision_notification');
    return hasNotification === 'true';
  } catch (error) {
    console.warn('Failed to check group decision notification:', error);
    return false;
  }
};