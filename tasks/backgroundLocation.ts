import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { api } from "@/services/api";
import { getNotificationPreferences } from "@/utils/notificationPreferences";

const BACKGROUND_LOCATION_TASK = "background-location-task";
const DEFAULT_POWERSTRIP_ID = 1;

console.log("[Background Location] Task definition loaded");

// Define the background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  const timestamp = new Date().toISOString();
  console.log(`[Background Location] Task triggered at ${timestamp}`);

  if (error) {
    console.error("[Background Location] Error:", error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    if (!location) {
      return;
    }

    try {
      // Get notification preferences
      const preferences = await getNotificationPreferences();

      // Report location to backend
      const evaluation = await api.reportGeofenceLocation(DEFAULT_POWERSTRIP_ID, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Check if user just left the zone (OUTSIDE with countdown active)
      if (evaluation.zone === "OUTSIDE" && evaluation.countdownIsActive) {
        const activeOutletCount = evaluation.triggeredOutlets?.length || 0;

        if (activeOutletCount > 0 && preferences.leftZoneWithOutletsOn) {
          const minutes = Math.floor((evaluation.autoShutdownSeconds || 900) / 60);
          const seconds = (evaluation.autoShutdownSeconds || 900) % 60;
          const timerText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          // Send notification
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🚨 PowerGuard ALERT",
              body: `⚠️ You left home with ${activeOutletCount} outlet${activeOutletCount > 1 ? 's' : ''} still ON! Auto-shutdown in ${timerText}.`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.MAX,
              vibrate: [0, 500, 200, 500, 200, 500],
              sticky: true,
            },
            trigger: null,
          });
        }
      }

      // Check for pending auto-shutdown requests
      if (evaluation.pendingRequest && preferences.geofenceTimerCompleted) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Auto Shutdown Ready",
            body: "Geofence timer completed. Open PowerGuard to confirm shutdown.",
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              requestId: evaluation.pendingRequest.requestId,
              outletId: evaluation.pendingRequest.outletId,
            },
          },
          trigger: null,
        });
      }

      console.log("[Background Location] Processed:", {
        zone: evaluation.zone,
        distance: evaluation.distanceMeters,
        countdown: evaluation.countdownIsActive,
      });
    } catch (err) {
      console.error("[Background Location] Failed to process:", err);
    }
  }
});

/**
 * Start background location updates
 */
// Track if we've already attempted registration
let registrationAttempted = false;

export async function startBackgroundLocationUpdates() {
  try {
    // Check if task is already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);

    if (isRegistered) {
      // Only log once to avoid spam
      if (!registrationAttempted) {
        console.log("[Background Location] Already registered");
        registrationAttempted = true;
      }
      return true;
    }

    // Request background location permission
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== "granted") {
      console.warn("[Background Location] Foreground permission not granted");
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      console.warn("[Background Location] Background permission not granted");
      return false;
    }

    // Start location updates WITHOUT foreground service to avoid background start errors
    // The system will handle background location tracking automatically
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 180000, // 3 minutes (180 seconds)
      distanceInterval: 50, // 50 meters
      pausesUpdatesAutomatically: false, // Keep running even when stationary
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: true, // iOS only
    });

    console.log("[Background Location] ✅ Started successfully");
    registrationAttempted = true;
    return true;
  } catch (error) {
    console.error("[Background Location] Failed to start:", error);
    return false;
  }
}

/**
 * Stop background location updates
 */
export async function stopBackgroundLocationUpdates() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);

    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log("[Background Location] Stopped successfully");
    }
  } catch (error) {
    console.error("[Background Location] Failed to stop:", error);
  }
}

/**
 * Check if background location is running
 */
export async function isBackgroundLocationRunning(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch (error) {
    console.error("[Background Location] Failed to check status:", error);
    return false;
  }
}
