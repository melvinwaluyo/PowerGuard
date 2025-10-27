import { ScrollView } from "react-native";
import { Outlet } from "@/types/outlet";
import { OutletCard } from "./OutletCard";

interface OutletsListProps {
  outlets: Outlet[];
  onToggleOutlet?: (id: number) => void;
  onPressOutlet?: (outlet: Outlet) => void;
  togglingOutlets?: Set<number>;
}

export function OutletsList({ outlets, onToggleOutlet, onPressOutlet, togglingOutlets }: OutletsListProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingTop: 36, paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      {outlets.map((outlet) => (
        <OutletCard
          key={outlet.id}
          outlet={outlet}
          onToggle={onToggleOutlet}
          onPress={onPressOutlet}
          isToggling={togglingOutlets?.has(outlet.id)}
        />
      ))}
    </ScrollView>
  );
}
