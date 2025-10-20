import { TimerPickerModal } from "@/components/TimerPickerModal";
import { OutletTimerSetting } from "@/types/outlet";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function AutoShutdownSection() {
  const [currentTimer, setCurrentTimer] = useState<OutletTimerSetting>({
    hours: 0,
    minutes: 15,
    seconds: 0,
    isActive: false,
  });
  const [draftTimer, setDraftTimer] = useState<OutletTimerSetting>({
    hours: 0,
    minutes: 15,
    seconds: 0,
    isActive: false,
  });
  const [modalVisible, setModalVisible] = useState(false);

  const handleConfirm = (value: OutletTimerSetting) => {
    setCurrentTimer(value);
    setModalVisible(false);
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
        <Text className="text-lg font-semibold text-[#0F0E41] mb-1">
          Auto Shutdown Timer
        </Text>
        <Text className="text-sm text-[#6B7280] mb-5">
          Time until auto-off after geofence alert
        </Text>

        <View className="items-center">
          {/* Timer Display Card */}
          <View className="bg-[#E8EBFF] rounded-2xl p-6 w-full items-center mb-4">
            <View className="flex-row items-center justify-center">
              <View className="w-12 h-12 bg-[#0F0E41] rounded-full items-center justify-center mr-3">
                <Ionicons name="timer-outline" size={24} color="#fff" />
              </View>
              <View>
                <Text className="text-xs text-[#6B7280] mb-1">Timer Set</Text>
                <Text className="text-[32px] font-bold text-[#0F0E41] tracking-wider">
                  {String(currentTimer.hours).padStart(2, "0")}:
                  {String(currentTimer.minutes).padStart(2, "0")}:
                  {String(currentTimer.seconds).padStart(2, "0")}
                </Text>
              </View>
            </View>
          </View>

          {/* Edit Button */}
          <TouchableOpacity
            className="bg-[#0F0E41] rounded-xl px-8 py-3 flex-row items-center"
            onPress={handleEdit}
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
              Edit Timer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timer Picker Modal */}
      <TimerPickerModal
        visible={modalVisible}
        value={draftTimer}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
