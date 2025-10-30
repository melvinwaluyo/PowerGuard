import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/services/api";
import { getNotificationPreferences } from "@/utils/notificationPreferences";
import { getShownNotificationIds, saveShownNotificationIds } from "@/utils/notificationTracking";

const BACKGROUND_FETCH_TASK = "background-fetch-task";
const LAST_CHECK_TIMESTAMP_KEY = "last_notification_check";

console.log("[Background Fetch] Task definition loaded");

// Helper to get last check timestamp
async function getLastCheckTimestamp(): Promise<Date> {
  try {
    const stored = await AsyncStorage.getItem(LAST_CHECK_TIMESTAMP_KEY);
    if (stored) {
      return new Date(stored);
    }
  } catch (error) {
    console.error("[Background Fetch] Failed to load last check timestamp:", error);
  }
  // Default to 10 minutes ago
  return new Date(Date.now() - 600000);
}

// Helper to save last check timestamp
async function saveLastCheckTimestamp(timestamp: Date): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CHECK_TIMESTAMP_KEY, timestamp.toISOString());
  } catch (error) {
    console.error("[Background Fetch] Failed to save last check timestamp:", error);
  }
}

// Define the background fetch task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const timestamp = new Date().toISOString();
  console.log(`[Background Fetch] Task triggered at ${timestamp}`);

  try {
    // Get notification preferences
    const preferences = await getNotificationPreferences();

    // Get the last check timestamp
    const lastCheck = await getLastCheckTimestamp();
    const shownIds = await getShownNotificationIds();

    console.log(`[Background Fetch] Checking notifications since ${lastCheck.toISOString()}`);

    // Fetch all outlets
    const outlets = await api.getOutlets();
    let newNotificationCount = 0;

    // Check each outlet for new notifications
    for (const outlet of outlets) {
      try {
        const notifications = await api.getOutletNotifications(outlet.outletID, 5, lastCheck.toISOString());

        for (const notification of notifications) {
          const notificationId = typeof notification.notificationID === 'number' ? notification.notificationID : 0;

          // Skip if already shown
          if (shownIds.has(notificationId)) {
            continue;
          }

          const message = notification.message ?? "";
          const isTimer = message.includes("Timer completed");
          const isGeofence = message.includes("Geofence");

          // Only show timer completion notifications in background
          if (isTimer) {
            const isManualTimer = !isGeofence;
            const shouldNotify = isManualTimer
              ? preferences.manualTimerCompleted
              : preferences.geofenceTimerCompleted;

            if (shouldNotify) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "⏰ Timer Completed",
                  body: message,
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  data: { outletId: outlet.outletID, notificationId },
                },
                trigger: null,
              });

              shownIds.add(notificationId);
              newNotificationCount++;
              console.log(`[Background Fetch] Showed notification ${notificationId}: ${message}`);
            }
          }
        }
      } catch (error) {
        console.error(`[Background Fetch] Failed to check outlet ${outlet.outletID}:`, error);
      }
    }

    // Save the updated shown IDs and timestamp
    await saveShownNotificationIds(shownIds);
    await saveLastCheckTimestamp(new Date());

    console.log(`[Background Fetch] Completed successfully - ${newNotificationCount} new notification(s) shown`);
    return newNotificationCount > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error("[Background Fetch] Error:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register background fetch task
 */
export async function registerBackgroundFetch() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);

    if (isRegistered) {
      console.log("[Background Fetch] Already registered");
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 180, // 3 minutes (in seconds)
      stopOnTerminate: false, // Continue after app is terminated
      startOnBoot: true, // Start when device boots
    });

    console.log("[Background Fetch] Registered successfully");
  } catch (error) {
    console.error("[Background Fetch] Failed to register:", error);
  }
}

/**
 * Unregister background fetch task
 */
export async function unregisterBackgroundFetch() {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log("[Background Fetch] Unregistered successfully");
  } catch (error) {
    console.error("[Background Fetch] Failed to unregister:", error);
  }
}

/**
 * Get background fetch status
 */
export async function getBackgroundFetchStatus() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);

    return {
      status: BackgroundFetch.BackgroundFetchStatus[status],
      isRegistered,
    };
  } catch (error) {
    console.error("[Background Fetch] Failed to get status:", error);
    return { status: "Unknown", isRegistered: false };
  }
}
