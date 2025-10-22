import Slider from "@react-native-community/slider";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface GeofencingSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
}

export default function GeofencingSection({
  enabled,
  onToggle,
  radius,
  onRadiusChange,
}: GeofencingSectionProps) {
  const [draftRadius, setDraftRadius] = useState(radius);
  const [isEditing, setIsEditing] = useState(false);

  // Update draft when prop changes
  useEffect(() => {
    setDraftRadius(radius);
  }, [radius]);

  // Reset editing state when geofencing is disabled
  useEffect(() => {
    if (!enabled && isEditing) {
      setIsEditing(false);
      setDraftRadius(radius);
    }
  }, [enabled, isEditing, radius]);

  const handleEdit = () => {
    setDraftRadius(radius);
    setIsEditing(true);
  };

  const handleSave = () => {
    onRadiusChange(draftRadius);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftRadius(radius);
    setIsEditing(false);
  };

  return (
    <View
      className="bg-white rounded-2xl p-5 mb-4 w-full max-w-[400px]"
      style={{
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4
      }}
    >
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-base text-[#0F0E41] font-medium">Geofencing</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onToggle(!enabled)}
          className={`rounded-full p-0.5 ${
            enabled ? "bg-[#0F0E41]" : "bg-[#CBD2E9]"
          }`}
          style={{ width: 52, height: 28 }}
        >
          <View
            className="rounded-full bg-white"
            style={{
              width: 24,
              height: 24,
              alignSelf: enabled ? "flex-end" : "flex-start",
            }}
          />
        </TouchableOpacity>
      </View>

      {enabled ? (
        <>
          <Text className="text-sm text-[#6B7280] mb-4">
            Set the distance from home before auto-shutdown
          </Text>

          {!isEditing ? (
            <View className="items-center">
              <View className="bg-[#E8EBFF] rounded-2xl p-5 w-full items-center mb-4">
                <Text className="text-xs text-[#6B7280] mb-1">Current Radius</Text>
                <Text className="text-[36px] font-bold text-[#0F0E41]">{radius} m</Text>
              </View>
              <TouchableOpacity
                className="bg-[#0F0E41] rounded-xl px-8 py-3"
                onPress={handleEdit}
              >
                <Text className="text-white font-semibold text-base">Edit Radius</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="bg-[#F3F4FA] rounded-2xl p-4 mb-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-sm text-[#6B7280] font-medium">Radius</Text>
                  <Text className="text-lg text-[#0F0E41] font-bold">{draftRadius} m</Text>
                </View>
                <Slider
                  style={{ width: "100%", height: 40 }}
                  minimumValue={100}
                  maximumValue={5000}
                  step={100}
                  value={draftRadius}
                  onValueChange={setDraftRadius}
                  minimumTrackTintColor="#0F0E41"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#0F0E41"
                />
              </View>

              <View className="flex-row justify-between gap-3">
                <TouchableOpacity
                  className="flex-1 bg-[#F3F4F6] rounded-lg p-2.5 items-center border border-[#D1D5DB]"
                  onPress={handleCancel}
                >
                  <Text className="text-[#374151] font-semibold text-sm">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-[#0F0E41] rounded-lg p-2.5 items-center"
                  onPress={handleSave}
                >
                  <Text className="text-white font-semibold text-sm">Save Radius</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      ) : (
        <View className="items-center py-3">
          <Text className="text-[#9CA3AF] text-sm">Geofencing is disabled</Text>
        </View>
      )}
    </View>
  );
}