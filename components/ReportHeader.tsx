import { Platform, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE_TOP_PADDING = 16;

export function ReportHeader() {
  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === "android"
    ? (StatusBar.currentHeight ?? 0) + BASE_TOP_PADDING
    : insets.top + BASE_TOP_PADDING;

  return (
    <View
      className="bg-[#0F0E41] px-6"
      style={{ paddingTop: topInset, paddingBottom: 20 }}
    >
      <Text className="text-white text-[24px] font-bold text-center">
        Reporting
      </Text>
    </View>
  );
}