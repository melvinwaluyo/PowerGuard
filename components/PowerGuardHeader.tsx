import { Text, View } from "react-native";

interface PowerGuardHeaderProps {
  totalPower: number;
}

export function PowerGuardHeader({ totalPower }: PowerGuardHeaderProps) {
  return (
    <View className="bg-[#0F0E41] pt-12 pb-6 px-4">
      <Text className="text-white text-3xl font-bold text-center mb-4">
        PowerGuard
      </Text>
      <View className="bg-white rounded-full py-2 px-4 self-center">
        <Text className="text-[#0F0E41] font-semibold">
          Total Power Draw: {totalPower} W
        </Text>
      </View>
    </View>
  );
}
