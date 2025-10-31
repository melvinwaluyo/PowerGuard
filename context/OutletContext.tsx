import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { Outlet, TimerSource } from "@/types/outlet";
import { api } from "@/services/api";
import { useGeofenceMonitor } from "@/context/GeofenceMonitorContext";
import { getLastTimerSeconds } from "@/utils/timerStorage";

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

  if (isActive) {
    console.log(`[OutletContext] buildTimerState for outlet ${backendOutlet.outletID}:`, {
      rawDuration,
      presetSeconds,
      endsAtRaw: endsAtRaw?.toISOString(),
      remainingSeconds,
      isActive,
    });
  }

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
  // Notification tracking removed - FCM handles all notifications

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

  // Notification polling removed - all notifications now sent via FCM from backend
  // FCM handles notifications whether app is open or closed

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
