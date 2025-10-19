import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import InteractiveMap from "./InteractiveMap";

export default function PinLocationSection() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Pin Home Location on Maps</Text>
<View style={styles.mapContainer}>
  <InteractiveMap />
  <TouchableOpacity style={styles.saveButton}>
    <Text style={styles.saveButtonText}>Save</Text>
  </TouchableOpacity>
</View>
      <Text style={styles.locationText}>40.7128, -74.0060, New York, NY</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F0E41",
    marginBottom: 8,
  },
  mapContainer: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    position: "relative",
    backgroundColor: "#E7E7E7",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "#0F0E41",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 8,
    zIndex: 10,
  },
  saveButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  locationText: {
    textAlign: "center",
    color: "#0F0E41",
    fontSize: 14,
    marginTop: 4,
  },
});