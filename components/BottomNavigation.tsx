import { Image, TouchableOpacity, View } from "react-native";

export function BottomNavigation() {
  return (
    <View className="absolute bottom-6 left-0 right-0 flex items-center justify-center px-4">
      <View className="bg-[#0F0E41] rounded-full flex-row items-center justify-center py-3 px-6 self-center shadow-lg">
        <TouchableOpacity className="p-2 mx-2">
          <Image
            source={require("../assets/images/GraphReport.png")}
            className="w-6 h-6"
            style={{ tintColor: "white" }}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <TouchableOpacity className="p-2 mx-2">
          <View className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <Image
              source={require("../assets/images/Home.png")}
              className="w-5 h-5"
              style={{ tintColor: "#0F0E41" }}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="p-2 mx-4">
          <Image
            source={require("../assets/images/Settings.png")}
            className="w-6 h-6"
            style={{ tintColor: "white" }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
