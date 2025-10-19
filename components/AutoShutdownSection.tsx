import { useState } from "react";
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

// Web-specific component with wheel support
const TimeInput = ({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) => {
  const [inputValue, setInputValue] = useState(value.toString().padStart(2, '0'));

  const handleTextChange = (text: string) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, '');
    setInputValue(numericText);
    
    if (numericText) {
      const numValue = parseInt(numericText);
      onChange(Math.max(0, Math.min(59, numValue)));
    }
  };

  const handleFocus = () => {
    // Clear the input when focused for fresh typing
    setInputValue('');
  };

  const handleBlur = () => {
    // When blur, format the value back to 2 digits
    if (inputValue === '') {
      setInputValue(value.toString().padStart(2, '0'));
    } else {
      const numValue = parseInt(inputValue) || 0;
      setInputValue(numValue.toString().padStart(2, '0'));
    }
  };

  // For web: proper wheel event handling
  if (Platform.OS === "web") {
    const handleWheel = (event: any) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = Math.sign(event.deltaY);
      const newValue = value - delta;
      onChange(Math.max(0, Math.min(59, newValue)));
      // Update local input value
      setInputValue(newValue.toString().padStart(2, '0'));
    };

    return (
      <View style={styles.inputSection}>
        <div 
          style={{
            position: 'relative',
          }}
          onWheel={handleWheel}
        >
          <TextInput
            style={[styles.timeInput, styles.webTimeInput]}
            value={inputValue}
            onChangeText={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            keyboardType="number-pad"
            maxLength={2}
            textAlign="center"
          />
        </div>
        <Text style={styles.timeLabel}>{label}</Text>
      </View>
    );
  }

  // For mobile: regular TextInput
  return (
    <View style={styles.inputSection}>
      <TextInput
        style={styles.timeInput}
        value={inputValue}
        onChangeText={handleTextChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={2}
        textAlign="center"
      />
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
};

export default function AutoShutdownSection() {
  const [currentMinutes, setCurrentMinutes] = useState(15);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [draftMinutes, setDraftMinutes] = useState(15);
  const [draftSeconds, setDraftSeconds] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const handleSet = () => {
    setCurrentMinutes(draftMinutes);
    setCurrentSeconds(draftSeconds);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setDraftMinutes(currentMinutes);
    setDraftSeconds(currentSeconds);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftMinutes(currentMinutes);
    setDraftSeconds(currentSeconds);
    setIsEditing(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Auto Shutdown Timer</Text>
      <Text style={styles.subtitle}>Time with color of skin: performance:</Text>

      {!isEditing && (
        <View style={styles.currentTimeContainer}>
          <View style={styles.displayTime}>
            <Text style={styles.displayTimeText}>
              {currentMinutes} minutes : {currentSeconds} second
            </Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {isEditing && (
        <>
          <View style={styles.timeInputContainer}>
            {/* Minutes Input */}
            <TimeInput 
              value={draftMinutes}
              onChange={setDraftMinutes}
              label="minutes"
            />

            <Text style={styles.colon}>:</Text>

            {/* Seconds Input */}
            <TimeInput 
              value={draftSeconds}
              onChange={setDraftSeconds}
              label="second"
            />
          </View>

          

          

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.setButton} onPress={handleSet}>
              <Text style={styles.setButtonText}>Set Timer</Text>
            </TouchableOpacity>
          </View>
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0F0E41",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
  },
  currentTimeContainer: {
    alignItems: "center",
  },
  displayTime: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  displayTimeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F0E41",
  },
  editButton: {
    backgroundColor: "#0F0E41",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  editButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  timeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  inputSection: {
    alignItems: "center",
    marginHorizontal: 12,
  },
  timeInput: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0F0E41",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: 80,
    backgroundColor: "#F8FAFC",
  },
  webTimeInput: {
    ...Platform.select({
      web: {
        cursor: 'pointer',
        outline: 'none',
        userSelect: 'none',
      },
    }),
  },
  timeLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 8,
  },
  colon: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0F0E41",
    marginHorizontal: 8,
  },
  instructions: {
    alignItems: "center",
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  selectedTime: {
    backgroundColor: "#0F0E41",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  selectedTimeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "white",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 14,
  },
  setButton: {
    flex: 1,
    backgroundColor: "#0F0E41",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  setButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});