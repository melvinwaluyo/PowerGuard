export type OutletConnectionStatus = "Connected" | "Disconnected";

export type OutletLogCategory = "power" | "automation" | "safety" | "maintenance";

export interface OutletLogEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  category: OutletLogCategory;
}

export interface OutletTimerSetting {
  hours: number;
  minutes: number;
  seconds: number;
  isActive: boolean;
}

export interface Outlet {
  id: number;
  name: string;
  status: OutletConnectionStatus;
  power: number;
  duration: string | null;
  isOn: boolean;
  runtime: string;
  powerDraw: number;
  connection: OutletConnectionStatus;
  timer: OutletTimerSetting | null;
  logs: OutletLogEntry[];
}
