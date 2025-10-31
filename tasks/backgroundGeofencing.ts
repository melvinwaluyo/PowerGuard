import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { api } from "@/services/api";
import { getNotificationPreferences } from "@/utils/notificationPreferences";

const GEOFENCE_TASK = "background-geofence-task";
const DEFAULT_POWERSTRIP_ID = 1;
const LAST_ENTER_NOTIFICATION_KEY = "last_geofence_enter_notification";
const LAST_EXIT_NOTIFICATION_KEY = "last_geofence_exit_notification";

console.log("[Geofencing] Task definition loaded");

/**
 * Check if we should show a notification based on cooldown period
 */
async function shouldShowNotification(key: string, cooldownMs: number = 60000): Promise<boolean> {
  try {
    const lastShown = await AsyncStorage.getItem(key);
    if (lastShown) {
      const timeSince = Date.now() - parseInt(lastShown, 10);
      if (timeSince < cooldownMs) {
        console.log(`[Geofencing] Notification cooldown active (${Math.round(timeSince / 1000)}s ago)`);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error("[Geofencing] Failed to check notification cooldown:", error);
    return true; // Show notification if check fails
  }
}

/**
 * Mark that a notification was shown
 */
async function markNotificationShown(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, Date.now().toString());
  } catch (error) {
    console.error("[Geofencing] Failed to mark notification as shown:", error);
  }
}

/**
 * Background geofencing task - triggered only on ENTER/EXIT events
 * Much more battery efficient than continuous location polling
 */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  const timestamp = new Date().toISOString();
  console.log(`[Geofencing] Event triggered at ${timestamp}`);

  if (error) {
    console.error("[Geofencing] Error:", error);
    return;
  }

  if (data) {
    const { eventType, region } = data as {
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };

    console.log(`[Geofencing] Event: ${eventType === Location.GeofencingEventType.Enter ? 'ENTER' : 'EXIT'} region ${region.identifier}`);

    try {
      // Get notification preferences
      const preferences = await getNotificationPreferences();

      // Get current location for precise distance calculation
      const currentLocation = await Location.getLastKnownPositionAsync({});

      if (!currentLocation) {
        console.warn("[Geofencing] No location available");
        return;
      }

      // Report event to backend
      const evaluation = await api.reportGeofenceLocation(DEFAULT_POWERSTRIP_ID, {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // EXITING geofence (left home)
      if (eventType === Location.GeofencingEventType.Exit && evaluation.countdownIsActive) {
        const activeOutletCount = evaluation.triggeredOutlets?.length || 0;

        if (activeOutletCount > 0 && preferences.leftZoneWithOutletsOn) {
          // Check cooldown - only show if not shown in last 60 seconds
          const shouldShow = await shouldShowNotification(LAST_EXIT_NOTIFICATION_KEY, 60000);

          if (shouldShow) {
            const minutes = Math.floor((evaluation.autoShutdownSeconds || 900) / 60);
            const seconds = (evaluation.autoShutdownSeconds || 900) % 60;
            const timerText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

            // Send critical notification - user left home with outlets ON
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🚨 PowerGuard CRITICAL ALERT",
                body: `⚠️ You left home with ${activeOutletCount} outlet${activeOutletCount > 1 ? 's' : ''} still ON! Auto-shutdown in ${timerText}.`,
                sound: 'critical.wav',
                vibrate: false,
                priority: Notifications.AndroidNotificationPriority.MAX,
                sticky: true,
                data: {
                  type: 'geofence_exit',
                  activeOutletCount,
                },
              },
              trigger: null,
              identifier: `geofence-exit-${Date.now()}`,
              ...(Platform.OS === 'android' ? { channelId: 'critical-alerts-v3' } : {}),
            });

            await markNotificationShown(LAST_EXIT_NOTIFICATION_KEY);
            console.log(`[Geofencing] Sent EXIT alert - ${activeOutletCount} outlets still on`);
          } else {
            console.log(`[Geofencing] Skipped EXIT notification (cooldown active)`);
          }
        }
      }

      // ENTERING geofence (returned home)
      if (eventType === Location.GeofencingEventType.Enter) {
        console.log("[Geofencing] Entered home zone");

        // Backend will create notification via NotificationLog table
        // OutletContext will poll and display it to avoid duplicates
        // No need to send immediate notification here
      }

      // Check for pending auto-shutdown requests
      if (evaluation.pendingRequest && preferences.geofenceTimerCompleted) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Auto Shutdown Ready",
            body: "Geofence timer completed. Open PowerGuard to confirm shutdown.",
            sound: 'normal.wav',
            vibrate: false,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              requestId: evaluation.pendingRequest.requestId,
              outletId: evaluation.pendingRequest.outletId,
            },
          },
          trigger: null,
          ...(Platform.OS === 'android' ? { channelId: 'app-notifications' } : {}),
        });
      }

      console.log("[Geofencing] Processed:", {
        event: eventType === Location.GeofencingEventType.Enter ? 'ENTER' : 'EXIT',
        zone: evaluation.zone,
        distance: evaluation.distanceMeters,
        countdown: evaluation.countdownIsActive,
      });
    } catch (err) {
      console.error("[Geofencing] Failed to process:", err);
    }
  }
});

/**
 * Start native geofencing (event-driven, battery efficient)
 */
export async function startGeofencing(
  latitude: number,
  longitude: number,
  radius: number
): Promise<boolean> {
  try {
    // Check if already running
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);

    // Request permissions
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("[Geofencing] Foreground permission not granted");
        return false;
      }
    }

    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    if (backgroundStatus !== "granted") {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== "granted") {
        console.warn("[Geofencing] Background permission not granted");
        return false;
      }
    }

    // Define the geofence region
    const region: Location.LocationRegion = {
      identifier: `home-${DEFAULT_POWERSTRIP_ID}`,
      latitude,
      longitude,
      radius, // in meters
      notifyOnEnter: true,
      notifyOnExit: true,
    };

    // Start geofencing (updates existing task if already registered)
    await Location.startGeofencingAsync(GEOFENCE_TASK, [region]);

    console.log(`[Geofencing] ✅ Started for region at (${latitude}, ${longitude}) radius ${radius}m`);
    console.log(`[Geofencing] Mode: ${isRegistered ? 'Updated existing' : 'New registration'}`);

    return true;
  } catch (error) {
    console.error("[Geofencing] Failed to start:", error);
    return false;
  }
}

/**
 * Stop geofencing
 */
export async function stopGeofencing(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);

    if (isRegistered) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
      console.log("[Geofencing] Stopped successfully");
    }
  } catch (error) {
    console.error("[Geofencing] Failed to stop:", error);
  }
}

/**
 * Check if geofencing is running
 */
export async function isGeofencingActive(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  } catch (error) {
    console.error("[Geofencing] Failed to check status:", error);
    return false;
  }
}

/**
 * Update geofence region (e.g., when home location or radius changes)
 */
export async function updateGeofenceRegion(
  latitude: number,
  longitude: number,
  radius: number
): Promise<boolean> {
  // Calling startGeofencingAsync again updates the existing task
  return await startGeofencing(latitude, longitude, radius);
}
