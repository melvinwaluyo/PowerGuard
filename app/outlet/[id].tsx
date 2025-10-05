import { useMemo, useState } from "react";
import { ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { BottomNavigation } from "@/components/BottomNavigation";
import { TimerPicker } from "@/components/TimerPicker";
import { useOutlets } from "@/context/OutletContext";
import {
  Outlet,
  OutletLogCategory,
  OutletLogEntry,
  OutletTimerSetting,
} from "@/types/outlet";

const LOG_CATEGORY_META: Record<OutletLogCategory, { background: string; color: string; label: string }> = {
  power: { background: "#E8EBFF", color: "#0F0E41", label: "PW" },
  automation: { background: "#E7F5FF", color: "#125B9A", label: "AT" },
  safety: { background: "#FFE8EC", color: "#B42318", label: "SF" },
  maintenance: { background: "#F0F5E9", color: "#20613A", label: "MT" },
};

type DetailTab = "status" | "log";

const DEFAULT_TIMER: OutletTimerSetting = {
  hours: 0,
  minutes: 15,
  seconds: 0,
  isActive: false,
};

export default function OutletDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const outletIdParam = Array.isArray(id) ? id[0] : id;
  const outletId = useMemo(() => Number(outletIdParam), [outletIdParam]);

  const { getOutletById, toggleOutlet, updateOutlet } = useOutlets();
  const outlet = Number.isFinite(outletId) ? getOutletById(outletId) : undefined;

  const [activeTab, setActiveTab] = useState<DetailTab>("status");

  const handleToggleTimer = () => {
    if (!outlet) {
      return;
    }

    const timer = outlet.timer ?? DEFAULT_TIMER;

    updateOutlet(outlet.id, {
      timer: {
        ...timer,
        isActive: outlet.timer ? !outlet.timer.isActive : true,
      },
    });
  };

  const handleTimerChange = (nextTimer: OutletTimerSetting) => {
    if (!outlet) {
      return;
    }

    updateOutlet(outlet.id, {
      timer: {
        ...nextTimer,
        isActive: false,
      },
    });
  };

  if (!outlet) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#E7E7E7] px-6">
        <Text className="text-lg font-semibold text-[#0F0E41]">Outlet not found</Text>
        <TouchableOpacity
          className="mt-6 rounded-full border border-[#0F0E41] px-6 py-3"
          onPress={() => router.back()}
        >
          <Text className="text-[#0F0E41] font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "status", label: "Status" },
    { key: "log", label: "Log" },
  ];

  const timer = outlet.timer ?? DEFAULT_TIMER;
  const timerButtonLabel = outlet.timer?.isActive ? "Stop" : "Start";
  const timerStatusText = outlet.timer
    ? outlet.timer.isActive
      ? "Timer running"
      : "Timer ready"
    : "Preset 15 min timer";

  return (
    <SafeAreaView className="flex-1 bg-[#E7E7E7]">
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
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "status" ? (
          <StatusSection
            outlet={outlet}
            onTogglePower={() => toggleOutlet(outlet.id)}
            timer={timer}
            onTimerChange={handleTimerChange}
            timerStatusText={timerStatusText}
            onToggleTimer={handleToggleTimer}
            timerButtonLabel={timerButtonLabel}
          />
        ) : (
          <LogSection logs={outlet.logs} />
        )}
      </ScrollView>

      <BottomNavigation />
    </SafeAreaView>
  );
}

function StatusSection({
  outlet,
  onTogglePower,
  timer,
  onTimerChange,
  timerStatusText,
  onToggleTimer,
  timerButtonLabel,
}: {
  outlet: Outlet;
  onTogglePower: () => void;
  timer: OutletTimerSetting;
  onTimerChange: (value: OutletTimerSetting) => void;
  timerStatusText: string;
  onToggleTimer: () => void;
  timerButtonLabel: string;
}) {
  const connectionStyles =
    outlet.connection === "Connected"
      ? { background: "#C9F9D4", text: "#176D38" }
      : { background: "#E2E2E2", text: "#55596A" };

  const statusRows: { label: string; value: string; isBadge?: boolean }[] = [
    { label: "Runtime", value: outlet.runtime },
    { label: "Connection", value: outlet.connection, isBadge: true },
    { label: "Current Power Draw", value: `${outlet.powerDraw} W` },
  ];

  return (
    <View>
      <View className="mb-5 rounded-[28px] bg-white px-6 py-5">
        {statusRows.map((row) => (
          <View key={row.label} className="flex-row items-center justify-between py-2">
            <Text className="text-[13px] font-medium text-[#6E6F82]">{row.label}</Text>
            {row.isBadge ? (
              <View
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: connectionStyles.background }}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: connectionStyles.text }}
                >
                  {row.value}
                </Text>
              </View>
            ) : (
              <Text className="text-[15px] font-semibold text-[#0F0E41]">
                {row.value}
              </Text>
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
            onValueChange={onTogglePower}
            thumbColor="#FFFFFF"
            trackColor={{ false: "#CBD2E9", true: "#0F0E41" }}
            ios_backgroundColor="#CBD2E9"
          />
        </View>
      </View>

      <View className="rounded-[28px] bg-white px-6 py-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[16px] font-semibold text-[#0F0E41]">Timer</Text>
          <Text className="text-[12px] text-[#6E6F82]">{timerStatusText}</Text>
        </View>

        <View className="mt-5 rounded-[24px] bg-[#F3F4FA] px-4 py-5">
          <TimerPicker value={timer} onChange={onTimerChange} />

          <TouchableOpacity
            className="mt-6 self-center rounded-full bg-[#0F0E41] px-8 py-3"
            onPress={onToggleTimer}
            activeOpacity={0.9}
          >
            <Text className="text-[14px] font-semibold text-white">{timerButtonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function LogSection({ logs }: { logs: OutletLogEntry[] }) {
  if (!logs.length) {
    return (
      <View className="items-center rounded-[28px] bg-white px-6 py-16">
        <Text className="text-[15px] font-semibold text-[#0F0E41]">No recent activity</Text>
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
            <Text className="mt-1 text-[13px] text-[#6E6F82]">{log.detail}</Text>
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







