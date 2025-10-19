import Slider from "@react-native-community/slider";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function GeofencingSection() {
  const [enabled, setEnabled] = useState(true);
  const [radius, setRadius] = useState(1500);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Geofencing</Text>
        <TouchableOpacity
          onPress={() => setEnabled(!enabled)}
          style={[
            styles.toggleContainer,
            enabled ? styles.toggleOn : styles.toggleOff
          ]}
        >
          <View style={[
            styles.toggleCircle,
            enabled ? styles.toggleCircleOn : styles.toggleCircleOff
          ]} />
        </TouchableOpacity>
      </View>
      
      {enabled && (
        <>
          <View style={styles.radiusRow}>
            <Text style={styles.label}>Geofencing Radius</Text>
            <Text style={styles.value}>{radius} m</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={100}
            maximumValue={5000}
            step={100}
            value={radius}
            onValueChange={setRadius}
            minimumTrackTintColor="#0F0E41"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#0F0E41"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  radiusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: "#0F0E41",
    fontWeight: "500",
  },
  value: {
    fontSize: 16,
    color: "#0F0E41",
    fontWeight: "600",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  toggleContainer: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  toggleOn: {
    backgroundColor: "#0F0E41",
  },
  toggleOff: {
    backgroundColor: "#D1D5DB",
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "white",
  },
  toggleCircleOn: {
    transform: [{ translateX: 24 }],
  },
  toggleCircleOff: {
    transform: [{ translateX: 0 }],
  },
});