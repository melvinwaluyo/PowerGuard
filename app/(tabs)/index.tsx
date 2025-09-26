import { useState } from "react";
import { View } from "react-native";
import "../../global.css";

import { BottomNavigation } from "@/components/BottomNavigation";
import { OutletsList } from "@/components/OutletsList";
import { PowerGuardHeader } from "@/components/PowerGuardHeader";
import { Outlet } from "@/types/outlet";

export default function App() {
  const [outlets, setOutlets] = useState<Outlet[]>([
    {
      id: 1,
      name: "Outlet 1",
      status: "Disconnected",
      power: 250,
      duration: null,
      isOn: false,
    },
    {
      id: 2,
      name: "Outlet 2",
      status: "Connected",
      power: 250,
      duration: "2h 5m 45s",
      isOn: true,
    },
    {
      id: 3,
      name: "Outlet 3",
      status: "Disconnected",
      power: 0,
      duration: null,
      isOn: false,
    },
    {
      id: 4,
      name: "Outlet 4",
      status: "Connected",
      power: 250,
      duration: "2h 5m 45s",
      isOn: true,
    },
  ]);

  const totalPower = outlets.reduce(
    (sum, outlet) => sum + (outlet.isOn ? outlet.power : 0),
    0
  );

  const handleToggleOutlet = (id: number) => {
    setOutlets((prev) =>
      prev.map((outlet) =>
        outlet.id === id
          ? {
              ...outlet,
              isOn: !outlet.isOn,
              status: !outlet.isOn ? "Connected" : "Disconnected",
              power: !outlet.isOn ? 250 : 0,
            }
          : outlet
      )
    );
  };

  return (
    <View className="flex-1 bg-[#E7E7E7]">
      <PowerGuardHeader totalPower={totalPower} />
      <View className="flex-1">
        <OutletsList outlets={outlets} onToggleOutlet={handleToggleOutlet} />
      </View>
      <BottomNavigation />
    </View>
  );
}
