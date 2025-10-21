import { BottomNavigation } from "@/components/BottomNavigation";
import { MobileBarChart } from "@/components/MobileBarChart";
import { ReportHeader } from "@/components/ReportHeader";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert, Animated } from "react-native";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "../../global.css";
import { useOutlets } from "@/context/OutletContext";
import { api } from "@/services/api";

// Default powerstrip ID - TODO: Make this dynamic based on user's powerstrip
const DEFAULT_POWERSTRIP_ID = 1;

const monthFullNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Timezone offset for UTC+7 (420 minutes = 7 hours)
const UTC_PLUS_7_OFFSET = 7 * 60;

// Helper function to convert UTC date to UTC+7
const toUTCPlus7 = (date: Date): Date => {
  const utcTime = date.getTime();
  const utcPlus7Time = utcTime + (UTC_PLUS_7_OFFSET * 60 * 1000);
  return new Date(utcPlus7Time);
};

// Get current time in UTC+7
const nowUTCPlus7 = (): Date => {
  return toUTCPlus7(new Date());
};

// Transform API data to chart format
const transformHourlyData = (apiData: any[]) => {
  const now = nowUTCPlus7();
  const currentHour = now.getUTCHours();

  // Create map of existing data
  const dataMap = new Map();
  apiData.forEach(item => {
    // Convert to UTC+7 and extract hour
    const dateUTCPlus7 = toUTCPlus7(new Date(item.hour));
    const hour = dateUTCPlus7.getUTCHours();
    dataMap.set(hour, item.total_energy_kwh || 0);
  });

  // Generate all 24 hours
  const result = [];
  for (let hour = 0; hour < 24; hour++) {
    const nextHour = hour + 1;
    const timeLabel = `${hour.toString().padStart(2, '0')}:00 - ${nextHour.toString().padStart(2, '0')}:00`;
    const showLabel = hour === 0 || hour === 6 || hour === 12 || hour === 18;
    const usage = dataMap.get(hour) || 0;

    result.push({
      time: showLabel ? `${hour}:00` : "",
      usage: parseFloat(usage.toFixed(3)),
      label: timeLabel,
      hourIndex: hour,
      isFuture: hour > currentHour,
    });
  }
  return result;
};

const transformDailyData = (apiData: any[]) => {
  const now = nowUTCPlus7();
  const currentDay = now.getUTCDate();
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  const monthFullName = monthFullNames[currentMonth];

  // Create map of existing data
  const dataMap = new Map();
  apiData.forEach(item => {
    // Convert to UTC+7 and extract day
    const dateUTCPlus7 = toUTCPlus7(new Date(item.day));
    const day = dateUTCPlus7.getUTCDate();
    dataMap.set(day, item.total_energy_kwh || 0);
  });

  // Get total days in current month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Calculate 5 evenly spaced label positions
  const labelPositions = [
    1,
    Math.round(daysInMonth * 0.25),
    Math.round(daysInMonth * 0.5),
    Math.round(daysInMonth * 0.75),
    daysInMonth
  ];

  const result = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const usage = dataMap.get(day) || 0;
    const dateLabel = `${day}/${currentMonth + 1}`;
    const dayPadded = day.toString().padStart(2, '0');
    const fullDate = `${dayPadded} ${monthFullName} ${currentYear}`;
    const showLabel = labelPositions.includes(day);

    result.push({
      time: showLabel ? dateLabel : "",
      usage: parseFloat(usage.toFixed(1)),
      label: fullDate,
      dayIndex: day,
      isFuture: day > currentDay,
    });
  }
  return result;
};

const transformMonthlyData = (apiData: any[]) => {
  const now = nowUTCPlus7();
  const currentMonth = now.getUTCMonth();

  // Create map of existing data
  const dataMap = new Map();
  apiData.forEach(item => {
    // Convert to UTC+7 and extract month
    const dateUTCPlus7 = toUTCPlus7(new Date(item.month));
    const month = dateUTCPlus7.getUTCMonth();
    dataMap.set(month, item.total_energy_kwh || 0);
  });

  const yearLabelPositions = [0, 3, 7, 11];
  const result = [];

  for (let month = 0; month < 12; month++) {
    const usage = dataMap.get(month) || 0;
    const showLabel = yearLabelPositions.includes(month);

    result.push({
      time: showLabel ? (month + 1).toString() : "",
      usage: parseFloat(usage.toFixed(0)),
      label: monthFullNames[month],
      monthIndex: month,
      isFuture: month > currentMonth,
    });
  }
  return result;
};

// Calculate max value with minimal padding for better visualization
const calculateMaxValue = (data: { usage: number }[]) => {
  if (data.length === 0) return 1;
  const maxUsage = Math.max(...data.map(d => d.usage));

  // Add minimal padding (5%) and round up to a nice number
  const withPadding = maxUsage * 1.05;

  // Round up to nearest appropriate interval based on magnitude
  if (withPadding < 1) {
    // For small values, round to nearest 0.1
    return Math.ceil(withPadding * 10) / 10;
  } else if (withPadding < 10) {
    // For medium values, round to nearest 1
    return Math.ceil(withPadding);
  } else if (withPadding < 100) {
    // For larger values, round to nearest 10
    return Math.ceil(withPadding / 10) * 10;
  } else {
    // For very large values, round to nearest 50
    return Math.ceil(withPadding / 50) * 50;
  }
};

const periods = ["Day", "Month", "Year"] as const;

const PowerUsageChart: React.FC = () => {
  const [period, setPeriod] = useState<"Day" | "Month" | "Year">("Day");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [past30DaysTotal, setPast30DaysTotal] = useState(0);
  const { outlets } = useOutlets();

  // Animation for refresh button
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  // Rotate animation when refreshing
  React.useEffect(() => {
    if (isRefreshing) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isRefreshing]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Calculate total current power draw from all outlets
  const totalPowerDraw = React.useMemo(() => {
    return outlets.reduce((sum, outlet) => sum + outlet.powerDraw, 0);
  }, [outlets]);

  // Fetch data from API
  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const now = nowUTCPlus7();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1; // 1-12

      // Fetch all data in parallel
      const [hourly, daily, monthly, today, past30] = await Promise.all([
        api.getHourlyUsage(DEFAULT_POWERSTRIP_ID),
        api.getDailyUsage(DEFAULT_POWERSTRIP_ID, currentYear, currentMonth),
        api.getMonthlyUsage(DEFAULT_POWERSTRIP_ID, currentYear),
        api.getTodayUsage(DEFAULT_POWERSTRIP_ID),
        api.getPast30DaysUsage(DEFAULT_POWERSTRIP_ID),
      ]);

      // Transform data
      setHourlyData(transformHourlyData(hourly));
      setDailyData(transformDailyData(daily));
      setMonthlyData(transformMonthlyData(monthly));

      // Set totals
      setTodayTotal(typeof today === 'number' ? today : 0);
      setPast30DaysTotal(past30.reduce((sum: number, item: any) => sum + (item.total_energy_kwh || 0), 0));
    } catch (error) {
      console.error('Error fetching usage data:', error);
      // Set empty data on error
      setHourlyData([]);
      setDailyData([]);
      setMonthlyData([]);
      setTodayTotal(0);
      setPast30DaysTotal(0);
    } finally {
      if (isManualRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  // Fetch data on mount only
  useEffect(() => {
    fetchData();
  }, []);

  // Select current period data
  const data = period === "Day" ? hourlyData : period === "Month" ? dailyData : monthlyData;
  const maxValue = React.useMemo(() => calculateMaxValue(data), [data]);

  // Generate unique key for chart to force re-render when data changes
  const chartKey = React.useMemo(() => {
    const dataSum = data.reduce((sum, item) => sum + item.usage, 0);
    return `${period}-${data.length}-${dataSum.toFixed(3)}`;
  }, [data, period]);

  const handleExpand = () => {
    // TODO: Implement expand functionality
    console.log("Expand chart");
  };

  const handleClearData = () => {
    Alert.alert(
      "Clear All Usage Data",
      "⚠️ This will permanently delete ALL usage data. Are you sure?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              await api.clearAllUsageData();
              Alert.alert("Success", "All usage data has been cleared. MQTT simulator will generate new data.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear usage data. Please try again.");
              console.error("Error clearing data:", error);
            }
          }
        }
      ]
    );
  };

  // Calculate total usage for current period
  const getTotalUsage = () => {
    if (data.length === 0) return 0;
    const total = data.reduce((sum, item) => sum + item.usage, 0);
    return total;
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#E7E7E7] items-center justify-center">
        <ActivityIndicator size="large" color="#0F0E41" />
        <Text className="text-[#6B7280] mt-4">Loading usage data...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#E7E7E7]">
      <ReportHeader />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: Platform.OS === "web" ? 32 : 16,
          paddingBottom: 120,
          alignItems: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs */}
        <View className="flex-row bg-white rounded-2xl p-1 mb-4 w-full max-w-[600px]">
          {periods.map((p) => (
            <TouchableOpacity
              key={p}
              className={`flex-1 py-2 px-4 rounded-xl items-center ${
                period === p ? "bg-[#0F0E41]" : ""
              }`}
              onPress={() => setPeriod(p)}
            >
              <Text
                className={`text-base font-medium ${
                  period === p ? "text-white" : "text-[#0F0E41]"
                }`}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Clear Data Button (Development) */}
        <TouchableOpacity
          onPress={handleClearData}
          className="flex-row items-center justify-center bg-red-100 rounded-xl px-4 py-2 mb-4"
          style={{
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text className="text-red-600 text-xs font-semibold ml-2">
            Clear All Usage Data
          </Text>
        </TouchableOpacity>

        {/* Chart Card */}
        <View
          className="w-full max-w-[600px] bg-white rounded-[20px] mb-4"
          style={{
            padding: Platform.OS === "web" ? 24 : 16,
            shadowColor: "#000",
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[#374151] text-lg font-semibold">
                Energy Consumption
              </Text>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  onPress={() => fetchData(true)}
                  className="w-8 h-8 items-center justify-center rounded-full bg-[#F3F4F6]"
                  disabled={isRefreshing}
                >
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={isRefreshing ? "#9CA3AF" : "#0F0E41"}
                    />
                  </Animated.View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleExpand}
                  className="w-8 h-8 items-center justify-center rounded-full bg-[#F3F4F6]"
                >
                  <Ionicons name="expand-outline" size={18} color="#0F0E41" />
                </TouchableOpacity>
              </View>
            </View>
            <View className="flex-row items-baseline">
              <Text className="text-[#0F0E41] text-3xl font-bold">
                {getTotalUsage().toFixed(period === "Year" ? 0 : period === "Month" ? 1 : 2)}
              </Text>
              <Text className="text-[#6B7280] text-base font-medium ml-2">
                kWh
              </Text>
            </View>
            <Text className="text-[#6B7280] text-sm mt-1">
              {(() => {
                const now = nowUTCPlus7();
                switch (period) {
                  case "Day":
                    return now.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC"
                    });
                  case "Month":
                    return now.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC"
                    });
                  case "Year":
                    return now.getUTCFullYear().toString();
                  default:
                    return "";
                }
              })()}
            </Text>
          </View>

          {Platform.OS === "web" ? (
            <View key={chartKey} className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} barCategoryGap="20%" barGap={2}>
                  <defs>
                    <linearGradient id="barGradientWeb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1e40af" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    domain={[0, maxValue]}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload[0]) {
                        const data = payload[0].payload;
                        // Don't show tooltip for empty data or future data
                        if (data.usage === 0 || data.isFuture) {
                          return null;
                        }
                        return (
                          <div style={{
                            backgroundColor: '#0F0E41',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}>
                            <p style={{ color: 'white', fontSize: '12px', fontWeight: '600', margin: '0 0 4px 0' }}>
                              {data.label}
                            </p>
                            <p style={{ color: 'white', fontSize: '14px', fontWeight: '700', margin: 0 }}>
                              {parseFloat(data.usage.toFixed(2))} kWh
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="usage" fill="url(#barGradientWeb)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </View>
          ) : (
            <MobileBarChart key={chartKey} data={data} maxValue={maxValue} unit="kWh" />
          )}
        </View>

        {/* Stats */}
        <View className="flex-row w-full max-w-[600px] mt-4 justify-between">
          <View
            className="flex-1 bg-white rounded-[20px] items-center mx-2 min-w-0"
            style={{
              padding: Platform.OS === "web" ? 24 : 16,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Text className="text-[#6B7280] text-[15px]">Today</Text>
            <Text className="text-xl font-bold mt-1.5">{todayTotal.toFixed(2)} kWh</Text>
          </View>
          <View
            className="flex-1 bg-white rounded-[20px] items-center mx-2 min-w-0"
            style={{
              padding: Platform.OS === "web" ? 24 : 16,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Text className="text-[#6B7280] text-[15px]">Past 30 days</Text>
            <Text className="text-xl font-bold mt-1.5">{past30DaysTotal.toFixed(1)} kWh</Text>
          </View>
        </View>

        <View className="flex-row w-full max-w-[600px] mt-4 justify-between">
          <View
            className="flex-1 bg-white rounded-[20px] items-center mx-2 min-w-0"
            style={{
              padding: Platform.OS === "web" ? 24 : 16,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Text className="text-[#6B7280] text-[15px]">Current Power Draw</Text>
            <Text className="text-xl font-bold mt-1.5">{totalPowerDraw} W</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="reporting" />
    </View>
  );
};

export default PowerUsageChart;
