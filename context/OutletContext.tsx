import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { Outlet, TimerSource } from "@/types/outlet";
import { api } from "@/services/api";
import { useGeofenceMonitor } from "@/context/GeofenceMonitorContext";
import * as Notifications from "expo-notifications";

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

const buildTimerState = (backendOutlet: any) => {
  const rawDuration = backendOutlet.timerDuration ?? DEFAULT_TIMER_SECONDS;
  const presetSeconds = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : DEFAULT_TIMER_SECONDS;
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
const transformOutlet = (backendOutlet: any): Outlet => {
  const latestUsage = backendOutlet.usageLogs?.[0];
  const power = latestUsage?.power || 0;
  const isOn = backendOutlet.state || false;
  const { timer, presetSeconds } = buildTimerState(backendOutlet);

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
  const lastNotificationCheckRef = useRef<string>(new Date().toISOString());

  // Access geofence context to check zone status and trigger notifications
  const geofenceContext = useGeofenceMonitor();

  // Fetch outlets from backend
  const refreshOutlets = useCallback(async () => {
    try {
      const data = await api.getOutlets();
      const transformedOutlets = data.map(transformOutlet);
      setOutlets(transformedOutlets);
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      try {
        // Check notifications for all outlets
        for (const outlet of outlets) {
          const notifications = await api.getOutletNotifications(
            outlet.id,
            5,
            lastNotificationCheckRef.current
          );

          // Show push notification for each new notification
          for (const notification of notifications) {
            // Determine notification type based on message content
            const isGeofence = notification.message.includes('Geofence');
            const isTimer = notification.message.includes('Timer completed');

            let title = '🔔 PowerGuard';
            if (isGeofence) {
              title = '📍 Geofence Auto-Shutdown';
            } else if (isTimer) {
              title = '⏰ Timer Completed';
            }

            await Notifications.scheduleNotificationAsync({
              content: {
                title,
                body: notification.message,
                data: { outletId: outlet.id, notificationId: notification.notificationID },
              },
              trigger: null, // Immediate
            });
          }
        }

        // Update last check time
        lastNotificationCheckRef.current = new Date().toISOString();
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
        // Count how many outlets are now ON
        const currentOutlets = await api.getOutlets();
        const activeOutletCount = currentOutlets.filter(o => o.state).length;

        if (activeOutletCount > 0) {
          // Trigger notification - user turned ON outlet(s) while outside
          await geofenceContext.sendGeofenceAlert(
            activeOutletCount,
            geofenceContext.settings?.autoShutdownTime || 900,
            'turned_on_outside'
          );
        }
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
