import { useState, useEffect } from "react";
import AutoShutdownSection from "@/components/AutoShutdownSection";
import { BottomNavigation } from "@/components/BottomNavigation";
import GeofencingSection from "@/components/GeofencingSection";
import PinLocationSection from "@/components/PinLocationSection";
import NotificationPreferencesSection from "@/components/NotificationPreferencesSection";
import { Platform, ScrollView, StatusBar, Text, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocation } from "@/context/LocationContext";
import { useGeofenceMonitor, DEFAULT_POWERSTRIP_ID } from "@/context/GeofenceMonitorContext";
import { useOutlets } from "@/context/OutletContext";
import { api } from "@/services/api";

export default function SettingsScreen() {
  const { pendingLocation, setPendingLocation } = useLocation();
  const { settings, status, refreshSettings, updateSettingsLocal, pendingRequest, isResolvingRequest, forceGeofenceEvaluation } =
    useGeofenceMonitor();
  const { outlets } = useOutlets();
  const [isSaving, setIsSaving] = useState(false);
  const isLoading = !settings;

  // Check if any outlets are currently ON
  const hasActiveOutlets = outlets.some(outlet => outlet.isOn);

  const insets = useSafeAreaInsets();

  const topInset = Platform.OS === "android"
    ? (StatusBar.currentHeight ?? 0) + 16
    : insets.top + 16;

  const geofencingEnabled = settings?.isEnabled ?? false;
  const radius = settings?.radius ?? 1500;
  const autoShutdownTime = settings?.autoShutdownTime ?? 900;
  const location = settings?.latitude != null && settings?.longitude != null
    ? { latitude: settings.latitude, longitude: settings.longitude }
    : null;

  // Handle location updates from pin-location screen via context
  useEffect(() => {
    if (pendingLocation) {
      handleLocationChange(pendingLocation);
      // Clear the pending location after processing
      setPendingLocation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLocation]);

  const handleToggleGeofencing = async (enabled: boolean) => {
    if (!settings || isSaving) return; // Prevent double-toggling
    const previous = geofencingEnabled;
    try {
      setIsSaving(true);
      updateSettingsLocal({ isEnabled: enabled });
      await api.updateGeofenceEnabled(DEFAULT_POWERSTRIP_ID, enabled);
      await refreshSettings();

      // If enabling geofencing, immediately evaluate current position
      if (enabled && settings.latitude != null && settings.longitude != null) {
        console.log('[Settings] Geofencing enabled - forcing immediate evaluation');
        await forceGeofenceEvaluation();
      }

      // Add a small delay before allowing next toggle (300ms cooldown)
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error('Failed to update geofencing enabled:', error);
      // Revert on error
      updateSettingsLocal({ isEnabled: previous });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    if (!settings) return;
    const previous = radius;
    try {
      setIsSaving(true);
      updateSettingsLocal({ radius: newRadius });
      await api.saveGeofenceSetting({
        powerstripID: DEFAULT_POWERSTRIP_ID,
        isEnabled: geofencingEnabled,
        radius: newRadius,
        latitude: settings.latitude ?? location?.latitude,
        longitude: settings.longitude ?? location?.longitude,
        autoShutdownTime,
      });
      await refreshSettings();

      // Force immediate evaluation since radius change may affect zone status
      if (geofencingEnabled) {
        console.log('[Settings] Radius updated - forcing immediate geofence evaluation');
        await forceGeofenceEvaluation();
      }
    } catch (error) {
      console.error('Failed to save radius:', error);
      updateSettingsLocal({ radius: previous });
    } finally {
      setIsSaving(false);
    }
  };

  const handleShutdownTimeChange = async (timeInSeconds: number) => {
    if (!settings) return;
    const previous = autoShutdownTime;
    try {
      setIsSaving(true);
      updateSettingsLocal({ autoShutdownTime: timeInSeconds });
      await api.saveGeofenceSetting({
        powerstripID: DEFAULT_POWERSTRIP_ID,
        isEnabled: geofencingEnabled,
        radius,
        latitude: settings.latitude ?? location?.latitude,
        longitude: settings.longitude ?? location?.longitude,
        autoShutdownTime: timeInSeconds,
      });
      await refreshSettings();
    } catch (error) {
      console.error('Failed to save shutdown time:', error);
      updateSettingsLocal({ autoShutdownTime: previous });
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocationChange = async (newLocation: { latitude: number; longitude: number }) => {
    if (!settings) return;
    setIsSaving(true);
    try {
      updateSettingsLocal({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
      });
      await api.saveGeofenceSetting({
        powerstripID: DEFAULT_POWERSTRIP_ID,
        isEnabled: geofencingEnabled,
        radius,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        autoShutdownTime,
      });
      await refreshSettings();

      // Force immediate geofence evaluation with current device location
      // This ensures the app immediately checks if the device is inside/outside the new home location
      console.log('[Settings] Home location updated - forcing immediate geofence evaluation');
      await forceGeofenceEvaluation();
    } catch (error) {
      console.error('Failed to save location:', error);
    } finally {
      setIsSaving(false);
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
          isSaving={isSaving}
        />
        {geofencingEnabled && (
          <>
            <AutoShutdownSection
              autoShutdownTime={autoShutdownTime}
              countdownIsActive={status.countdownIsActive}
              countdownRemainingSeconds={status.remainingSeconds}
              geofenceZone={status.zone}
              pendingRequest={pendingRequest}
              hasActiveOutlets={hasActiveOutlets}
              onShutdownTimeChange={handleShutdownTimeChange}
              isSaving={isSaving || isResolvingRequest}
            />
            <PinLocationSection
              location={location}
              onLocationChange={handleLocationChange}
              radius={radius}
            />
          </>
        )}
        <NotificationPreferencesSection />
      </ScrollView>
      <BottomNavigation activeTab="settings" />
    </View>
  );
}
