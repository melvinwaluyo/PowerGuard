import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { Platform } from "react-native";
import { Outlet, TimerSource } from "@/types/outlet";
import { api } from "@/services/api";
import { useGeofenceMonitor } from "@/context/GeofenceMonitorContext";
import * as Notifications from "expo-notifications";
import { getLastTimerSeconds } from "@/utils/timerStorage";
import { getShownNotificationIds, saveShownNotificationIds } from "@/utils/notificationTracking";

interface OutletContextValue {
  outlets: Outlet[];
  toggleOutlet: (id: number) => Promise<void>;
  updateOutlet: (id: number, updates: Partial<Outlet>) => void;
  getOutletById: (id: number) => Outlet | undefined;
  renameOutlet: (id: number, name: string) => Promise<void>;
  refreshOutlets: () => Promise<void>;
  isLoading: boolean;
  togglingOutlets: Set<number>; // Track which outlets are currently being toggled
}

const OutletContext = createContext<OutletContextValue | null>(null);

// Helper function to format seconds to HH:MM:SS
const formatRuntime = (seconds: number | null): string => {
  if (!seconds) return "00:00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const DEFAULT_TIMER_SECONDS = 15 * 60;

const buildTimerState = (backendOutlet: any, fallbackDefault: number = DEFAULT_TIMER_SECONDS) => {
  const rawDuration = backendOutlet.timerDuration ?? fallbackDefault;
  const presetSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : fallbackDefault;
  const endsAtRaw = backendOutlet.timerEndsAt ? new Date(backendOutlet.timerEndsAt) : null;
  const isActive = Boolean(backendOutlet.timerIsActive && endsAtRaw);
  const remainingSeconds =
    isActive && endsAtRaw
      ? Math.max(0, Math.round((endsAtRaw.getTime() - Date.now()) / 1000))
      : presetSeconds;

  return {
    timer: {
      isActive,
      durationSeconds: presetSeconds,
      remainingSeconds,
      endsAt: endsAtRaw ? endsAtRaw.toISOString() : null,
      source: (backendOutlet.timerSource as TimerSource | null) ?? null,
    },
    presetSeconds,
  };
};

// Helper function to transform backend outlet data to frontend Outlet type
const transformOutlet = (backendOutlet: any, fallbackDefault?: number): Outlet => {
  const latestUsage = backendOutlet.usageLogs?.[0];
  const power = latestUsage?.power || 0;
  const isOn = backendOutlet.state || false;
  const { timer, presetSeconds } = buildTimerState(backendOutlet, fallbackDefault);

  return {
    id: backendOutlet.outletID,
    name: backendOutlet.name || `Outlet ${backendOutlet.index || backendOutlet.outletID}`,
    status: isOn ? "Connected" : "Disconnected",
    power: power,
    duration: isOn && backendOutlet.runtime ? formatRuntime(backendOutlet.runtime) : null,
    isOn: isOn,
    runtime: formatRuntime(backendOutlet.runtime),
    powerDraw: isOn ? power : 0,
    connection: isOn ? "Connected" : "Disconnected",
    timer,
    timerPresetSeconds: presetSeconds,
    logs: [], // Logs will be loaded separately in the detail view
  };
};

export function OutletProvider({ children }: { children: ReactNode }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [togglingOutlets, setTogglingOutlets] = useState<Set<number>>(new Set());
  const [lastTimerDefault, setLastTimerDefault] = useState<number>(DEFAULT_TIMER_SECONDS);
  const lastNotificationCheckRef = useRef<string>(new Date().toISOString());
  const shownNotificationIds = useRef<Set<number>>(new Set()); // Track shown notifications to prevent duplicates
  const lastGeofenceShutdownNotificationRef = useRef<{ timestamp: number; message: string | null; outletCount: number }>({
    timestamp: 0,
    message: null,
    outletCount: 0,
  });
  const geofenceShutdownBufferRef = useRef<{
    timeout: ReturnType<typeof setTimeout> | null;
    bestNotification: any;
    bestCount: number;
    outletId: number | null;
  }>({
    timeout: null,
    bestNotification: null,
    bestCount: 0,
    outletId: null,
  });

  // Access geofence context to check zone status and trigger notifications
  const geofenceContext = useGeofenceMonitor();

  // Load last timer default on mount
  useEffect(() => {
    const loadTimerDefault = async () => {
      const lastTimer = await getLastTimerSeconds();
      setLastTimerDefault(lastTimer);
    };
    void loadTimerDefault();
  }, []);

  // Load shown notification IDs from AsyncStorage on mount
  useEffect(() => {
    const loadShownIds = async () => {
      const ids = await getShownNotificationIds();
      shownNotificationIds.current = ids;
      console.log(`[Notifications] Loaded ${ids.size} shown notification IDs from storage`);
    };
    void loadShownIds();
  }, []);

  // Save shown notification IDs to AsyncStorage on unmount and periodically
  useEffect(() => {
    const saveInterval = setInterval(() => {
      void saveShownNotificationIds(shownNotificationIds.current);
    }, 30000); // Save every 30 seconds

    return () => {
      clearInterval(saveInterval);
      // Save on unmount
      void saveShownNotificationIds(shownNotificationIds.current);
    };
  }, []);

  // Reset geofence shutdown notification cooldown when countdown is no longer active
  useEffect(() => {
    if (!geofenceContext.status.countdownIsActive) {
      lastGeofenceShutdownNotificationRef.current = {
        timestamp: 0,
        message: null,
        outletCount: 0,
      };
    }
  }, [geofenceContext.status.countdownIsActive]);

  // Fetch outlets from backend
  const refreshOutlets = useCallback(async () => {
    try {
      const data = await api.getOutlets();
      const transformedOutlets = data.map((outlet) => transformOutlet(outlet, lastTimerDefault));
      setOutlets(transformedOutlets);
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
    } finally {
      setIsLoading(false);
    }
  }, [lastTimerDefault]);

  // Load outlets on mount
  useEffect(() => {
    refreshOutlets();
  }, [refreshOutlets]);

  // Poll for updates every 5 seconds (but skip if outlets are being toggled)
  useEffect(() => {
    const interval = setInterval(() => {
      // Don't refresh if any outlets are currently being toggled
      // This prevents the poll from overwriting optimistic updates
      if (togglingOutlets.size === 0) {
        refreshOutlets();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshOutlets, togglingOutlets]);

  // Poll for new notifications every 10 seconds
  useEffect(() => {
    const checkNotifications = async () => {
      const lastCheckTimestamp = lastNotificationCheckRef.current;
      const checkStartedAt = new Date().toISOString();
      let latestNotificationTimestamp = lastCheckTimestamp;

      const normalizeCreatedAt = (value: unknown): string | null => {
        if (!value) return null;
        const date = value instanceof Date ? value : new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
      };

      const updateLatestTimestamp = (candidate: string | null) => {
        if (!candidate) return;
        if (!latestNotificationTimestamp || candidate > latestNotificationTimestamp) {
          latestNotificationTimestamp = candidate;
        }
      };

      try {
        // Check notifications for all outlets
        type OutletNotification = Awaited<ReturnType<typeof api.getOutletNotifications>>[number];
        const aggregatedGeofenceShutdowns: Array<{ notification: OutletNotification; outletId: number }> = [];

        const extractOutletCount = (message?: string | null): number => {
          if (!message) return 0;
          const match = message.match(/(\d+)\s+outlet/i);
          if (match) {
            const parsed = Number.parseInt(match[1], 10);
            if (Number.isFinite(parsed)) {
              return parsed;
            }
          }

          const listMatch = message.match(/\(([^)]+)\)/);
          if (listMatch) {
            const outlets = listMatch[1]
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);
            if (outlets.length > 0) {
              return outlets.length;
            }
          }
          return 0;
        };

        const enqueueGeofenceNotification = (notification: OutletNotification, sourceOutletId: number) => {
          const message = notification.message ?? "";
          const now = Date.now();
          const count = extractOutletCount(message);

          // Use a shorter 2-second cooldown for geofence shutdown notifications
          // This prevents duplicates while still allowing legitimate notifications
          const lastSent = lastGeofenceShutdownNotificationRef.current;
          if (now - lastSent.timestamp < 2000 && count <= lastSent.outletCount) {
            return;
          }

          const buffer = geofenceShutdownBufferRef.current;
          if (!buffer.timeout) {
            buffer.bestNotification = notification;
            buffer.bestCount = count;
            buffer.outletId = sourceOutletId;
            buffer.timeout = setTimeout(() => {
              const currentBuffer = geofenceShutdownBufferRef.current;
              const best = currentBuffer.bestNotification;
              const bestCount = currentBuffer.bestCount;
              const bestOutletId = currentBuffer.outletId ?? sourceOutletId;

              currentBuffer.timeout = null;
              currentBuffer.bestNotification = null;
              currentBuffer.bestCount = 0;
              currentBuffer.outletId = null;

              if (!best) {
                return;
              }

              const bestMessage = best.message ?? "";
              void Notifications.scheduleNotificationAsync({
                content: {
                  title: "📍 Geofence Auto-Shutdown",
                  body: bestMessage,
                  sound: 'normal.wav',
                  vibrate: false,
                  data: { outletId: bestOutletId, notificationId: best.notificationID },
                },
                trigger: null,
                ...(Platform.OS === 'android' ? { channelId: 'geofence-alerts-v2' } : {}),
              })
                .then(() => {
                  lastGeofenceShutdownNotificationRef.current = {
                    timestamp: Date.now(),
                    message: bestMessage,
                    outletCount: bestCount,
                  };
                })
                .catch((error) => {
                  console.error("Failed to send geofence shutdown notification:", error);
                });
            }, 750);
          } else if (count > buffer.bestCount) {
            buffer.bestNotification = notification;
            buffer.bestCount = count;
            buffer.outletId = sourceOutletId;
          }
        };

        for (const outlet of outlets) {
          const notifications = await api.getOutletNotifications(
            outlet.id,
            5,
            lastCheckTimestamp
          );

          // Show push notification for each new notification
          const geofenceShutdownNotifications: typeof notifications = [];
          const otherNotifications: Array<{
            notification: (typeof notifications)[number];
            isGeofence: boolean;
            isTimer: boolean;
          }> = [];

          for (const notification of notifications) {
            const notificationId = typeof notification.notificationID === 'number' ? notification.notificationID : 0;

            // Skip if we've already shown this notification
            if (shownNotificationIds.current.has(notificationId)) {
              console.log(`[Notifications] Skipping duplicate notification ${notificationId}`);
              continue;
            }

            const message = notification.message ?? "";
            const isGeofence = message.includes("Geofence");
            const isTimer = message.includes("Timer completed");
            const isGeofenceShutdown =
              isGeofence && /turned off/i.test(message) && !/auto-shutdown\s+countdown/i.test(message);
            updateLatestTimestamp(normalizeCreatedAt(notification.createdAt));

            if (isGeofenceShutdown) {
              geofenceShutdownNotifications.push(notification);
              shownNotificationIds.current.add(notificationId);
              continue;
            }

            otherNotifications.push({ notification, isGeofence, isTimer });
            shownNotificationIds.current.add(notificationId);

            if (isTimer) {
              console.log(`[Notifications] New timer completion notification ${notificationId} for outlet ${outlet.id}: "${message}"`);
            }
          }

          for (const { notification, isGeofence, isTimer } of otherNotifications) {
            let title = "🔔 PowerGuard";
            if (isGeofence) {
              title = "📍 Geofence Auto-Shutdown";
            } else if (isTimer) {
              title = "⏰ Timer Completed";
            }

            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body: notification.message ?? "",
                sound: 'normal.wav',
                vibrate: false,
                data: { outletId: outlet.id, notificationId: notification.notificationID },
              },
              trigger: null, // Immediate
              ...(Platform.OS === 'android' ? { channelId: 'app-notifications' } : {}),
            });
          }

          if (geofenceShutdownNotifications.length > 0) {
            for (const notification of geofenceShutdownNotifications) {
              aggregatedGeofenceShutdowns.push({ notification, outletId: outlet.id });
              updateLatestTimestamp(normalizeCreatedAt(notification.createdAt));
            }
          }
        }

        if (aggregatedGeofenceShutdowns.length > 0) {
          aggregatedGeofenceShutdowns.sort((a, b) => {
            const countA = extractOutletCount(a.notification.message);
            const countB = extractOutletCount(b.notification.message);
            if (countA === countB) {
              const idA = typeof a.notification.notificationID === "number" ? a.notification.notificationID : 0;
              const idB = typeof b.notification.notificationID === "number" ? b.notification.notificationID : 0;
              return idB - idA;
            }
            return countB - countA;
          });

          for (const entry of aggregatedGeofenceShutdowns) {
            enqueueGeofenceNotification(entry.notification, entry.outletId);
          }
        }

        // Update last check time using the latest notification timestamp we observed
        const nextCursor =
          latestNotificationTimestamp && latestNotificationTimestamp > checkStartedAt
            ? latestNotificationTimestamp
            : checkStartedAt;
        lastNotificationCheckRef.current = nextCursor;
      } catch (error) {
        console.error('Error checking notifications:', error);
      }
    };

    // Initial check after 5 seconds
    const initialTimeout = setTimeout(checkNotifications, 5000);

    // Then check every 10 seconds
    const interval = setInterval(checkNotifications, 10000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      if (geofenceShutdownBufferRef.current.timeout) {
        clearTimeout(geofenceShutdownBufferRef.current.timeout);
        geofenceShutdownBufferRef.current.timeout = null;
      }
    };
  }, [outlets]);

  const toggleOutlet = useCallback(async (id: number) => {
    // Prevent toggling if already in progress
    if (togglingOutlets.has(id)) {
      return;
    }

    const outlet = outlets.find((o) => o.id === id);
    if (!outlet) return;

    const newState = !outlet.isOn;

    // Mark outlet as toggling
    setTogglingOutlets((prev) => new Set(prev).add(id));

    // Optimistically update UI
    setOutlets((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              isOn: newState,
              status: newState ? "Connected" : "Disconnected",
              connection: newState ? "Connected" : "Disconnected",
              powerDraw: newState ? o.power : 0,
              duration: newState ? o.runtime : null,
              timer: o.timer
                ? {
                    ...o.timer,
                    isActive: newState ? o.timer.isActive : false,
                    remainingSeconds: newState
                      ? o.timer.remainingSeconds
                      : o.timer.durationSeconds,
                    endsAt: newState ? o.timer.endsAt : null,
                  }
                : null,
            }
          : o
      )
    );

    try {
      // Send update to backend
      await api.updateOutletState(id, newState);

      // Add a small delay before allowing next toggle (500ms cooldown)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh to get confirmed state from backend
      await refreshOutlets();

      // Check if outlet was turned ON while outside geofence zone
      if (newState && geofenceContext.settings?.isEnabled && geofenceContext.status.zone === "OUTSIDE") {
        // Force backend evaluation which will handle notification aggregation
        await geofenceContext.forceGeofenceEvaluation();
      }
    } catch (error) {
      console.error('Failed to toggle outlet:', error);
      // Revert on error
      await refreshOutlets();
    } finally {
      // Remove outlet from toggling set
      setTogglingOutlets((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [outlets, togglingOutlets, refreshOutlets, geofenceContext]);

  const updateOutlet = useCallback((id: number, updates: Partial<Outlet>) => {
    setOutlets((prev) =>
      prev.map((outlet) => (outlet.id === id ? { ...outlet, ...updates } : outlet))
    );
  }, []);

  const renameOutlet = useCallback(async (id: number, name: string) => {
    // Optimistically update UI
    setOutlets((prev) =>
      prev.map((o) => (o.id === id ? { ...o, name } : o))
    );

    try {
      // Send update to backend
      await api.updateOutletName(id, name);
    } catch (error) {
      console.error('Failed to rename outlet:', error);
      // Revert on error
      await refreshOutlets();
    }
  }, [refreshOutlets]);

  const getOutletById = useCallback(
    (id: number) => outlets.find((outlet) => outlet.id === id),
    [outlets]
  );

  const value = useMemo(
    () => ({ outlets, toggleOutlet, updateOutlet, getOutletById, renameOutlet, refreshOutlets, isLoading, togglingOutlets }),
    [outlets, toggleOutlet, updateOutlet, getOutletById, renameOutlet, refreshOutlets, isLoading, togglingOutlets]
  );

  return <OutletContext.Provider value={value}>{children}</OutletContext.Provider>;
}

export function useOutlets() {
  const context = useContext(OutletContext);

  if (!context) {
    throw new Error("useOutlets must be used within an OutletProvider");
  }

  return context;
}
