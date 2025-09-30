import { Platform, StatusBar, Text, View } from "react-native";

interface PowerGuardHeaderProps {
  totalPower: number;
}

const BASE_TOP_PADDING = 32;
const BASE_BOTTOM_PADDING = 40;

export function PowerGuardHeader({ totalPower }: PowerGuardHeaderProps) {
  const topInset =
    (Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0) +
    BASE_TOP_PADDING;

  return (
    <View
      className="bg-[#0F0E41] px-6 rounded-b-[16px]"
      style={{ paddingTop: topInset, paddingBottom: BASE_BOTTOM_PADDING }}
    >
      <Text className="text-white text-[34px] leading-[42px] font-extrabold text-center">
        PowerGuard
      </Text>
      <View
        className="bg-white rounded-full py-2.5 px-7 mt-5 self-center"
        style={{
          shadowColor: "#0F0E41",
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        <Text className="text-[#0F0E41] font-semibold text-base">
          Total Power Draw : {totalPower} W
        </Text>
      </View>
    </View>
  );
}
