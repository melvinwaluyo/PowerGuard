import { useState, useEffect } from "react";
import AutoShutdownSection from "@/components/AutoShutdownSection";
import { BottomNavigation } from "@/components/BottomNavigation";
import GeofencingSection from "@/components/GeofencingSection";
import PinLocationSection from "@/components/PinLocationSection";
import { Platform, ScrollView, StatusBar, Text, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, GeofenceSetting } from "@/services/api";

// Default powerstrip ID - TODO: Make this dynamic based on user's powerstrip
const DEFAULT_POWERSTRIP_ID = 1;

export default function SettingsScreen() {
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);
  const [radius, setRadius] = useState(1500);
  const [autoShutdownTime, setAutoShutdownTime] = useState(900); // 15 minutes in seconds
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === "android"
    ? (StatusBar.currentHeight ?? 0) + 16
    : insets.top + 16;

  // Load geofence settings on mount
  useEffect(() => {
    loadGeofenceSettings();
  }, []);

  const loadGeofenceSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await api.getGeofenceSetting(DEFAULT_POWERSTRIP_ID);
      if (settings) {
        setGeofencingEnabled(settings.isEnabled);
        setRadius(settings.radius || 1500);
        setAutoShutdownTime(settings.autoShutdownTime || 900);
        if (settings.latitude && settings.longitude) {
          setLocation({
            latitude: settings.latitude,
            longitude: settings.longitude,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load geofence settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleGeofencing = async (enabled: boolean) => {
    try {
      setGeofencingEnabled(enabled);
      await api.updateGeofenceEnabled(DEFAULT_POWERSTRIP_ID, enabled);
    } catch (error) {
      console.error('Failed to update geofencing enabled:', error);
      // Revert on error
      setGeofencingEnabled(!enabled);
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    try {
      setRadius(newRadius);
      await api.saveGeofenceSetting({
        powerstripID: DEFAULT_POWERSTRIP_ID,
        isEnabled: geofencingEnabled,
        radius: newRadius,
        latitude: location?.latitude,
        longitude: location?.longitude,
        autoShutdownTime,
      });
    } catch (error) {
      console.error('Failed to save radius:', error);
    }
  };

  const handleShutdownTimeChange = async (timeInSeconds: number) => {
    try {
      setAutoShutdownTime(timeInSeconds);
      await api.saveGeofenceSetting({
        powerstripID: DEFAULT_POWERSTRIP_ID,
        isEnabled: geofencingEnabled,
        radius,
        latitude: location?.latitude,
        longitude: location?.longitude,
        autoShutdownTime: timeInSeconds,
      });
    } catch (error) {
      console.error('Failed to save shutdown time:', error);
    }
  };

  const handleLocationChange = async (newLocation: { latitude: number; longitude: number }) => {
    try {
      setLocation(newLocation);
      await api.saveGeofenceSetting({
        powerstripID: DEFAULT_POWERSTRIP_ID,
        isEnabled: geofencingEnabled,
        radius,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        autoShutdownTime,
      });
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#E7E7E7] items-center justify-center">
        <ActivityIndicator size="large" color="#0F0E41" />
      </View>
    );
  }

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
        <GeofencingSection
          enabled={geofencingEnabled}
          onToggle={handleToggleGeofencing}
          radius={radius}
          onRadiusChange={handleRadiusChange}
        />
        {geofencingEnabled && (
          <>
            <AutoShutdownSection
              autoShutdownTime={autoShutdownTime}
              onShutdownTimeChange={handleShutdownTimeChange}
            />
            <PinLocationSection
              location={location}
              onLocationChange={handleLocationChange}
              radius={radius}
            />
          </>
        )}
      </ScrollView>
      <BottomNavigation activeTab="settings" />
    </View>
  );
}