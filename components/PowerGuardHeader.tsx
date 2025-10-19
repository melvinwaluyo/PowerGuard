import { Platform, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PowerGuardHeaderProps {
  totalPower: number;
}

const BASE_TOP_PADDING = 16;
const BASE_BOTTOM_PADDING = 20;

export function PowerGuardHeader({ totalPower }: PowerGuardHeaderProps) {
  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === "android"
    ? (StatusBar.currentHeight ?? 0) + BASE_TOP_PADDING
    : insets.top + BASE_TOP_PADDING;

  return (
    <View
      className="bg-[#0F0E41] px-6"
      style={{ paddingTop: topInset, paddingBottom: BASE_BOTTOM_PADDING }}
    >
      <Text className="text-white text-[24px] font-bold text-center">
        PowerGuard
      </Text>
      <View
        className="bg-white rounded-full py-2 px-5 mt-3 self-center"
        style={{
          shadowColor: "#0F0E41",
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Text className="text-[#0F0E41] font-semibold text-sm">
          Total Power Draw: {totalPower} W
        </Text>
      </View>
    </View>
  );
}
