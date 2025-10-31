import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { api } from "@/services/api";

const GEOFENCE_TASK = "background-geofence-task";
const DEFAULT_POWERSTRIP_ID = 1;

console.log("[Geofencing] Task definition loaded - notifications handled by FCM");

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
      // Notification is now handled by backend via FCM
      if (eventType === Location.GeofencingEventType.Exit && evaluation.countdownIsActive) {
        const activeOutletCount = evaluation.triggeredOutlets?.length || 0;
        console.log(`[Geofencing] EXIT detected - ${activeOutletCount} outlets still on (FCM notification sent by backend)`);
      }

      // ENTERING geofence (returned home)
      if (eventType === Location.GeofencingEventType.Enter) {
        console.log("[Geofencing] Entered home zone");

        // Backend will create notification via NotificationLog table
        // OutletContext will poll and display it to avoid duplicates
        // No need to send immediate notification here
      }

      // Auto-shutdown notifications now handled by FCM from backend

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
