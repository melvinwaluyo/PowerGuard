import AutoShutdownSection from "@/components/AutoShutdownSection";
import { BottomNavigation } from "@/components/BottomNavigation";
import GeofencingSection from "@/components/GeofencingSection";
import PinLocationSection from "@/components/PinLocationSection";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      <ScrollView contentContainerStyle={styles.content}>
        <GeofencingSection />
        <AutoShutdownSection />
        <PinLocationSection />
      </ScrollView>
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E7E7E7",
  },
  header: {
    backgroundColor: "#0F0E41",
    color: "white",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 24,
    marginBottom: 8,
  },
  content: {
    padding: 16,
    alignItems: "center",
  },
});