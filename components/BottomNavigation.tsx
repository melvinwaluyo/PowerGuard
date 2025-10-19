import { TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import GraphIcon from "../assets/images/Graph.svg";
import HomeIcon from "../assets/images/Home.svg";
import SettingsIcon from "../assets/images/Settings.svg";

const BAR_SHADOW = {
  shadowColor: "#0F0E41",
  shadowOpacity: 0.16,
  shadowOffset: { width: 0, height: 14 },
  shadowRadius: 24,
  elevation: 18,
};

const ICON_COLOR = "#E8EBFF";

interface BottomNavigationProps {
  activeTab?: "home" | "reporting" | "settings";
}

export function BottomNavigation({ activeTab = "home" }: BottomNavigationProps) {
  const router = useRouter();

  const isHome = activeTab === "home";
  const isReporting = activeTab === "reporting";
  const isSettings = activeTab === "settings";

  return (
    <View className="absolute bottom-8 left-0 right-0 items-center">
      <View
        className="w-[280px] flex-row items-center justify-between rounded-full bg-[#0F0E41] px-6 py-3"
        style={BAR_SHADOW}
      >
        <TouchableOpacity
          className="items-center justify-center w-[56px] h-[56px]"
          onPress={() => router.push("/reporting")}
        >
          {isReporting ? (
            <View className="w-[56px] h-[56px] rounded-full bg-white items-center justify-center">
              <GraphIcon width={26} height={26} color="#0F0E41" />
            </View>
          ) : (
            <GraphIcon width={26} height={26} color={ICON_COLOR} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center w-[56px] h-[56px]"
          onPress={() => router.push("/")}
        >
          {isHome ? (
            <View className="w-[56px] h-[56px] rounded-full bg-white items-center justify-center">
              <HomeIcon width={26} height={26} color="#0F0E41" />
            </View>
          ) : (
            <HomeIcon width={26} height={26} color={ICON_COLOR} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center w-[56px] h-[56px]"
          onPress={() => router.push("/settings")}
        >
          {isSettings ? (
            <View className="w-[56px] h-[56px] rounded-full bg-white items-center justify-center">
              <SettingsIcon width={26} height={26} color="#0F0E41" />
            </View>
          ) : (
            <SettingsIcon width={26} height={26} color={ICON_COLOR} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
