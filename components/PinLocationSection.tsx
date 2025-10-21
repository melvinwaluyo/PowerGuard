import { Text, View } from "react-native";
import InteractiveMap from "./InteractiveMap";

interface PinLocationSectionProps {
  location: { latitude: number; longitude: number } | null;
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
  radius: number;
}

export default function PinLocationSection({
  location,
  onLocationChange,
  radius,
}: PinLocationSectionProps) {
  return (
    <View
      className="bg-white rounded-2xl p-4 mb-4 w-full max-w-[400px]"
      style={{
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      }}
    >
      <Text className="text-base font-semibold text-[#0F0E41] mb-3">
        Home Location
      </Text>
      <InteractiveMap
        location={location}
        onLocationChange={onLocationChange}
        radius={radius}
      />
    </View>
  );
}