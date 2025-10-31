import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, Alert, Platform } from "react-native";
import { api, GeofenceSetting, GeofenceEvaluationResponse } from "@/services/api";
import { startGeofencing, stopGeofencing, updateGeofenceRegion } from "@/tasks/backgroundGeofencing";
import { getNotificationPreferences } from "@/utils/notificationPreferences";

export const DEFAULT_POWERSTRIP_ID = 1;

type GeofenceZone = "INSIDE" | "OUTSIDE";

interface GeofenceStatusState {
  zone: GeofenceZone;
  distanceMeters: number | null;
  countdownIsActive: boolean;
  countdownEndsAt: string | null;
  remainingSeconds: number;
}

interface PendingRequestState {
  requestId: number;
  outletId: number;
  initiatedAt: string;
  expiresAt: string | null;
}

interface GeofenceMonitorContextValue {
  settings: GeofenceSetting | null;
  status: GeofenceStatusState;
  pendingRequest: PendingRequestState | null;
  isResolvingRequest: boolean;
  refreshSettings: () => Promise<void>;
  updateSettingsLocal: (updates: Partial<GeofenceSetting>) => void;
  confirmPendingRequest: () => Promise<void>;
  cancelPendingRequest: () => Promise<void>;
  sendGeofenceAlert: (
    activeOutletCount: number,
    timerSeconds: number,
    reason: 'left_zone' | 'turned_on_outside',
    countdownEndsAt?: string | null,
  ) => Promise<void>;
  forceGeofenceEvaluation: () => Promise<void>;
}

const INITIAL_STATUS: GeofenceStatusState = {
  zone: "INSIDE",
  distanceMeters: null,
  countdownIsActive: false,
  countdownEndsAt: null,
  remainingSeconds: 0,
};

const GeofenceMonitorContext = createContext<GeofenceMonitorContextValue | null>(null);

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Create notification channels for Android
async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    // Critical channel: Left zone with outlets on (bypasses DND, uses critical sound)
    // Sound file must be in: android/app/src/main/res/raw/critical.wav
    await Notifications.setNotificationChannelAsync('critical-alerts-v3', {
      name: 'Critical Safety Alerts',
      description: 'Urgent alerts when leaving home with outlets still on',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'critical.wav', // Custom critical sound (must match filename in res/raw/)
      vibrationPattern: null, // Disable vibration to allow custom sound to play
      enableLights: true,
      lightColor: '#FF0000', // Red for urgency
      enableVibrate: false, // Must be false for custom sound to work
      bypassDnd: true, // Bypass Do Not Disturb
      showBadge: true,
    });

    // Regular channel: Other geofence alerts (respects DND, uses normal sound)
    await Notifications.setNotificationChannelAsync('geofence-alerts-v3', {
      name: 'Geofence Alerts',
      description: 'Notifications for geofence activity',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'normal.wav', // Custom normal sound
      vibrationPattern: null, // Disable vibration for custom sound to work
      enableLights: true,
      lightColor: '#0F0E41', // App color
      enableVibrate: false, // Must be false for custom sound to work
      showBadge: true,
    });

    // General channel: Timer completions and other app notifications
    await Notifications.setNotificationChannelAsync('app-notifications-v2', {
      name: 'App Notifications',
      description: 'Timer completions and general app notifications',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'normal.wav', // Custom normal sound
      vibrationPattern: null, // Disable vibration for custom sound to work
      enableLights: true,
      lightColor: '#0F0E41', // App color
      enableVibrate: false, // Must be false for custom sound to work
      showBadge: true,
    });
  }
}

// Call setup on initialization
setupNotificationChannels();

export function GeofenceMonitorProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GeofenceSetting | null>(null);
  const [status, setStatus] = useState<GeofenceStatusState>(INITIAL_STATUS);
  const [pendingRequest, setPendingRequest] = useState<PendingRequestState | null>(null);
  const [isResolvingRequest, setResolvingRequest] = useState(false);

  const lastReportTimestampRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const shownRequestRef = useRef<number | null>(null);
  const previousZoneRef = useRef<GeofenceZone>("INSIDE");
  const previousCountdownActiveRef = useRef<boolean>(false);
const lastLeftZoneAlertRef = useRef<number>(0);
const lastTurnedOnOutsideAlertRef = useRef<{ timestamp: number }>({
  timestamp: 0,
});

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Removed computeRemainingSeconds - now using remainingSeconds from backend

  // Request notification permissions
  const requestNotificationPermissions = useCallback(async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === 'granted';
    } catch (error) {
      console.error('Failed to get notification permissions:', error);
      return false;
    }
  }, []);

  // Play loud alert sound using expo-audio
  const playAlertSound = useCallback(async () => {
    try {
      // Use a loud alarm sound URL
      const soundUri = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

      // For now, we'll rely on the notification sound
      // expo-audio requires a different approach with useAudioPlayer hook
    } catch (error) {
      console.error('Failed to play alert sound:', error);
    }
  }, []);

  // Send notification when leaving geofence or turning on outlets outside
  const sendGeofenceAlert = useCallback(
    async (
      activeOutletCount: number,
      timerSeconds: number,
      reason: 'left_zone' | 'turned_on_outside' = 'left_zone',
      countdownEndsAt?: string | null,
    ) => {
    // Notifications now handled by FCM from backend
    // This function is kept for API compatibility but does nothing
    console.log('[GeofenceMonitor] Geofence alert triggered - handled by FCM:', { activeOutletCount, reason });
    },
    [settings?.isEnabled],
  );

  const updateStatusFromEvaluation = useCallback(
    (evaluation: GeofenceEvaluationResponse) => {
      const previousZone = previousZoneRef.current;
      const previousCountdownActive = previousCountdownActiveRef.current;
      const newZone = evaluation.zone;

      setStatus((prev) => {
        // Determine the countdown end time
        let nextEndsAt: string | null = null;

        if (evaluation.countdownIsActive) {
          if (evaluation.countdownEndsAt) {
            // Backend provided a new countdown end time
            // Only use it if it's earlier than our current countdown OR we don't have one yet
            if (!prev.countdownEndsAt) {
              // New countdown starting
              console.log('[Geofence] Countdown starting, ends at:', evaluation.countdownEndsAt);
              nextEndsAt = evaluation.countdownEndsAt;
            } else {
              // Countdown already active - don't let it jump forward in time
              const newEndTime = new Date(evaluation.countdownEndsAt).getTime();
              const currentEndTime = new Date(prev.countdownEndsAt).getTime();

              if (newEndTime > currentEndTime) {
                // Backend tried to add more time - reject it
                console.warn('[Geofence] Backend tried to extend countdown - keeping original time');
                console.log(`  Current ends: ${prev.countdownEndsAt} (${Math.round((currentEndTime - Date.now()) / 1000)}s remaining)`);
                console.log(`  Backend sent: ${evaluation.countdownEndsAt} (${Math.round((newEndTime - Date.now()) / 1000)}s remaining)`);
                nextEndsAt = prev.countdownEndsAt;
              } else {
                // Backend shortened the countdown or kept it the same - accept it
                nextEndsAt = evaluation.countdownEndsAt;
              }
            }
          } else {
            // Keep existing countdown time
            nextEndsAt = prev.countdownEndsAt;
          }
        }
        // else: countdown not active, nextEndsAt stays null

        return {
          zone: evaluation.zone,
          distanceMeters: evaluation.distanceMeters,
          countdownIsActive: evaluation.countdownIsActive,
          countdownEndsAt: nextEndsAt,
          remainingSeconds: evaluation.remainingSeconds,
        };
      });

      // Detect zone change from INSIDE to OUTSIDE (user left home)
      // Notification is now handled by backend via FCM
      const justLeftZone = previousZone === "INSIDE" && newZone === "OUTSIDE" && evaluation.countdownIsActive;
      if (justLeftZone) {
        const activeOutletCount = evaluation.triggeredOutlets?.length || 0;
        console.log(`[Geofence] Left zone with ${activeOutletCount} outlets on (FCM notification sent by backend)`);
      }

      if (previousCountdownActive && !evaluation.countdownIsActive) {
        lastTurnedOnOutsideAlertRef.current.timestamp = 0;
      }

      // Detect turning on outlets while already outside (countdown activated while zone stays OUTSIDE)
      // Notification is now handled by backend via FCM
      if (
        !justLeftZone &&
        previousZone === "OUTSIDE" &&
        !previousCountdownActive &&
        evaluation.countdownIsActive &&
        (evaluation.triggeredOutlets?.length ?? 0) > 0
      ) {
        const activeOutletCount = evaluation.triggeredOutlets?.length ?? 0;
        console.log(`[Geofence] Turned on ${activeOutletCount} outlets while outside (FCM notification sent by backend)`);
      }

      // Detect zone change from OUTSIDE to INSIDE (user entered home)
      if (previousZone === "OUTSIDE" && newZone === "INSIDE") {
        // Reset notification cooldown when entering zone
        // This allows notification to be sent again if user leaves again
        lastLeftZoneAlertRef.current = 0;
        lastTurnedOnOutsideAlertRef.current.timestamp = 0;
      }

      // Update previous states for next evaluation
      previousZoneRef.current = newZone;
      previousCountdownActiveRef.current = evaluation.countdownIsActive;

      if (evaluation.pendingRequest) {
        setPendingRequest({
          requestId: evaluation.pendingRequest.requestId,
          outletId: evaluation.pendingRequest.outletId,
          initiatedAt: evaluation.pendingRequest.initiatedAt,
          expiresAt: evaluation.pendingRequest.expiresAt,
        });
      } else {
        setPendingRequest(null);
        shownRequestRef.current = null;
      }
    },
    [sendGeofenceAlert],
  );

  const clearIntervals = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const scheduleIntervals = useCallback(() => {
    clearIntervals();
    if (status.countdownIsActive && status.countdownEndsAt) {
      // Removed countdown interval - remainingSeconds now comes from backend polling

      // During countdown, poll location every 5 seconds to detect if user returns home
      // This supplements native geofencing with faster detection during the critical countdown period
      // Native geofencing events (ENTER) might be delayed, so we check frequently during countdown
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lastCoordsRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          void reportLocation(position.coords.latitude, position.coords.longitude, true);
        } catch (error) {
          console.warn("[Geofence] Failed to get location during countdown:", error);
        }
      }, 5000); // Poll every 5 seconds during countdown for faster detection
    }
  }, [clearIntervals, reportLocation, status.countdownEndsAt, status.countdownIsActive]);

  useEffect(() => {
    scheduleIntervals();
    return () => clearIntervals();
  }, [status.countdownIsActive, status.countdownEndsAt, scheduleIntervals, clearIntervals]);

  const stopWatching = useCallback(async () => {
    clearIntervals();
    try {
      await stopGeofencing();
      console.log("[Geofence] Native geofencing stopped");
    } catch (error) {
      console.warn("[Geofence] Failed to stop geofencing:", error);
    }
    lastCoordsRef.current = null;
    lastReportTimestampRef.current = 0;
  }, [clearIntervals]);

  const startWatching = useCallback(async () => {
    if (!settings?.isEnabled || settings.latitude == null || settings.longitude == null) {
      await stopWatching();
      setStatus(INITIAL_STATUS);
      return;
    }

    // Request location permissions (required for geofencing)
    try {
      // First check if we have foreground permission (required before background on Android)
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();

      if (foregroundStatus !== Location.PermissionStatus.GRANTED) {
        // Need foreground first (Android requirement), but only if app is in foreground
        if (AppState.currentState === 'active') {
          const { status: newForegroundStatus } = await Location.requestForegroundPermissionsAsync();
          if (newForegroundStatus !== Location.PermissionStatus.GRANTED) {
            await stopWatching();
            Alert.alert(
              "Location Permission Required",
              "PowerGuard needs location access to detect when you leave home with outlets on.",
            );
            return;
          }
        } else {
          console.warn('[Geofence] Skipping permission request - app not in foreground');
          return;
        }
      }

      // Now request background location permission
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          "Background Location Required",
          "PowerGuard needs background location access to detect when you leave home with outlets on. Please enable 'Allow all the time' in your location settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                void Location.requestBackgroundPermissionsAsync();
              }
            }
          ]
        );
        // Don't return - still try to start geofencing in case permission was granted
      }

      // Start native geofencing (event-driven, battery efficient)
      const success = await startGeofencing(
        settings.latitude,
        settings.longitude,
        settings.radius ?? 1500
      );

      if (success) {
        console.log("[Geofence] Native geofencing started successfully");
      } else {
        console.warn("[Geofence] Failed to start native geofencing");
      }

      // Get initial location for UI display and immediate evaluation
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lastCoordsRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        void reportLocation(position.coords.latitude, position.coords.longitude, true);
      } catch (error) {
        console.warn("[Geofence] Failed to get initial position:", error);
      }

    } catch (error) {
      console.error("[Geofence] Failed to start geofencing:", error);
      Alert.alert(
        "Geofencing Error",
        "Failed to start geofencing. This feature requires a standalone build (not Expo Go)."
      );
    }
  }, [settings?.isEnabled, settings?.latitude, settings?.longitude, settings?.radius, stopWatching, reportLocation]);

  const reportLocation = useCallback(
    async (latitude: number, longitude: number, force = false) => {
      if (!settings?.isEnabled) return;
      const now = Date.now();
      if (!force && now - lastReportTimestampRef.current < 2500) {
        return;
      }
      lastReportTimestampRef.current = now;

      try {
        const evaluation = await api.reportGeofenceLocation(DEFAULT_POWERSTRIP_ID, {
          latitude,
          longitude,
        });
        updateStatusFromEvaluation(evaluation);
      } catch (error) {
        console.error("Failed to report geofence location:", error);
      }
    },
    [settings?.isEnabled, updateStatusFromEvaluation],
  );

  const refreshSettings = useCallback(async () => {
    try {
      const data = await api.getGeofenceSetting(DEFAULT_POWERSTRIP_ID);
      if (data) {
        setSettings(data);
      } else {
        setSettings({
          powerstripID: DEFAULT_POWERSTRIP_ID,
          isEnabled: false,
          radius: 1500,
          autoShutdownTime: 900,
          latitude: undefined,
          longitude: undefined,
          countdownIsActive: false,
          countdownEndsAt: null,
          countdownStartedAt: null,
          lastStatus: "INSIDE",
        });
      }
    } catch (error) {
      console.error("Failed to refresh geofence settings:", error);
    }
  }, []);

  const resolvePendingRequest = useCallback(async () => {
    if (lastCoordsRef.current) {
      await reportLocation(lastCoordsRef.current.latitude, lastCoordsRef.current.longitude, true);
    } else {
      setStatus((prev) => ({ ...prev, countdownIsActive: false, countdownEndsAt: null, remainingSeconds: 0 }));
    }
  }, [reportLocation]);

  const forceGeofenceEvaluation = useCallback(async () => {
    if (!settings?.isEnabled) {
      return;
    }

    try {
      if (lastCoordsRef.current) {
        await reportLocation(lastCoordsRef.current.latitude, lastCoordsRef.current.longitude, true);
        return;
      }

      const currentPosition = await Location.getLastKnownPositionAsync({});
      if (currentPosition) {
        lastCoordsRef.current = {
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude,
        };
        await reportLocation(currentPosition.coords.latitude, currentPosition.coords.longitude, true);
        return;
      }

      const fallbackPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lastCoordsRef.current = {
        latitude: fallbackPosition.coords.latitude,
        longitude: fallbackPosition.coords.longitude,
      };
      await reportLocation(fallbackPosition.coords.latitude, fallbackPosition.coords.longitude, true);
    } catch (error) {
      console.error("Failed to force geofence evaluation:", error);
    }
  }, [reportLocation, settings?.isEnabled]);

  const confirmPendingRequest = useCallback(async () => {
    if (!pendingRequest) {
      return;
    }
    setResolvingRequest(true);
    try {
      await api.confirmAutoShutdown(pendingRequest.requestId);
      setPendingRequest(null);
      shownRequestRef.current = null;
      await refreshSettings();
      await resolvePendingRequest();
      Alert.alert("Geofence", "Outlets turned off as requested.");
    } catch (error) {
      console.error('Failed to confirm auto shutdown:', error);
      Alert.alert("Geofence", "Failed to process auto-shutdown request.");
      shownRequestRef.current = null;
      setPendingRequest((prev) => (prev ? { ...prev } : prev));
    } finally {
      setResolvingRequest(false);
    }
  }, [pendingRequest, refreshSettings, resolvePendingRequest]);

  const cancelPendingRequest = useCallback(async () => {
    if (!pendingRequest) {
      return;
    }
    setResolvingRequest(true);
    try {
      await api.cancelAutoShutdown(pendingRequest.requestId);
      setPendingRequest(null);
      shownRequestRef.current = null;
      await refreshSettings();
      await resolvePendingRequest();
      Alert.alert("Geofence", "Auto-shutdown cancelled. Outlets remain on.");
    } catch (error) {
      console.error('Failed to cancel auto shutdown:', error);
      Alert.alert("Geofence", "Failed to cancel auto-shutdown.");
      shownRequestRef.current = null;
      setPendingRequest((prev) => (prev ? { ...prev } : prev));
    } finally {
      setResolvingRequest(false);
    }
  }, [pendingRequest, refreshSettings, resolvePendingRequest]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  // Request notification permissions on app startup - ONLY in foreground
  useEffect(() => {
    const requestPermissionsWhenReady = async () => {
      // Wait for app to be in foreground to avoid "Background activity launch blocked"
      if (AppState.currentState === 'active') {
        await requestNotificationPermissions();
      }
    };
    void requestPermissionsWhenReady();
  }, [requestNotificationPermissions]);

  useEffect(() => {
    // Only start watching if geofencing is enabled AND has valid coordinates
    // This prevents requesting permissions on app startup
    // When lat/lng/radius changes, startWatching will update the geofence region
    if (settings?.isEnabled && settings.latitude != null && settings.longitude != null) {
      void startWatching();
    } else {
      void stopWatching();
    }
    // IMPORTANT: No cleanup function here!
    // Background geofencing should continue running even when app closes
    // Only stop when user explicitly disables geofencing via settings
    return () => {
      // Only clean up the polling intervals, NOT the native geofencing task
      clearIntervals();
    };
  }, [startWatching, stopWatching, settings?.isEnabled, settings?.latitude, settings?.longitude, settings?.radius, clearIntervals]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active" && settings?.isEnabled) {
        // When app comes to foreground, just get current location once for UI update
        // Background tracking continues regardless of app state
        try {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lastCoordsRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          void reportLocation(position.coords.latitude, position.coords.longitude, true);
        } catch (error) {
          console.warn("[Geofence] Failed to get location on app resume:", error);
        }
      }
      // Background tracking handles inactive/background states automatically
    });

    return () => {
      subscription.remove();
    };
  }, [settings?.isEnabled, reportLocation]);

  useEffect(() => {
    if (!pendingRequest || isResolvingRequest) {
      return;
    }

    if (shownRequestRef.current === pendingRequest.requestId) {
      return;
    }

    shownRequestRef.current = pendingRequest.requestId;

    Alert.alert(
      "Auto Shutdown",
      "Geofence timer completed. Turn off outlets now?",
      [
        {
          text: "Keep On",
          style: "cancel",
          onPress: () => {
            void cancelPendingRequest();
          },
        },
        {
          text: "Turn Off",
          onPress: () => {
            void confirmPendingRequest();
          },
        },
      ],
      { cancelable: false },
    );
  }, [pendingRequest, isResolvingRequest, confirmPendingRequest, cancelPendingRequest]);

  const updateSettingsLocal = useCallback((updates: Partial<GeofenceSetting>) => {
    setSettings((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const value = useMemo<GeofenceMonitorContextValue>(
    () => ({
      settings,
      status,
      pendingRequest,
      isResolvingRequest,
      refreshSettings,
      updateSettingsLocal,
      confirmPendingRequest,
      cancelPendingRequest,
      sendGeofenceAlert,
      forceGeofenceEvaluation,
    }),
    [
      settings,
      status,
      pendingRequest,
      isResolvingRequest,
      refreshSettings,
      updateSettingsLocal,
      confirmPendingRequest,
      cancelPendingRequest,
      sendGeofenceAlert,
      forceGeofenceEvaluation,
    ],
  );

  return (
    <GeofenceMonitorContext.Provider value={value}>{children}</GeofenceMonitorContext.Provider>
  );
}

export function useGeofenceMonitor() {
  const ctx = useContext(GeofenceMonitorContext);
  if (!ctx) {
    throw new Error("useGeofenceMonitor must be used within a GeofenceMonitorProvider");
  }
  return ctx;
}
