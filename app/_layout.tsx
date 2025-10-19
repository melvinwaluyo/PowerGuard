import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OutletProvider } from "@/context/OutletContext";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
