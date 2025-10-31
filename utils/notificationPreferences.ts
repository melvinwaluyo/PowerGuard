import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_PREFERENCES_KEY = '@powerguard_notification_preferences';

export interface NotificationPreferences {
  leftZoneWithOutletsOn: boolean;
  turnedOnOutletOutsideZone: boolean;
  manualTimerCompleted: boolean;
  geofenceTimerCompleted: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  leftZoneWithOutletsOn: true,
  turnedOnOutletOutsideZone: true,
  manualTimerCompleted: true,
  geofenceTimerCompleted: true,
};

/**
 * Get notification preferences from storage
 * Returns default preferences if none are stored
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return DEFAULT_PREFERENCES;
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save notification preferences to storage
 */
export async function setNotificationPreferences(
  preferences: NotificationPreferences
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTIFICATION_PREFERENCES_KEY,
      JSON.stringify(preferences)
    );
  } catch (error) {
    console.error('Failed to save notification preferences:', error);
  }
}

/**
 * Update a single notification preference
 */
export async function updateNotificationPreference(
  key: keyof NotificationPreferences,
  value: boolean
): Promise<void> {
  try {
    const current = await getNotificationPreferences();
    const updated = { ...current, [key]: value };
    await setNotificationPreferences(updated);
  } catch (error) {
    console.error('Failed to update notification preference:', error);
  }
}

/**
 * Reset all notification preferences to defaults
 */
export async function resetNotificationPreferences(): Promise<void> {
  try {
    await setNotificationPreferences(DEFAULT_PREFERENCES);
  } catch (error) {
    console.error('Failed to reset notification preferences:', error);
  }
}
