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