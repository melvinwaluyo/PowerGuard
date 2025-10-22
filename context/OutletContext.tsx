import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, OutletLogEntry } from "@/types/outlet";
import { api } from "@/services/api";

interface OutletContextValue {
  outlets: Outlet[];
  toggleOutlet: (id: number) => Promise<void>;
  updateOutlet: (id: number, updates: Partial<Outlet>) => void;
  getOutletById: (id: number) => Outlet | undefined;
  renameOutlet: (id: number, name: string) => Promise<void>;
  refreshOutlets: () => Promise<void>;
  isLoading: boolean;
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

// Helper function to transform backend outlet data to frontend Outlet type
const transformOutlet = (backendOutlet: any): Outlet => {
  const latestUsage = backendOutlet.usageLogs?.[0];
  const power = latestUsage?.power || 0;
  const isOn = backendOutlet.state || false;

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
    timer: backendOutlet.timer ? {
      hours: Math.floor(backendOutlet.timer / 3600),
      minutes: Math.floor((backendOutlet.timer % 3600) / 60),
      seconds: backendOutlet.timer % 60,
      isActive: isOn,
    } : null,
    logs: [], // Logs will be loaded separately in the detail view
  };
};

export function OutletProvider({ children }: { children: ReactNode }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Poll for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshOutlets();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshOutlets]);

  const toggleOutlet = useCallback(async (id: number) => {
    const outlet = outlets.find((o) => o.id === id);
    if (!outlet) return;

    const newState = !outlet.isOn;

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
            }
          : o
      )
    );

    try {
      // Send update to backend
      await api.updateOutletState(id, newState);
    } catch (error) {
      console.error('Failed to toggle outlet:', error);
      // Revert on error
      await refreshOutlets();
    }
  }, [outlets, refreshOutlets]);

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
    () => ({ outlets, toggleOutlet, updateOutlet, getOutletById, renameOutlet, refreshOutlets, isLoading }),
    [outlets, toggleOutlet, updateOutlet, getOutletById, renameOutlet, refreshOutlets, isLoading]
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
