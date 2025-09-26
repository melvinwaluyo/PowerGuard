import { ScrollView } from "react-native";
import { OutletCard } from "./OutletCard";

interface Outlet {
  id: number;
  name: string;
  status: string;
  power: number;
  duration: string | null;
  isOn: boolean;
}

interface OutletsListProps {
  outlets: Outlet[];
  onToggleOutlet?: (id: number) => void;
}

export function OutletsList({ outlets, onToggleOutlet }: OutletsListProps) {
  return (
    <ScrollView className="flex-1 pt-6" showsVerticalScrollIndicator={false}>
      {outlets.map((outlet) => (
        <OutletCard key={outlet.id} outlet={outlet} onToggle={onToggleOutlet} />
      ))}
    </ScrollView>
  );
}
