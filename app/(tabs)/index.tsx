import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import "../../global.css";

import { BottomNavigation } from "@/components/BottomNavigation";
import { OutletsList } from "@/components/OutletsList";
import { PowerGuardHeader } from "@/components/PowerGuardHeader";
import { useOutlets } from "@/context/OutletContext";
import { Outlet } from "@/types/outlet";

export default function App() {
  const router = useRouter();
  const { outlets, toggleOutlet, togglingOutlets } = useOutlets();

  const totalPower = useMemo(
    () => outlets.reduce((sum, outlet) => sum + (outlet.isOn ? outlet.powerDraw : 0), 0),
    [outlets]
  );

  const handlePressOutlet = (outlet: Outlet) => {
    router.push({ pathname: "/outlet/[id]", params: { id: String(outlet.id) } });
  };

  return (
    <View className="flex-1 bg-[#E7E7E7]">
      <PowerGuardHeader totalPower={totalPower} />
      <View className="flex-1">
        <OutletsList
          outlets={outlets}
          onToggleOutlet={toggleOutlet}
          onPressOutlet={handlePressOutlet}
          togglingOutlets={togglingOutlets}
        />
      </View>
      <BottomNavigation activeTab="home" />
    </View>
  );
}
