export interface Outlet {
  id: number;
  name: string;
  status: "Connected" | "Disconnected";
  power: number;
  duration: string | null;
  isOn: boolean;
}
