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
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {/* Outlet Icon */}
          <View className="bg-gray-100 rounded-lg p-3 mr-4">
            <Image
              source={require("../assets/images/Socket.png")}
              className="w-8 h-10"
              resizeMode="contain"
            />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text className="text-lg font-semibold text-gray-800 mr-3">
                {outlet.name}
              </Text>
              <View
                className={`px-2 py-1 rounded-full ${getStatusColor(outlet.status)}`}
              >
                <Text className="text-white text-xs font-medium">
                  {outlet.status}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <Image
                source={require("../assets/images/FlashOn.png")}
                className="w-4 h-4 mr-1"
                resizeMode="contain"
              />
              <Text className="text-gray-600 mr-4">{outlet.power} W</Text>
              <Image
                source={require("../assets/images/Clock.png")}
                className="w-4 h-4 mr-1"
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

        {/* Toggle Switch */}
        <TouchableOpacity
          onPress={() => onToggle?.(outlet.id)}
          className={`w-12 h-6 rounded-full p-1 ${
            outlet.isOn ? "bg-[#0F0E41]" : "bg-gray-300"
          }`}
        >
          <View
            className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
              outlet.isOn ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
