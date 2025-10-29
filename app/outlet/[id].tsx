import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";

import { TimerPickerModal } from "@/components/TimerPickerModal";
import { useOutlets } from "@/context/OutletContext";
import { api, TimerLogResponse, TimerStatusResponse } from "@/services/api";
import {
  Outlet,
  OutletLogCategory,
  OutletLogEntry,
  OutletTimerState,
  TimerLogStatus,
  TimerSource,
} from "@/types/outlet";
import { TimerDurationValue } from "@/types/timer";
import { useGeofenceMonitor } from "@/context/GeofenceMonitorContext";
import { getNotificationPreferences } from "@/utils/notificationPreferences";

const LOG_CATEGORY_META: Record<
  OutletLogCategory,
  { background: string; color: string; label: string }
> = {
  power: { background: "#E8EBFF", color: "#0F0E41", label: "PW" },
  automation: { background: "#E7F5FF", color: "#125B9A", label: "AT" },
  safety: { background: "#FFE8EC", color: "#B42318", label: "SF" },
  maintenance: { background: "#F0F5E9", color: "#20613A", label: "MT" },
};

type DetailTab = "status" | "log";

const DEFAULT_TIMER_SECONDS = 15 * 60;

const secondsToDuration = (seconds: number): TimerDurationValue => {
  const total = Math.max(0, seconds);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
};

const durationToSeconds = (duration: TimerDurationValue): number =>
  duration.hours * 3600 + duration.minutes * 60 + duration.seconds;

const formatSecondsAsClock = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const TIMER_STATUS_COPY: Record<TimerLogStatus, { action: string; detail: (log: any) => string }> = {
  STARTED: {
    action: "Timer started",
    detail: (log) => `Duration ${formatSecondsAsClock(log.durationSeconds ?? 0)}`,
  },
  STOPPED: {
    action: "Timer stopped",
    detail: (log) => `Remaining ${formatSecondsAsClock(log.remainingSeconds ?? 0)}`,
  },
  COMPLETED: {
    action: "Timer completed",
    detail: () => "Relay turned off automatically",
  },
  AUTO_CANCELLED: {
    action: "Timer auto-cancelled",
    detail: () => "Issue occurred while turning off relay",
  },
  POWER_OFF: {
    action: "Power turned off",
    detail: () => "Timer stopped because outlet was turned off",
  },
  REPLACED: {
    action: "Timer replaced",
    detail: (log) => `New duration ${formatSecondsAsClock(log.durationSeconds ?? 0)}`,
  },
};

const mapTimerLogToOutletLog = (log: TimerLogResponse): OutletLogEntry => {
  const status = log.status as TimerLogStatus;
  const meta = TIMER_STATUS_COPY[status];
  const baseDetail = meta ? meta.detail(log) : "";
  const sourceSuffix = log.source === "GEOFENCE" ? " (Geofence)" : "";
  const detailParts = [];
  if (baseDetail) {
    detailParts.push(`${baseDetail}${sourceSuffix}`.trim());
  }
  if (log.note) {
    detailParts.push(log.note);
  }

  return {
    id: `timer-${log.timerLogID}`,
    timestamp: log.triggeredAt,
    action: meta ? meta.action : `Timer ${status.toLowerCase()}`,
    detail: detailParts.join(" • "),
    category: "power",
  };
};

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export default function OutletDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const outletIdParam = Array.isArray(id) ? id[0] : id;
  const outletId = useMemo(() => Number(outletIdParam), [outletIdParam]);

  const { getOutletById, toggleOutlet, updateOutlet, renameOutlet, refreshOutlets, togglingOutlets } = useOutlets();
  const outlet = Number.isFinite(outletId) ? getOutletById(outletId) : undefined;
  const { status: geofenceStatus } = useGeofenceMonitor();

  const [activeTab, setActiveTab] = useState<DetailTab>("status");
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState("");

  const [timerState, setTimerState] = useState<OutletTimerState | null>(outlet?.timer ?? null);
  const [timerPresetSeconds, setTimerPresetSeconds] = useState(outlet?.timerPresetSeconds ?? DEFAULT_TIMER_SECONDS);
  const [countdownSeconds, setCountdownSeconds] = useState(() => {
    if (outlet?.timer?.isActive) {
      return outlet.timer.remainingSeconds;
    }
    return outlet?.timerPresetSeconds ?? DEFAULT_TIMER_SECONDS;
  });
  const [timerLogs, setTimerLogs] = useState<OutletLogEntry[]>([]);
  const [isTimerActionLoading, setTimerActionLoading] = useState(false);
  const [scheduledNotificationId, setScheduledNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (!outlet) return;
    setTimerState(outlet.timer);
    setTimerPresetSeconds(outlet.timerPresetSeconds ?? DEFAULT_TIMER_SECONDS);
  }, [outlet?.timer, outlet?.timerPresetSeconds, outlet]);

  const applyTimerStatus = useCallback(
    (status: TimerStatusResponse) => {
      const fallbackDuration =
        status.durationSeconds && status.durationSeconds > 0
          ? status.durationSeconds
          : timerPresetSeconds || DEFAULT_TIMER_SECONDS;
      const safeDuration = fallbackDuration > 0 ? fallbackDuration : DEFAULT_TIMER_SECONDS;
      const safeRemaining = status.isActive
        ? Math.max(0, status.remainingSeconds ?? safeDuration)
        : safeDuration;

      const nextState: OutletTimerState = {
        isActive: status.isActive,
        durationSeconds: safeDuration,
        remainingSeconds: safeRemaining,
        endsAt: status.endsAt,
        source: (status.source as TimerSource | null) ?? null,
      };

      setTimerState(nextState);
      setTimerPresetSeconds(safeDuration);
      setCountdownSeconds(safeRemaining);
      updateOutlet(status.outletId, {
        timer: nextState,
        timerPresetSeconds: safeDuration,
      });
    },
    [timerPresetSeconds, updateOutlet],
  );

  const refreshTimerStatus = useCallback(async () => {
    if (!Number.isFinite(outletId)) return;

    try {
      const status = await api.getOutletTimerStatus(outletId);
      applyTimerStatus(status);
    } catch (error) {
      console.error("Failed to fetch timer status:", error);
    }
  }, [outletId, applyTimerStatus]);

  const loadTimerLogs = useCallback(async () => {
    if (!Number.isFinite(outletId)) return;

    try {
      const logs: TimerLogResponse[] = await api.getOutletTimerLogs(outletId);
      setTimerLogs(logs.map(mapTimerLogToOutletLog));
    } catch (error) {
      console.error("Failed to fetch timer logs:", error);
    }
  }, [outletId]);

  useEffect(() => {
    if (!Number.isFinite(outletId)) return;
    void refreshTimerStatus();
    void loadTimerLogs();
  }, [outletId, refreshTimerStatus, loadTimerLogs]);

  useEffect(() => {
    if (!Number.isFinite(outletId)) return;
    const interval = setInterval(() => {
      void loadTimerLogs();
    }, 15000);
    return () => clearInterval(interval);
  }, [outletId, loadTimerLogs]);

  const isGeofenceTimerActive =
    Boolean(timerState?.isActive) &&
    timerState?.source === "GEOFENCE" &&
    geofenceStatus.countdownIsActive &&
    Boolean(geofenceStatus.countdownEndsAt);

  useEffect(() => {
    if (isGeofenceTimerActive) {
      setCountdownSeconds(Math.max(0, geofenceStatus.remainingSeconds));
      return;
    }

    if (!timerState) {
      setCountdownSeconds(timerPresetSeconds);
      return;
    }

    if (!timerState.isActive || !timerState.endsAt) {
      setCountdownSeconds(timerState.durationSeconds);
      return;
    }

    const computeRemaining = () => {
      const parsedEnds = parseIsoDate(timerState.endsAt);
      if (!parsedEnds) {
        return timerPresetSeconds;
      }
      return Math.max(0, Math.round((parsedEnds.getTime() - Date.now()) / 1000));
    };

    setCountdownSeconds(computeRemaining());

    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setCountdownSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        void refreshTimerStatus();
        void loadTimerLogs();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isGeofenceTimerActive, geofenceStatus.remainingSeconds, timerState, timerPresetSeconds, refreshTimerStatus, loadTimerLogs]);

  useEffect(() => {
    if (isGeofenceTimerActive) {
      setCountdownSeconds(Math.max(0, geofenceStatus.remainingSeconds));
    }
  }, [isGeofenceTimerActive, geofenceStatus.remainingSeconds]);

  const handleTimerDurationChange = useCallback(
    async (nextSeconds: number) => {
      if (!Number.isFinite(outletId) || !outlet) return;

      const safeSeconds = Math.max(1, nextSeconds);
      const previousPreset = timerPresetSeconds;
      const previousState = timerState;

      const optimisticState: OutletTimerState =
        timerState && timerState.isActive
          ? { ...timerState }
          : {
              isActive: false,
              durationSeconds: safeSeconds,
              remainingSeconds: safeSeconds,
              endsAt: null,
              source: timerState?.source ?? null,
            };

      setTimerState(optimisticState);
      setTimerPresetSeconds(safeSeconds);
      if (!optimisticState.isActive) {
        setCountdownSeconds(safeSeconds);
      }
      updateOutlet(outletId, {
        timer: optimisticState,
        timerPresetSeconds: safeSeconds,
      });

      try {
        const status = await api.updateOutletTimerPreset(outlet.id, safeSeconds);
        applyTimerStatus(status);
        await loadTimerLogs();
        await refreshOutlets();
      } catch (error) {
        console.error("Failed to update timer preset:", error);
        setTimerState(previousState ?? null);
        setTimerPresetSeconds(previousPreset);
        if (!previousState?.isActive) {
          setCountdownSeconds(previousPreset);
        }
        updateOutlet(outletId, {
          timer: previousState ?? null,
          timerPresetSeconds: previousPreset,
        });
        throw error;
      }
    },
    [
      outlet,
      outletId,
      timerPresetSeconds,
      timerState,
      updateOutlet,
      applyTimerStatus,
      loadTimerLogs,
      refreshOutlets,
    ],
  );

  const handleStartTimer = useCallback(async () => {
    if (!outlet || !Number.isFinite(outletId)) return;
    if (!outlet.isOn) {
      Alert.alert("Timer", "Turn on outlet first before starting timer.");
      return;
    }

    const duration = Math.max(1, timerPresetSeconds);

    try {
      setTimerActionLoading(true);
      const status = await api.startOutletTimer(outlet.id, duration);
      applyTimerStatus(status);
      await loadTimerLogs();
      await refreshOutlets();

      // Schedule notification for when timer completes
      const preferences = await getNotificationPreferences();
      if (preferences.manualTimerCompleted) {
        // Cancel any existing scheduled notification
        if (scheduledNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
        }

        // Schedule new notification
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: "⏰ Timer Completed",
            body: `${outlet.name} timer finished. Outlet has been turned off.`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            seconds: duration,
          },
        });

        setScheduledNotificationId(notificationId);
        console.log(`[Timer] Scheduled notification ${notificationId} for ${duration}s`);
      }
    } catch (error) {
      console.error("Failed to start timer:", error);
      Alert.alert("Timer", "Failed to start timer. Please try again.");
    } finally {
      setTimerActionLoading(false);
    }
  }, [outlet, outletId, timerPresetSeconds, applyTimerStatus, loadTimerLogs, refreshOutlets, scheduledNotificationId]);

  const handleStopTimer = useCallback(async () => {
    if (!outlet || !Number.isFinite(outletId)) return;

    try {
      setTimerActionLoading(true);
      const status = await api.stopOutletTimer(outlet.id);
      applyTimerStatus(status);
      await loadTimerLogs();
      await refreshOutlets();

      // Cancel scheduled notification since timer was stopped
      if (scheduledNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
        setScheduledNotificationId(null);
        console.log(`[Timer] Cancelled scheduled notification ${scheduledNotificationId}`);
      }
    } catch (error) {
      console.error("Failed to stop timer:", error);
      Alert.alert("Timer", "Failed to stop timer. Please try again.");
    } finally {
      setTimerActionLoading(false);
    }
  }, [outlet, outletId, applyTimerStatus, loadTimerLogs, refreshOutlets, scheduledNotificationId]);

  const handleTogglePower = useCallback(async () => {
    if (!outlet) return;

    try {
      // If turning off outlet, cancel any scheduled timer notification
      if (outlet.isOn && scheduledNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationId);
        setScheduledNotificationId(null);
        console.log(`[Timer] Cancelled scheduled notification ${scheduledNotificationId} due to power off`);
      }

      await toggleOutlet(outlet.id);
    } finally {
      await refreshOutlets();
      await refreshTimerStatus();
      await loadTimerLogs();
    }
  }, [outlet, toggleOutlet, refreshOutlets, refreshTimerStatus, loadTimerLogs, scheduledNotificationId]);

  const handleOpenRenameModal = () => {
    if (!outlet) return;
    setNewName(outlet.name);
    setRenameModalVisible(true);
  };

  const handleRename = async () => {
    if (!outlet || !newName.trim()) {
      Alert.alert("Error", "Please enter a valid name");
      return;
    }

    try {
      await renameOutlet(outlet.id, newName.trim());
      await refreshOutlets();
      setRenameModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "Failed to rename outlet");
    }
  };

  if (!outlet) {
    return (
      <View
        className="flex-1 items-center justify-center bg-[#E7E7E7] px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Text className="text-lg font-semibold text-[#0F0E41]">
          Outlet not found
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-full border border-[#0F0E41] px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-[#0F0E41] font-semibold">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTimerEnabled = outlet.isOn;
  const timerStatusText = !isTimerEnabled
    ? "Turn on outlet to use timer"
    : timerState?.isActive
      ? timerState.source === "GEOFENCE"
        ? "Geofence timer running"
        : "Timer running"
      : timerState?.source === "GEOFENCE"
        ? "Geofence timer ready"
        : `Duration ${formatSecondsAsClock(timerPresetSeconds)}`;

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "status", label: "Status" },
    { key: "log", label: "Log" },
  ];

  return (
    <View className="flex-1 bg-[#E7E7E7]" style={{ paddingTop: insets.top }}>
      <View className="px-6 pt-2 pb-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            className="w-11 h-11 items-center justify-center rounded-full bg-white"
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#0F0E41" />
          </TouchableOpacity>

          <View className="flex-row items-center">
            <Text className="text-[22px] font-semibold text-[#0F0E41] mr-3">
              {outlet.name}
            </Text>
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center rounded-full border border-[#D9DBF2] bg-white"
              activeOpacity={0.8}
              onPress={handleOpenRenameModal}
            >
              <Feather name="edit-3" size={18} color="#0F0E41" />
            </TouchableOpacity>
          </View>

          <View className="w-11" />
        </View>
      </View>

      <View className="self-center flex-row items-center rounded-full bg-white p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              className={`px-6 py-2 rounded-full ${
                isActive ? "bg-[#0F0E41]" : "bg-transparent"
              }`}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.9}
            >
              <Text
                className={`text-[14px] font-semibold ${
                  isActive ? "text-white" : "text-[#0F0E41]"
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 28,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "status" ? (
          <StatusSection
            outlet={outlet}
            onTogglePower={handleTogglePower}
            timerState={timerState}
            timerPresetSeconds={timerPresetSeconds}
            countdownSeconds={countdownSeconds}
            timerStatusText={timerStatusText}
            isTimerEnabled={isTimerEnabled}
            onTimerDurationChange={handleTimerDurationChange}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            isTimerActionLoading={isTimerActionLoading}
            isToggling={togglingOutlets?.has(outlet.id)}
          />
        ) : (
          <LogSection logs={timerLogs} />
        )}
      </ScrollView>

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="w-full max-w-sm rounded-[28px] bg-white p-6">
            <Text className="text-[20px] font-semibold text-[#0F0E41] mb-4">
              Rename Outlet
            </Text>

            <TextInput
              className="rounded-2xl bg-[#F3F4FA] px-4 py-3 text-[15px] text-[#0F0E41] mb-6"
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter outlet name"
              placeholderTextColor="#9AA0B8"
              autoFocus
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 rounded-full border border-[#0F0E41] bg-white px-6 py-3.5"
                onPress={() => setRenameModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text className="text-[14px] font-semibold text-[#0F0E41] text-center">
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 rounded-full bg-[#0F0E41] px-6 py-3.5"
                onPress={handleRename}
                activeOpacity={0.9}
              >
                <Text className="text-[14px] font-semibold text-white text-center">
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatusSection({
  outlet,
  onTogglePower,
  timerState,
  timerPresetSeconds,
  countdownSeconds,
  timerStatusText,
  onTimerDurationChange,
  onStartTimer,
  onStopTimer,
  isTimerEnabled,
  isTimerActionLoading,
  isToggling,
}: {
  outlet: Outlet;
  onTogglePower: () => Promise<void> | void;
  timerState: OutletTimerState | null;
  timerPresetSeconds: number;
  countdownSeconds: number;
  timerStatusText: string;
  onTimerDurationChange: (seconds: number) => Promise<void> | void;
  onStartTimer: () => void | Promise<void>;
  onStopTimer: () => void | Promise<void>;
  isTimerEnabled: boolean;
  isTimerActionLoading: boolean;
  isToggling?: boolean;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [draftTimer, setDraftTimer] = useState<TimerDurationValue>(secondsToDuration(timerPresetSeconds));
  const [isSavingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    setDraftTimer(secondsToDuration(timerPresetSeconds));
  }, [timerPresetSeconds]);

  const handleEditTimer = () => {
    setDraftTimer(secondsToDuration(timerPresetSeconds));
    setModalVisible(true);
  };

  const handleConfirmTimer = async (value: TimerDurationValue) => {
    const seconds = durationToSeconds(value);
    setSavingPreset(true);
    try {
      await onTimerDurationChange(seconds);
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Timer", "Failed to update timer duration. Please try again.");
    } finally {
      setSavingPreset(false);
    }
  };

  const connectionStyles =
    outlet.connection === "Connected"
      ? { background: "#C9F9D4", text: "#176D38" }
      : { background: "#E2E2E2", text: "#55596A" };

  const statusRows: { label: string; value: string; isBadge?: boolean }[] = [
    { label: "Runtime", value: outlet.runtime },
    { label: "Connection", value: outlet.connection, isBadge: true },
    { label: "Current Power Draw", value: `${outlet.powerDraw} W` },
  ];

  const isGeofenceTimer = timerState?.source === "GEOFENCE";

  const timerBadgeStyles = !isTimerEnabled
    ? { background: "#E5E7F3", text: "#9AA0B8" }
    : timerState?.isActive
      ? isGeofenceTimer
        ? { background: "#FEE2E2", text: "#B91C1C" }
        : { background: "#DEF7EC", text: "#0E9F6E" }
      : isGeofenceTimer
        ? { background: "#FEF3C7", text: "#B45309" }
        : { background: "#F3F4FA", text: "#6E6F82" };

  const showRunningTimer = Boolean(timerState?.isActive && isTimerEnabled);
  const runningDisplay = secondsToDuration(countdownSeconds);
  const presetDisplay = secondsToDuration(timerPresetSeconds);
  const startDisabled = !isTimerEnabled || isTimerActionLoading || isSavingPreset;
  const stopDisabled = !showRunningTimer || isTimerActionLoading || isSavingPreset;

  return (
    <View>
      <View className="mb-5 rounded-[28px] bg-white px-6 py-5">
        {statusRows.map((row) => (
          <View key={row.label} className="flex-row items-center justify-between py-2">
            <Text className="text-[13px] font-medium text-[#6E6F82]">{row.label}</Text>
            {row.isBadge ? (
              <View className="rounded-full px-3 py-1" style={{ backgroundColor: connectionStyles.background }}>
                <Text className="text-[12px] font-semibold" style={{ color: connectionStyles.text }}>
                  {row.value}
                </Text>
              </View>
            ) : (
              <Text className="text-[15px] font-semibold text-[#0F0E41]">{row.value}</Text>
            )}
          </View>
        ))}
      </View>

      <View className="mb-5 rounded-[28px] bg-white px-6 py-5">
        <View className="flex-row items-center justify-between">
          <View className="max-w-[70%]">
            <Text className="text-[16px] font-semibold text-[#0F0E41]">Power</Text>
            <Text className="mt-1 text-[12px] text-[#6E6F82]">
              {outlet.isOn ? "Outlet is currently active" : "Outlet is turned off"}
            </Text>
          </View>
          <Switch
            value={outlet.isOn}
            onValueChange={() => {
              void onTogglePower();
            }}
            disabled={isToggling}
            thumbColor="#FFFFFF"
            trackColor={{ false: "#CBD2E9", true: "#0F0E41" }}
            ios_backgroundColor="#CBD2E9"
            style={{ opacity: isToggling ? 0.5 : 1 }}
          />
        </View>
      </View>

      <View className="rounded-[28px] bg-white px-6 py-5">
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-[16px] font-semibold text-[#0F0E41]">Timer</Text>
          <View className="px-3 py-1 rounded-full" style={{ backgroundColor: timerBadgeStyles.background }}>
            <Text className="text-[11px] font-semibold" style={{ color: timerBadgeStyles.text }}>
              {timerStatusText}
            </Text>
          </View>
        </View>

        {showRunningTimer ? (
          <View className="rounded-[24px] bg-[#F3F4FA] px-6 py-6">
            <View className="items-center mb-5">
              <Text className="text-[48px] font-bold text-[#0F0E41] tracking-wider">
                {String(runningDisplay.hours).padStart(2, "0")}:
                {String(runningDisplay.minutes).padStart(2, "0")}:
                {String(runningDisplay.seconds).padStart(2, "0")}
              </Text>
              <Text className="text-[13px] text-[#6E6F82] mt-2">
                {isGeofenceTimer ? "Geofence countdown" : "Time Remaining"}
              </Text>
            </View>

            <TouchableOpacity
              className={`rounded-full px-8 py-3.5 ${stopDisabled ? "bg-[#CBD2E9]" : "bg-[#EF4444]"}`}
              onPress={() => {
                void onStopTimer();
              }}
              activeOpacity={stopDisabled ? 1 : 0.9}
              disabled={stopDisabled}
            >
              <Text className="text-[14px] font-semibold text-white text-center">
                {isTimerActionLoading ? "Stopping..." : isGeofenceTimer ? "Stop Countdown" : "Stop Timer"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="rounded-[24px] bg-[#F3F4FA] px-6 py-6">
            <View className="items-center mb-5">
              <Text
                className={`text-[48px] font-bold tracking-wider ${
                  isTimerEnabled ? "text-[#0F0E41]" : "text-[#9AA0B8]"
                }`}
              >
                {String(presetDisplay.hours).padStart(2, "0")}:
                {String(presetDisplay.minutes).padStart(2, "0")}:
                {String(presetDisplay.seconds).padStart(2, "0")}
              </Text>
              <Text className="text-[13px] text-[#6E6F82] mt-2">
                {isGeofenceTimer ? "Geofence Duration" : "Timer Duration"}
              </Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                className={`flex-1 rounded-full px-6 py-3.5 border ${
                  isTimerEnabled && !isSavingPreset ? "bg-white border-[#0F0E41]" : "bg-[#CBD2E9] border-[#CBD2E9]"
                }`}
                onPress={handleEditTimer}
                activeOpacity={isTimerEnabled && !isSavingPreset ? 0.9 : 1}
                disabled={!isTimerEnabled || isTimerActionLoading || isSavingPreset}
              >
                <Text
                  className={`text-[14px] font-semibold text-center ${
                    isTimerEnabled && !isSavingPreset ? "text-[#0F0E41]" : "text-white"
                  }`}
                >
                  Edit Timer
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 rounded-full px-6 py-3.5 ${
                  startDisabled ? "bg-[#9AA0B8]" : "bg-[#0F0E41]"
                }`}
                onPress={() => {
                  void onStartTimer();
                }}
                activeOpacity={startDisabled ? 1 : 0.9}
                disabled={startDisabled}
              >
                <Text className="text-[14px] font-semibold text-white text-center">
                  {isTimerActionLoading ? "Processing..." : isSavingPreset ? "Saving..." : "Start Timer"}
                </Text>
              </TouchableOpacity>
            </View>

            {!isTimerEnabled ? (
              <Text className="mt-4 text-center text-[12px] text-[#6E6F82]">
                Turn on the outlet to configure the timer.
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <TimerPickerModal
        visible={modalVisible}
        value={draftTimer}
        onConfirm={handleConfirmTimer}
        isSaving={isSavingPreset}
        onCancel={() => setModalVisible(false)}
      />
    </View>
  );
}

function LogSection({ logs }: { logs: OutletLogEntry[] }) {
  if (!logs.length) {
    return (
      <View className="items-center rounded-[28px] bg-white px-6 py-16">
        <Text className="text-[15px] font-semibold text-[#0F0E41]">
          No recent activity
        </Text>
        <Text className="mt-2 text-center text-[13px] text-[#6E6F82]">
          Actions, alerts, and automation updates will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {logs.map((log, index) => (
        <View
          key={log.id}
          className={`flex-row items-start rounded-[26px] bg-white px-5 py-4 ${
            index !== logs.length - 1 ? "mb-4" : ""
          }`}
        >
          <LogCategoryIcon category={log.category} />
          <View className="ml-4 flex-1">
            <Text className="text-[12px] text-[#6E6F82]">
              {formatLogTimestamp(log.timestamp)}
            </Text>
            <Text className="mt-1 text-[15px] font-semibold text-[#0F0E41]">
              {log.action}
            </Text>
            <Text className="mt-1 text-[13px] text-[#6E6F82]">
              {log.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function LogCategoryIcon({ category }: { category: OutletLogCategory }) {
  const meta = LOG_CATEGORY_META[category];

  return (
    <View
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: meta.background }}
    >
      <Text className="text-[12px] font-semibold" style={{ color: meta.color }}>
        {meta.label}
      </Text>
    </View>
  );
}

function formatLogTimestamp(timestamp: string) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}
