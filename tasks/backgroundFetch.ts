import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { api } from "@/services/api";
import { getNotificationPreferences } from "@/utils/notificationPreferences";

const BACKGROUND_FETCH_TASK = "background-fetch-task";

console.log("[Background Fetch] Task definition loaded");

// Define the background fetch task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const timestamp = new Date().toISOString();
  console.log(`[Background Fetch] Task triggered at ${timestamp}`);

  try {
    console.log("[Background Fetch] Checking for timer updates...");

    // Get notification preferences
    const preferences = await getNotificationPreferences();

    // Fetch all outlets
    const outlets = await api.getOutlets();
    const now = Date.now();

    // Check for expired timers
    for (const outlet of outlets) {
      if (outlet.timerIsActive && outlet.timerEndsAt) {
        const endsAt = new Date(outlet.timerEndsAt).getTime();
        const isExpired = endsAt <= now;
        const timeSinceExpiry = now - endsAt;

        // If timer expired recently (within last 5 minutes), notify user
        if (isExpired && timeSinceExpiry < 300000) {
          const outletName = outlet.name || `Outlet ${outlet.index}`;

          // Check if it's a manual timer or geofence timer
          const isManualTimer = outlet.timerSource === "MANUAL";
          const shouldNotify = isManualTimer
            ? preferences.manualTimerCompleted
            : preferences.geofenceTimerCompleted;

          if (shouldNotify) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "⏰ Timer Completed",
                body: `${outletName} timer has completed and outlet has been turned off.`,
                sound: true,
                priority: Notifications.AndroidNotificationPriority.DEFAULT,
                data: { outletId: outlet.outletID },
              },
              trigger: null,
            });
          }
        }
      }
    }

    console.log("[Background Fetch] Completed successfully");
    return BackgroundFetch.BackgroundFetchResult.NewData;
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
