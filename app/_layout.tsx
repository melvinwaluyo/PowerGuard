import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OutletProvider } from "@/context/OutletContext";
import { LocationProvider } from "@/context/LocationContext";
import { GeofenceMonitorProvider } from "@/context/GeofenceMonitorContext";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) {
        // Skip update checks in development mode
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          console.log("Update available, downloading...");
          await Updates.fetchUpdateAsync();

          // Reload the app to apply the update
          await Updates.reloadAsync();
        } else {
          console.log("App is up to date");
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    }

    checkForUpdates();
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
