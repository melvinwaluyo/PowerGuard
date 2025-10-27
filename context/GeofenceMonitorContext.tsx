import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Location from "expo-location";
import { AppState, Alert } from "react-native";
import { api, GeofenceSetting, GeofenceEvaluationResponse } from "@/services/api";

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
}

const INITIAL_STATUS: GeofenceStatusState = {
  zone: "INSIDE",
  distanceMeters: null,
  countdownIsActive: false,
  countdownEndsAt: null,
  remainingSeconds: 0,
};

const GeofenceMonitorContext = createContext<GeofenceMonitorContextValue | null>(null);

export function GeofenceMonitorProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GeofenceSetting | null>(null);
  const [status, setStatus] = useState<GeofenceStatusState>(INITIAL_STATUS);
  const [pendingRequest, setPendingRequest] = useState<PendingRequestState | null>(null);
  const [isResolvingRequest, setResolvingRequest] = useState(false);

  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastReportTimestampRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const shownRequestRef = useRef<number | null>(null);

  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const computeRemainingSeconds = useCallback((endsAtIso: string | null): number => {
    if (!endsAtIso) return 0;
    const endsAt = new Date(endsAtIso).getTime();
    if (Number.isNaN(endsAt)) return 0;
    return Math.max(0, Math.round((endsAt - Date.now()) / 1000));
  }, []);

  const updateStatusFromEvaluation = useCallback(
    (evaluation: GeofenceEvaluationResponse) => {
      setStatus((prev) => {
        const nextEndsAt =
          evaluation.countdownEndsAt ?? (evaluation.countdownIsActive ? prev.countdownEndsAt : null);

        return {
          zone: evaluation.zone,
          distanceMeters: evaluation.distanceMeters,
          countdownIsActive: evaluation.countdownIsActive,
          countdownEndsAt: nextEndsAt,
          remainingSeconds: computeRemainingSeconds(nextEndsAt),
        };
      });

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
    [computeRemainingSeconds],
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
      countdownIntervalRef.current = setInterval(() => {
        setStatus((prev) => ({
          ...prev,
          remainingSeconds: computeRemainingSeconds(prev.countdownEndsAt),
        }));
      }, 1000);

      if (lastCoordsRef.current) {
        pollingIntervalRef.current = setInterval(() => {
          void reportLocation(lastCoordsRef.current!.latitude, lastCoordsRef.current!.longitude, true);
        }, 5000); // Poll every 5 seconds during countdown for faster detection
      }
    }
  }, [clearIntervals, computeRemainingSeconds, status.countdownEndsAt, status.countdownIsActive]);

  useEffect(() => {
    scheduleIntervals();
    return () => clearIntervals();
  }, [status.countdownIsActive, status.countdownEndsAt, scheduleIntervals, clearIntervals]);

  const stopWatching = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    clearIntervals();
    lastCoordsRef.current = null;
    lastReportTimestampRef.current = 0;
  }, [clearIntervals]);

  const startWatching = useCallback(async () => {
    if (!settings?.isEnabled || settings.latitude == null || settings.longitude == null) {
      stopWatching();
      setStatus(INITIAL_STATUS);
      return;
    }

    const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
    if (permissionStatus !== Location.PermissionStatus.GRANTED) {
      stopWatching();
      Alert.alert(
        "Geofence",
        "Izin lokasi tidak diberikan. Auto shutdown geofence tidak dapat aktif.",
      );
      return;
    }

    if (watchSubscriptionRef.current) {
      return;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 3000,  // Check every 3 seconds (faster response)
        distanceInterval: 10, // Update when moved 10 meters (more sensitive)
      },
      (location) => {
        const coords = location.coords;
        lastCoordsRef.current = { latitude: coords.latitude, longitude: coords.longitude };
        void reportLocation(coords.latitude, coords.longitude, false);
      },
    );

    watchSubscriptionRef.current = subscription;
  }, [settings?.isEnabled, settings?.latitude, settings?.longitude, stopWatching]);

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
      Alert.alert("Geofence", "Outlet dimatikan sesuai permintaan.");
    } catch (error) {
      console.error('Failed to confirm auto shutdown:', error);
      Alert.alert("Geofence", "Gagal memproses permintaan auto shutdown.");
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
      Alert.alert("Geofence", "Auto shutdown dibatalkan. Outlet tetap menyala.");
    } catch (error) {
      console.error('Failed to cancel auto shutdown:', error);
      Alert.alert("Geofence", "Gagal membatalkan auto shutdown.");
      shownRequestRef.current = null;
      setPendingRequest((prev) => (prev ? { ...prev } : prev));
    } finally {
      setResolvingRequest(false);
    }
  }, [pendingRequest, refreshSettings, resolvePendingRequest]);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    void startWatching();
    return () => {
      stopWatching();
    };
  }, [startWatching, stopWatching, settings?.isEnabled, settings?.latitude, settings?.longitude]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && settings?.isEnabled) {
        void startWatching();
        if (lastCoordsRef.current) {
          void reportLocation(lastCoordsRef.current.latitude, lastCoordsRef.current.longitude, true);
        }
      } else if (state.match(/inactive|background/)) {
        // keep watcher to allow background updates if supported; do nothing
      }
    });

    return () => {
      subscription.remove();
    };
  }, [settings?.isEnabled, startWatching, reportLocation]);

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
      "Timer geofence selesai. Matikan outlet sekarang?",
      [
        {
          text: "Biarkan Menyala",
          style: "cancel",
          onPress: () => {
            void cancelPendingRequest();
          },
        },
        {
          text: "Matikan Outlet",
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
