import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OutletProvider } from "@/context/OutletContext";
import { LocationProvider } from "@/context/LocationContext";
import { GeofenceMonitorProvider } from "@/context/GeofenceMonitorContext";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import { registerBackgroundFetch } from "@/tasks/backgroundFetch";
import { isGeofencingActive } from "@/tasks/backgroundGeofencing";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    async function initializeApp() {
      // Register background fetch task (only works in standalone builds, not Expo Go)
      try {
        await registerBackgroundFetch();
        console.log("[App] Background fetch registered successfully");
      } catch (error) {
        console.warn("[App] Background fetch not available (requires standalone build):", error);
      }

      // Check geofencing status (only works in standalone builds, not Expo Go)
      try {
        const isRunning = await isGeofencingActive();
        console.log("[App] Native geofencing running:", isRunning);
      } catch (error) {
        console.warn("[App] Geofencing not available (requires standalone build):", error);
      }

      // Check for updates
      if (__DEV__) {
        // Skip update checks in development mode
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();

          // Reload the app to apply the update
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    }

    initializeApp();
  }, []);

  return (
    <SafeAreaProvider>
      <LocationProvider>
        <GeofenceMonitorProvider>
          <OutletProvider>
            <StatusBar style="light" backgroundColor="#0F0E41" translucent={false} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="outlet/[id]" options={{ headerShown: false }} />
              <Stack.Screen
                name="pin-location"
                options={{
                  headerShown: false,
                  presentation: "modal",
                  animation: "slide_from_bottom"
                }}
              />
            </Stack>
          </OutletProvider>
        </GeofenceMonitorProvider>
      </LocationProvider>
    </SafeAreaProvider>
  );
}
