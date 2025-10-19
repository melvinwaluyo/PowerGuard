import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Outlet, OutletLogEntry } from "@/types/outlet";

interface OutletContextValue {
  outlets: Outlet[];
  toggleOutlet: (id: number) => void;
  updateOutlet: (id: number, updates: Partial<Outlet>) => void;
  getOutletById: (id: number) => Outlet | undefined;
}

const OutletContext = createContext<OutletContextValue | null>(null);

const createId = () => Math.random().toString(36).slice(2, 12);

const createLog = (overrides: Partial<OutletLogEntry>): OutletLogEntry => ({
  id: createId(),
  timestamp: new Date().toISOString(),
  action: "",
  detail: "",
  category: "power",
  ...overrides,
});

const DEFAULT_OUTLETS: Outlet[] = [
  {
    id: 1,
    name: "Outlet 1",
    status: "Disconnected",
    power: 250,
    duration: null,
    isOn: false,
    runtime: "00:00:00",
    powerDraw: 0,
    connection: "Disconnected",
    timer: null,
    logs: [
      createLog({
        timestamp: "2025-05-09T15:20:00.000Z",
        action: "Auto shutdown",
        detail: "Timer ended after scheduled 45 minutes",
        category: "automation",
      }),
      createLog({
        timestamp: "2025-05-09T14:35:00.000Z",
        action: "Timer scheduled",
        detail: "Countdown set for 45 minutes",
        category: "automation",
      }),
    ],
  },
  {
    id: 2,
    name: "Outlet 2",
    status: "Connected",
    power: 250,
    duration: "2h 5m 45s",
    isOn: true,
    runtime: "12:45:32",
    powerDraw: 250,
    connection: "Connected",
    timer: {
      hours: 0,
      minutes: 15,
      seconds: 0,
      isActive: true,
    },
    logs: [
      createLog({
        timestamp: "2025-05-11T17:34:00.000Z",
        action: "Outlet turned on",
        detail: "Manual activation via app",
        category: "power",
      }),
      createLog({
        timestamp: "2025-05-11T16:12:00.000Z",
        action: "Auto shutdown",
        detail: "Turned off after no response to alert",
        category: "safety",
      }),
      createLog({
        timestamp: "2025-05-11T15:58:00.000Z",
        action: "Device connected",
        detail: "New device detected on outlet",
        category: "maintenance",
      }),
      createLog({
        timestamp: "2025-05-11T15:34:00.000Z",
        action: "Timer set",
        detail: "Duration configured for 2h 5m 45s",
        category: "automation",
      }),
    ],
  },
  {
    id: 3,
    name: "Outlet 3",
    status: "Disconnected",
    power: 200,
    duration: null,
    isOn: false,
    runtime: "00:00:00",
    powerDraw: 0,
    connection: "Disconnected",
    timer: null,
    logs: [
      createLog({
        timestamp: "2025-05-10T09:35:00.000Z",
        action: "Energy limit reached",
        detail: "Power cut after exceeding configured limit",
        category: "safety",
      }),
    ],
  },
  {
    id: 4,
    name: "Outlet 4",
    status: "Connected",
    power: 180,
    duration: "45m",
    isOn: true,
    runtime: "04:18:09",
    powerDraw: 180,
    connection: "Connected",
    timer: {
      hours: 1,
      minutes: 0,
      seconds: 0,
      isActive: false,
    },
    logs: [
      createLog({
        timestamp: "2025-05-08T11:20:00.000Z",
        action: "Firmware update",
        detail: "Outlet restarted after maintenance",
        category: "maintenance",
      }),
      createLog({
        timestamp: "2025-05-08T10:55:00.000Z",
        action: "Outlet turned on",
        detail: "Manual activation via app",
        category: "power",
      }),
    ],
  },
];

export function OutletProvider({ children }: { children: ReactNode }) {
  const [outlets, setOutlets] = useState<Outlet[]>(DEFAULT_OUTLETS);

  const toggleOutlet = useCallback((id: number) => {
    setOutlets((prev) =>
      prev.map((outlet) => {
        if (outlet.id !== id) {
          return outlet;
        }

        const nextIsOn = !outlet.isOn;
        const nextTimer = outlet.timer
          ? { ...outlet.timer, isActive: nextIsOn ? outlet.timer.isActive : false }
          : null;
        const toggleLog: OutletLogEntry = {
          id: createId(),
          timestamp: new Date().toISOString(),
          action: nextIsOn ? "Outlet turned on" : "Outlet turned off",
          detail: "Manual toggle via app",
          category: "power",
        };

        return {
          ...outlet,
          isOn: nextIsOn,
          status: nextIsOn ? "Connected" : "Disconnected",
          connection: nextIsOn ? "Connected" : "Disconnected",
          powerDraw: nextIsOn ? outlet.power : 0,
          duration: nextIsOn ? outlet.runtime : null,
          timer: nextTimer,
          logs: [toggleLog, ...outlet.logs],
        };
      })
    );
  }, []);

  const updateOutlet = useCallback((id: number, updates: Partial<Outlet>) => {
    setOutlets((prev) =>
      prev.map((outlet) => (outlet.id === id ? { ...outlet, ...updates } : outlet))
    );
  }, []);

  const getOutletById = useCallback(
    (id: number) => outlets.find((outlet) => outlet.id === id),
    [outlets]
  );

  const value = useMemo(
    () => ({ outlets, toggleOutlet, updateOutlet, getOutletById }),
    [outlets, toggleOutlet, updateOutlet, getOutletById]
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
