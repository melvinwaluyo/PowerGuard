import { Image, Text, TouchableOpacity, View } from "react-native";

interface Outlet {
  id: number;
  name: string;
  status: string;
  power: number;
  duration: string | null;
  isOn: boolean;
}

interface OutletCardProps {
  outlet: Outlet;
  onToggle?: (id: number) => void;
}

export function OutletCard({ outlet, onToggle }: OutletCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Connected":
        return "bg-green-500";
      case "Disconnected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 mx-4 mb-4 shadow-sm border border-gray-100">
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-start flex-1">
          {/* Outlet Icon with Name on top */}
          <View className="items-center mr-4">
            <Text className="text-2xl font-semibold text-gray-800 mb-2">
              {outlet.name}
            </Text>
            <Image
              source={require("../assets/images/Socket.png")}
              className="w-23 h-16"
              resizeMode="contain"
            />
          </View>

          {/* Status, Power, and Timer - Vertical Layout */}
          <View className="flex-1 pt-1">
            {/* Status */}
            <View className="mb-2">
              <View
                className={`px-2 py-1 rounded-full ${getStatusColor(outlet.status)} self-start`}
              >
                <Text className="text-white text-xs font-medium">
                  {outlet.status}
                </Text>
              </View>
            </View>

            {/* Power */}
            <View className="flex-row items-center mb-2">
              <Image
                source={require("../assets/images/FlashOn.png")}
                className="w-4 h-4 mr-2"
                resizeMode="contain"
              />
              <Text className="text-gray-600">{outlet.power} W</Text>
            </View>

            {/* Timer */}
            <View className="flex-row items-center">
              <Image
                source={require("../assets/images/Clock.png")}
                className="w-4 h-4 mr-2"
                resizeMode="contain"
              />
              {outlet.duration ? (
                <Text className="text-gray-600">{outlet.duration}</Text>
              ) : (
                <Text className="text-gray-600">-</Text>
              )}
            </View>
          </View>
        </View>

        {/* Toggle Switch - Aligned with Power Draw */}
        <TouchableOpacity
          onPress={() => onToggle?.(outlet.id)}
          className={`w-16 h-8 rounded-full p-1 mt-9 ${
            outlet.isOn ? "bg-[#0F0E41]" : "bg-gray-300"
          }`}
        >
          <View
            className={`w-6 h-6 rounded-full bg-white transform transition-transform ${
              outlet.isOn ? "translate-x-8" : "translate-x-0"
            }`}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
