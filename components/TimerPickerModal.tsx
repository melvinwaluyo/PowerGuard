import { useState, useEffect } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TimerPicker } from "./TimerPicker";
import { TimerDurationValue } from "@/types/timer";

interface TimerPickerModalProps {
  visible: boolean;
  value: TimerDurationValue;
  onConfirm: (value: TimerDurationValue) => void | Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function TimerPickerModal({
  visible,
  value,
  onConfirm,
  onCancel,
  isSaving = false,
}: TimerPickerModalProps) {
  const [currentValue, setCurrentValue] = useState<TimerDurationValue>(value);

  // Update internal state when the value prop changes (modal opens with new value)
  useEffect(() => {
    if (visible) {
      setCurrentValue(value);
    }
  }, [visible, value]);

  const handleConfirm = () => {
    if (isSaving) {
      return;
    }
    void onConfirm(currentValue);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 w-full"
          onPress={onCancel}
        />

        {/* Modal Content */}
        <View
          className="bg-white rounded-3xl mx-5 overflow-hidden"
          style={{
            maxWidth: 400,
            width: '90%',
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
          }}
        >
          {/* Header */}
          <View className="bg-[#0F0E41] px-6 py-5 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-white text-xl font-bold mb-1">
                Set Timer
              </Text>
              <Text className="text-white/70 text-sm">
                Auto-shutdown duration
              </Text>
            </View>
            <TouchableOpacity
              onPress={onCancel}
              className="w-9 h-9 items-center justify-center bg-white/20 rounded-full"
            >
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Timer Picker */}
          <View className="px-5 py-8 bg-[#F9FAFB]">
            <TimerPicker value={currentValue} onChange={setCurrentValue} />
          </View>

          {/* Action Buttons */}
          <View className="flex-row p-5 gap-3 bg-white border-t border-[#E5E7EB]">
            <TouchableOpacity
              className="flex-1 bg-[#F3F4F6] rounded-xl py-4 items-center border border-[#D1D5DB]"
              onPress={onCancel}
            >
              <Text className="text-[#374151] font-semibold text-base">
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-[#0F0E41] rounded-xl py-4 items-center"
              onPress={handleConfirm}
              disabled={isSaving}
              style={{
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              <Text className="text-white font-semibold text-base">
                {isSaving ? "Saving..." : "Confirm"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 w-full"
          onPress={onCancel}
        />
      </View>
    </Modal>
  );
}
