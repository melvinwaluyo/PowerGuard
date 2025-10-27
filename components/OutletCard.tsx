import { Text, TouchableOpacity, View } from "react-native";
import { Outlet } from "@/types/outlet";
import ClockIcon from "../assets/images/Clock.svg";
import FlashIcon from "../assets/images/FlashOn.svg";
import SocketIcon from "../assets/images/Socket.svg";

interface OutletCardProps {
  outlet: Outlet;
  onToggle?: (id: number) => void;
  onPress?: (outlet: Outlet) => void;
  isToggling?: boolean;
}

const STATUS_STYLES: Record<string, { container: string; text: string }> = {
  Connected: {
    container: "bg-[#C9F9D4]",
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
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 8,
  elevation: 3,
};

export function OutletCard({ outlet, onToggle, onPress, isToggling = false }: OutletCardProps) {
  const statusStyle = STATUS_STYLES[outlet.status] ?? STATUS_STYLES.default;

  return (
    <View
      className="bg-white rounded-[20px] mx-4 mb-3 px-4 py-4"
      style={CARD_SHADOW}
    >
      <TouchableOpacity
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress}
        onPress={() => onPress?.(outlet)}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[17px] font-semibold text-[#0F0E41]">
            {outlet.name}
          </Text>
          <View className={`px-2.5 py-1 rounded-full ${statusStyle.container}`}>
            <Text className={`text-[10px] font-semibold ${statusStyle.text}`}>
              {outlet.status}
            </Text>
          </View>
        </View>

        {/* Main Content */}
        <View className="flex-row items-center justify-between">
          {/* Left side - Icon and Info */}
          <View className="flex-row items-center flex-1">
            <View className="mr-4">
              <SocketIcon width={44} height={44} color="#0F0E41" />
            </View>

            <View className="flex-1">
              <View className="flex-row items-center mb-1.5">
                <FlashIcon width={14} height={14} color="#0F0E41" />
                <Text className="ml-1.5 text-[14px] font-semibold text-[#0F0E41]">
                  {`${outlet.powerDraw} W`}
                </Text>
              </View>

              <View className="flex-row items-center">
                <ClockIcon width={13} height={13} color="#6B7280" />
                <Text className="ml-1.5 text-[12px] font-medium text-[#6B7280]">
                  {outlet.duration ?? "-"}
                </Text>
              </View>
            </View>
          </View>

          {/* Right side - Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onToggle?.(outlet.id)}
            disabled={isToggling}
            className={`rounded-full p-0.5 ${
              outlet.isOn ? "bg-[#0F0E41]" : "bg-[#CBD2E9]"
            }`}
            style={{ width: 52, height: 28, opacity: isToggling ? 0.5 : 1 }}
          >
            <View
              className="rounded-full bg-white"
              style={{
                width: 24,
                height: 24,
                alignSelf: outlet.isOn ? "flex-end" : "flex-start",
              }}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}
