import { useState, useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import {
  getNotificationPreferences,
  updateNotificationPreference,
  NotificationPreferences,
} from "@/utils/notificationPreferences";

interface NotificationToggleProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}

function NotificationToggle({ label, description, value, onToggle }: NotificationToggleProps) {
  return (
    <View className="mb-4">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-sm text-[#0F0E41] font-medium">{label}</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggle}
          className={`rounded-full p-0.5 ${value ? "bg-[#0F0E41]" : "bg-[#CBD2E9]"}`}
          style={{ width: 52, height: 28 }}
        >
          <View
            className="rounded-full bg-white"
            style={{
              width: 24,
              height: 24,
              alignSelf: value ? "flex-end" : "flex-start",
            }}
          />
        </TouchableOpacity>
      </View>
      <Text className="text-xs text-[#6B7280]">{description}</Text>
    </View>
  );
}

export default function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    leftZoneWithOutletsOn: true,
    turnedOnOutletOutsideZone: true,
    manualTimerCompleted: true,
    geofenceTimerCompleted: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    const prefs = await getNotificationPreferences();
    setPreferences(prefs);
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newValue = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: newValue }));
    await updateNotificationPreference(key, newValue);
  };

  return (
    <View
      className="bg-white rounded-2xl p-5 mb-4 w-full max-w-[400px]"
      style={{
        elevation: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
    >
      <Text className="text-base text-[#0F0E41] font-medium mb-2">
        Notification Preferences
      </Text>
      <Text className="text-xs text-[#6B7280] mb-4">
        Control which alerts you receive from PowerGuard
      </Text>

      <Text className="text-sm text-[#0F0E41] font-medium mb-2 mt-2">
        Timer Notifications
      </Text>
      <NotificationToggle
        label="Manual timer alerts"
        description="Notify when individual outlet timer completes"
        value={preferences.manualTimerCompleted}
        onToggle={() => handleToggle("manualTimerCompleted")}
      />

      <Text className="text-sm text-[#0F0E41] font-medium mb-2 mt-3">
        Geofencing Notifications
      </Text>
      <Text className="text-xs text-[#9CA3AF] mb-2">
        Requires geofencing to be enabled
      </Text>

      <NotificationToggle
        label="Alert when leaving home"
        description="Notify when you leave home with outlets still on"
        value={preferences.leftZoneWithOutletsOn}
        onToggle={() => handleToggle("leftZoneWithOutletsOn")}
      />

      <NotificationToggle
        label="Alert when turning on outside"
        description="Notify when you turn on outlets while outside the geofence"
        value={preferences.turnedOnOutletOutsideZone}
        onToggle={() => handleToggle("turnedOnOutletOutsideZone")}
      />

      <NotificationToggle
        label="Geofence timer alerts"
        description="Notify when geofence auto-shutdown timer completes"
        value={preferences.geofenceTimerCompleted}
        onToggle={() => handleToggle("geofenceTimerCompleted")}
      />
    </View>
  );
}
