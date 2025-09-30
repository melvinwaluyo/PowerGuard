import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import { Outlet } from "@/types/outlet";
import ClockIcon from "../assets/images/Clock.svg";
import FlashIcon from "../assets/images/FlashOn.svg";
import SocketIcon from "../assets/images/Socket.svg";

interface OutletCardProps {
  outlet: Outlet;
  onToggle?: (id: number) => void;
  onPress?: (outlet: Outlet) => void;
}

const STATUS_STYLES: Record<string, { container: string; text: string }> = {
  Connected: {
    container: "bg-[#9BF1AE]",
    text: "text-[#176D38]",
  },
  Disconnected: {
    container: "bg-[#E2E2E2]",
    text: "text-[#55596A]",
  },
  default: {
    container: "bg-[#D1D5DB]",
    text: "text-[#1F2937]",
  },
};

const CARD_SHADOW = {
  shadowColor: "#0F0E41",
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 12 },
  shadowRadius: 22,
  elevation: 9,
};

export function OutletCard({ outlet, onToggle, onPress }: OutletCardProps) {
  const statusStyle = STATUS_STYLES[outlet.status] ?? STATUS_STYLES.default;
  const windowWidth = Dimensions.get("window").width;
  const iconSize = Math.round(Math.max(50, Math.min(62, windowWidth * 0.14)));

  return (
    <View
      className="bg-white border border-[#EAECF5] rounded-[28px] mx-5 mb-6 px-6 py-5"
      style={CARD_SHADOW}
    >
      <View className="flex-row items-center">
        <TouchableOpacity
          activeOpacity={onPress ? 0.85 : 1}
          disabled={!onPress}
          onPress={() => onPress?.(outlet)}
          className="flex-1 pr-3"
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-[20px] font-semibold text-[#4C4C66]">
              {outlet.name}
            </Text>
            <View className={`px-3 py-1 rounded-full ${statusStyle.container}`}>
              <Text className={`text-[11px] font-semibold ${statusStyle.text}`}>
                {outlet.status}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <View className="mr-6">
              <SocketIcon width={iconSize} height={iconSize} color="#0F0E41" />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center mb-2.5">
                <FlashIcon width={18} height={18} color="#0F0E41" />
                <Text className="ml-2 text-[15px] font-semibold text-[#0F0E41]">
                  {`${outlet.powerDraw} W`}
                </Text>
              </View>

              <View className="flex-row items-center">
                <ClockIcon width={17} height={17} color="#55596A" />
                <Text className="ml-2 text-[13px] font-medium text-[#6E6F82]">
                  {outlet.duration ?? "-"}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onToggle?.(outlet.id)}
          className={`rounded-full p-1 justify-center ${
            outlet.isOn ? "bg-[#0F0E41]" : "bg-[#E2E5EE]"
          }`}
          style={{ width: 64, height: 36 }}
        >
          <View
            className="rounded-full bg-white"
            style={{
              width: 28,
              height: 28,
              alignSelf: outlet.isOn ? "flex-end" : "flex-start",
            }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
