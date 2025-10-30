import AsyncStorage from "@react-native-async-storage/async-storage";

const SHOWN_NOTIFICATIONS_KEY = "shown_notification_ids";

/**
 * Get the set of notification IDs that have already been shown
 */
export async function getShownNotificationIds(): Promise<Set<number>> {
  try {
    const stored = await AsyncStorage.getItem(SHOWN_NOTIFICATIONS_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as number[];
      return new Set(ids);
    }
  } catch (error) {
    console.error("[Notification Tracking] Failed to load shown notifications:", error);
  }
  return new Set<number>();
}

/**
 * Save the set of notification IDs that have been shown
 * Keeps only the last 1000 IDs to prevent storage bloat
 */
export async function saveShownNotificationIds(ids: Set<number>): Promise<void> {
  try {
    const idsArray = Array.from(ids).slice(-1000);
    await AsyncStorage.setItem(SHOWN_NOTIFICATIONS_KEY, JSON.stringify(idsArray));
  } catch (error) {
    console.error("[Notification Tracking] Failed to save shown notifications:", error);
  }
}

/**
 * Mark a notification ID as shown
 */
export async function markNotificationAsShown(id: number): Promise<void> {
  const ids = await getShownNotificationIds();
  ids.add(id);
  await saveShownNotificationIds(ids);
}

/**
 * Check if a notification has been shown
 */
export async function hasNotificationBeenShown(id: number): Promise<boolean> {
  const ids = await getShownNotificationIds();
  return ids.has(id);
}
