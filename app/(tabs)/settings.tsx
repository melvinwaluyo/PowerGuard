import { useState } from "react";
import AutoShutdownSection from "@/components/AutoShutdownSection";
import { BottomNavigation } from "@/components/BottomNavigation";
import GeofencingSection from "@/components/GeofencingSection";
import PinLocationSection from "@/components/PinLocationSection";
import { Platform, ScrollView, StatusBar, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === "android"
    ? (StatusBar.currentHeight ?? 0) + 16
    : insets.top + 16;

  return (
    <View className="flex-1 bg-[#E7E7E7]">
      <View
        className="bg-[#0F0E41] px-6"
        style={{ paddingTop: topInset, paddingBottom: 20 }}
      >
        <Text className="text-white text-[24px] font-bold text-center">
          Settings
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          alignItems: "center",
          paddingBottom: 120 // Extra padding to avoid navbar covering content
        }}
      >
        <GeofencingSection enabled={geofencingEnabled} onToggle={setGeofencingEnabled} />
        {geofencingEnabled && (
          <>
            <AutoShutdownSection />
            <PinLocationSection />
          </>
        )}
      </ScrollView>
      <BottomNavigation activeTab="settings" />
    </View>
  );
}