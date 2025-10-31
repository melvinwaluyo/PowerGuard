import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

const BACKGROUND_FETCH_TASK = "background-fetch-task";

console.log("[Background Fetch] Task definition loaded - notifications handled by FCM");

// Background fetch task removed - all notifications now sent via FCM from backend
// FCM handles notifications whether app is open or closed
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  console.log('[Background Fetch] Task disabled - notifications handled by FCM');
  return BackgroundFetch.BackgroundFetchResult.NoData;
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
