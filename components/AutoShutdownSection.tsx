import { Ionicons } from "@expo/vector-icons";
import { Alert } from "react-native";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { TimerPickerModal } from "@/components/TimerPickerModal";
import { TimerDurationValue } from "@/types/timer";

interface AutoShutdownSectionProps {
  autoShutdownTime: number; // in seconds
  countdownIsActive: boolean;
  countdownRemainingSeconds: number;
  geofenceZone: "INSIDE" | "OUTSIDE";
  pendingRequest?: { requestId: number; initiatedAt: string; expiresAt: string | null } | null;
  hasActiveOutlets: boolean;
  onShutdownTimeChange: (timeInSeconds: number) => Promise<void> | void;
  isSaving?: boolean;
}

export default function AutoShutdownSection({
  autoShutdownTime,
  countdownIsActive,
  countdownRemainingSeconds,
  geofenceZone,
  pendingRequest,
  hasActiveOutlets,
  onShutdownTimeChange,
  isSaving = false,
}: AutoShutdownSectionProps) {
  // Convert seconds to timer format
  const secondsToTimer = (seconds: number): TimerDurationValue => ({
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  });

  // Convert timer to seconds
  const timerToSeconds = (timer: TimerDurationValue): number => {
    return timer.hours * 3600 + timer.minutes * 60 + timer.seconds;
  };

  const [currentTimer, setCurrentTimer] = useState<TimerDurationValue>(
    secondsToTimer(autoShutdownTime)
  );
  const [draftTimer, setDraftTimer] = useState<TimerDurationValue>(
    secondsToTimer(autoShutdownTime)
  );
  const [modalVisible, setModalVisible] = useState(false);

  // Update timer when prop changes
  useEffect(() => {
    setCurrentTimer(secondsToTimer(autoShutdownTime));
  }, [autoShutdownTime]);

  const handleConfirm = async (value: TimerDurationValue) => {
    setCurrentTimer(value);
    const seconds = timerToSeconds(value);
    try {
      await onShutdownTimeChange(seconds);
      setModalVisible(false);
    } catch (error) {
      // revert to previous value on failure
      setCurrentTimer(secondsToTimer(autoShutdownTime));
      Alert.alert("Geofence", "Failed to update auto-shutdown duration.");
    }
  };

  const handleEdit = () => {
    setDraftTimer({ ...currentTimer });
    setModalVisible(true);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  return (
    <>
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
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-lg font-semibold text-[#0F0E41]">
            Auto Shutdown Timer
          </Text>
          <View
            className={`rounded-full px-3 py-1 ${
              countdownIsActive ? "bg-[#FEF3C7]" : "bg-[#E8EBFF]"
            }`}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: countdownIsActive ? "#B45309" : "#1E3A8A" }}
            >
              {countdownIsActive ? "Countdown active" : "Standby"}
            </Text>
          </View>
        </View>
        <Text className="text-sm text-[#6B7280] mb-5">
          Timer runs automatically when you leave geofence radius
        </Text>

        <View className="items-center">
          {/* Active countdown display */}
          {countdownIsActive ? (
            <View className="bg-[#FEE2E2] rounded-2xl p-6 w-full items-center mb-4">
              <View className="flex-row items-center justify-center">
                <View className="w-12 h-12 bg-[#DC2626] rounded-full items-center justify-center mr-3">
                  <Ionicons name="warning-outline" size={22} color="#fff" />
                </View>
                <View>
                  <Text className="text-xs text-[#991B1B] mb-1">
                    Countdown Berjalan
                  </Text>
                  <Text className="text-[32px] font-bold text-[#991B1B] tracking-wider">
                    {String(secondsToTimer(countdownRemainingSeconds).hours).padStart(2, "0")}:
                    {String(secondsToTimer(countdownRemainingSeconds).minutes).padStart(2, "0")}:
                    {String(secondsToTimer(countdownRemainingSeconds).seconds).padStart(2, "0")}
                  </Text>
                </View>
              </View>
              <Text className="mt-3 text-sm text-[#7F1D1D]">
                Current zone: {geofenceZone === "OUTSIDE" ? "Outside radius" : "Inside radius"}
              </Text>
              {pendingRequest ? (
                <Text className="mt-2 text-sm text-[#7F1D1D] font-semibold">
                  Waiting for your decision before turning off outlets.
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="bg-[#E8EBFF] rounded-2xl p-6 w-full items-center mb-4">
              <View className="flex-row items-center justify-center">
                <View className="w-12 h-12 bg-[#0F0E41] rounded-full items-center justify-center mr-3">
                  <Ionicons name="timer-outline" size={24} color="#fff" />
                </View>
                <View>
                  <Text className="text-[32px] font-bold text-[#0F0E41] tracking-wider">
                    {String(currentTimer.hours).padStart(2, "0")}:
                    {String(currentTimer.minutes).padStart(2, "0")}:
                    {String(currentTimer.seconds).padStart(2, "0")}
                  </Text>
                </View>
              </View>
              <Text className="mt-3 text-sm text-[#4B5563]">
                Current zone: {geofenceZone === "OUTSIDE" ? "Outside radius" : "Inside radius"}
              </Text>
              {pendingRequest ? (
                <Text className="mt-2 text-sm text-[#4B5563] font-semibold">
                  Waiting for response: outlets will not turn off automatically.
                </Text>
              ) : geofenceZone === "OUTSIDE" && !hasActiveOutlets ? (
                <View className="mt-3 bg-[#FEF3C7] rounded-lg p-3">
                  <View className="flex-row items-center">
                    <Ionicons name="information-circle" size={16} color="#B45309" style={{ marginRight: 6 }} />
                    <Text className="text-xs text-[#92400E] font-semibold">Timer inactive</Text>
                  </View>
                  <Text className="text-xs text-[#92400E] mt-1">
                    All outlets are OFF. Timer will start automatically when any outlet turns ON.
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Edit Button */}
          <TouchableOpacity
            className={`rounded-xl px-8 py-3 flex-row items-center ${
              isSaving ? "bg-[#9CA3AF]" : "bg-[#0F0E41]"
            }`}
            onPress={handleEdit}
            disabled={isSaving}
            style={{
              elevation: 3,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 3,
            }}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text className="text-white font-semibold text-base">
              {isSaving ? "Saving..." : "Edit Duration"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timer Picker Modal */}
      <TimerPickerModal
        visible={modalVisible}
        value={draftTimer}
        onConfirm={handleConfirm}
        isSaving={isSaving}
        onCancel={handleCancel}
      />
    </>
  );
}
