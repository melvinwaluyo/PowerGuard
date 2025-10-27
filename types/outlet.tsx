export type OutletConnectionStatus = "Connected" | "Disconnected";

export type OutletLogCategory = "power" | "automation" | "safety" | "maintenance";

export type TimerSource = "MANUAL" | "GEOFENCE";

export interface OutletLogEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  category: OutletLogCategory;
}

export type TimerLogStatus =
  | "STARTED"
  | "STOPPED"
  | "COMPLETED"
  | "AUTO_CANCELLED"
  | "POWER_OFF"
  | "REPLACED";

export interface OutletTimerLog {
  id: number;
  status: TimerLogStatus;
  durationSeconds: number | null;
  remainingSeconds: number | null;
  note?: string | null;
  timestamp: string;
  source?: TimerSource | null;
}

export interface OutletTimerState {
  isActive: boolean;
  durationSeconds: number;
  remainingSeconds: number;
  endsAt: string | null;
  source: TimerSource | null;
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
  timer: OutletTimerState | null;
  timerPresetSeconds: number;
  logs: OutletLogEntry[];
  timerLogs?: OutletTimerLog[];
}
