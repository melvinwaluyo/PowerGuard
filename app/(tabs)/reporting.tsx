import { BottomNavigation } from "@/components/BottomNavigation";
import { MobileBarChart } from "@/components/MobileBarChart";
import { ReportHeader } from "@/components/ReportHeader";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect, useRef } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert, Animated, FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useFocusEffect } from "expo-router";
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

// Transform API data to chart format for a specific date
const transformHourlyData = (apiData: any[], targetDate: Date) => {
  const now = nowUTCPlus7();
  const targetDay = targetDate.getUTCDate();
  const targetMonth = targetDate.getUTCMonth();
  const targetYear = targetDate.getUTCFullYear();

  const isToday = targetDay === now.getUTCDate() &&
                  targetMonth === now.getUTCMonth() &&
                  targetYear === now.getUTCFullYear();
  const currentHour = isToday ? now.getUTCHours() : 23;

  // Create map of existing data - ONLY from target date
  const dataMap = new Map();
  apiData.forEach(item => {
    // Convert to UTC+7 and extract hour
    const dateUTCPlus7 = toUTCPlus7(new Date(item.hour));
    const hour = dateUTCPlus7.getUTCHours();
    const day = dateUTCPlus7.getUTCDate();
    const month = dateUTCPlus7.getUTCMonth();
    const year = dateUTCPlus7.getUTCFullYear();

    // Only include data from target date
    if (day === targetDay && month === targetMonth && year === targetYear) {
      dataMap.set(hour, item.total_energy_kwh || 0);
    }
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
      isFuture: isToday && hour > currentHour,
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

interface DataPage {
  date: Date;
  dateString: string;
  data: any[];
  total: number;
}

const PowerUsageChart: React.FC = () => {
  const [period, setPeriod] = useState<"Day" | "Month" | "Year">("Day");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dayPages, setDayPages] = useState<DataPage[]>([]);
  const [monthPages, setMonthPages] = useState<DataPage[]>([]);
  const [yearPages, setYearPages] = useState<DataPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [past30DaysTotal, setPast30DaysTotal] = useState(0);
  const { outlets } = useOutlets();
  const flatListRef = useRef<FlatList>(null);
  const [containerWidth, setContainerWidth] = useState(600); // Default max width
  const [chartKey, setChartKey] = useState(0); // Key to force chart remount

  // Reset chart when navigating back to this screen
  useFocusEffect(
    React.useCallback(() => {
      // Force chart to remount and clear tooltip when screen gains focus
      setChartKey(prev => prev + 1);
    }, [])
  );

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

      // Build day pages from hourly data
      const dayPagesMap = new Map<string, any[]>();
      hourly.forEach((item: any) => {
        const dateUTCPlus7 = toUTCPlus7(new Date(item.hour));
        const dateKey = `${dateUTCPlus7.getUTCFullYear()}-${dateUTCPlus7.getUTCMonth()}-${dateUTCPlus7.getUTCDate()}`;
        if (!dayPagesMap.has(dateKey)) {
          dayPagesMap.set(dateKey, []);
        }
        dayPagesMap.get(dateKey)!.push(item);
      });

      const dayPagesArray: DataPage[] = Array.from(dayPagesMap.entries())
        .map(([dateKey, items]) => {
          const firstItem = items[0];
          const dateUTCPlus7 = toUTCPlus7(new Date(firstItem.hour));
          const targetDate = new Date(Date.UTC(
            dateUTCPlus7.getUTCFullYear(),
            dateUTCPlus7.getUTCMonth(),
            dateUTCPlus7.getUTCDate()
          ));

          const transformedData = transformHourlyData(hourly, targetDate);
          const total = transformedData.reduce((sum, item) => sum + item.usage, 0);

          return {
            date: targetDate,
            dateString: targetDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC"
            }),
            data: transformedData,
            total: parseFloat(total.toFixed(2))
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()); // Oldest first, swipe right for newer

      setDayPages(dayPagesArray.length > 0 ? dayPagesArray : [{
        date: now,
        dateString: now.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC"
        }),
        data: transformHourlyData([], now),
        total: 0
      }]);

      // Build month pages from daily data
      const monthPagesMap = new Map<string, any[]>();
      daily.forEach((item: any) => {
        const dateUTCPlus7 = toUTCPlus7(new Date(item.day));
        const monthKey = `${dateUTCPlus7.getUTCFullYear()}-${dateUTCPlus7.getUTCMonth()}`;
        if (!monthPagesMap.has(monthKey)) {
          monthPagesMap.set(monthKey, []);
        }
        monthPagesMap.get(monthKey)!.push(item);
      });

      const monthPagesArray: DataPage[] = Array.from(monthPagesMap.entries())
        .map(([monthKey, items]) => {
          const [year, month] = monthKey.split('-').map(Number);
          const targetDate = new Date(Date.UTC(year, month, 1));
          const transformedData = transformDailyData(items);
          const total = transformedData.reduce((sum, item) => sum + item.usage, 0);

          return {
            date: targetDate,
            dateString: targetDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC"
            }),
            data: transformedData,
            total: parseFloat(total.toFixed(1))
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()); // Oldest first

      setMonthPages(monthPagesArray.length > 0 ? monthPagesArray : [{
        date: now,
        dateString: now.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC"
        }),
        data: transformDailyData([]),
        total: 0
      }]);

      // Build year pages from monthly data
      const yearPagesMap = new Map<string, any[]>();
      monthly.forEach((item: any) => {
        const dateUTCPlus7 = toUTCPlus7(new Date(item.month));
        const yearKey = `${dateUTCPlus7.getUTCFullYear()}`;
        if (!yearPagesMap.has(yearKey)) {
          yearPagesMap.set(yearKey, []);
        }
        yearPagesMap.get(yearKey)!.push(item);
      });

      const yearPagesArray: DataPage[] = Array.from(yearPagesMap.entries())
        .map(([yearKey, items]) => {
          const year = parseInt(yearKey);
          const targetDate = new Date(Date.UTC(year, 0, 1));
          const transformedData = transformMonthlyData(items);
          const total = transformedData.reduce((sum, item) => sum + item.usage, 0);

          return {
            date: targetDate,
            dateString: year.toString(),
            data: transformedData,
            total: parseFloat(total.toFixed(0))
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()); // Oldest first

      setYearPages(yearPagesArray.length > 0 ? yearPagesArray : [{
        date: now,
        dateString: now.getUTCFullYear().toString(),
        data: transformMonthlyData([]),
        total: 0
      }]);

      // Set totals
      setTodayTotal(typeof today === 'number' ? today : 0);
      setPast30DaysTotal(past30.reduce((sum: number, item: any) => sum + (item.total_energy_kwh || 0), 0));

      // Default to last page (most recent)
      const lastPageIndex = Math.max(0, dayPagesArray.length - 1);
      setCurrentPageIndex(lastPageIndex);
    } catch (error) {
      console.error('Error fetching usage data:', error);
      // Set empty data on error
      const now = nowUTCPlus7();
      setDayPages([{
        date: now,
        dateString: now.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC"
        }),
        data: [],
        total: 0
      }]);
      setMonthPages([{
        date: now,
        dateString: now.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC"
        }),
        data: [],
        total: 0
      }]);
      setYearPages([{
        date: now,
        dateString: now.getUTCFullYear().toString(),
        data: [],
        total: 0
      }]);
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

  // Track the last checked date to detect day changes
  const lastCheckedDateRef = React.useRef<string>('');

  // Check for day changes and auto-refresh
  useEffect(() => {
    const checkDayChange = () => {
      const now = nowUTCPlus7();
      const currentDateString = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;

      if (lastCheckedDateRef.current && lastCheckedDateRef.current !== currentDateString) {
        fetchData();
      }

      lastCheckedDateRef.current = currentDateString;
    };

    // Check immediately
    checkDayChange();

    // Check every minute for day changes
    const interval = setInterval(checkDayChange, 60000);

    return () => clearInterval(interval);
  }, []);

  // Select current period pages
  const pages = period === "Day" ? dayPages : period === "Month" ? monthPages : yearPages;
  const currentPage = pages[currentPageIndex] || pages[0];
  const data = currentPage?.data || [];
  const maxValue = React.useMemo(() => calculateMaxValue(data), [data]);

  // Reset to last page when period changes
  useEffect(() => {
    const lastIndex = Math.max(0, pages.length - 1);
    setCurrentPageIndex(lastIndex);

    // Scroll to last page
    setTimeout(() => {
      if (pages.length > 0) {
        flatListRef.current?.scrollToIndex({
          index: lastIndex,
          animated: false
        });
      }
    }, 100);
  }, [period, pages.length]);

  // Handle scroll to update current page
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / containerWidth);
    if (index !== currentPageIndex && index >= 0 && index < pages.length) {
      setCurrentPageIndex(index);
    }
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
              Alert.alert("Success", "All usage data has been cleared successfully.");
            } catch (error) {
              Alert.alert("Error", "Failed to clear usage data. Please try again.");
              console.error("Error clearing data:", error);
            }
          }
        }
      ]
    );
  };

  // Calculate total usage for current page
  const getTotalUsage = () => {
    return currentPage?.total || 0;
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
              {currentPage?.dateString || ""}
            </Text>
          </View>

          {/* Carousel for multiple pages */}
          <View
            onLayout={(event) => {
              const { width } = event.nativeEvent.layout;
              setContainerWidth(width);
            }}
            style={{ width: '100%' }}
          >
            <FlatList
              ref={flatListRef}
              data={pages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyExtractor={(item, index) => `${period}-page-${index}`}
              initialScrollIndex={pages.length > 0 ? Math.max(0, pages.length - 1) : 0}
              getItemLayout={(data, index) => ({
                length: containerWidth,
                offset: containerWidth * index,
                index,
              })}
              renderItem={({ item: page, index }) => {
                const pageData = page.data;
                const pageMaxValue = calculateMaxValue(pageData);

                return (
                  <View style={{ width: containerWidth }}>
                    {Platform.OS === "web" ? (
                      <View className="w-full h-[260px]">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={pageData} barCategoryGap="20%" barGap={2}>
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
                              domain={[0, pageMaxValue]}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload[0]) {
                                  const data = payload[0].payload;
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
                      <MobileBarChart
                        key={`${period}-${index}-${currentPageIndex}-${chartKey}`}
                        data={pageData}
                        maxValue={pageMaxValue}
                        unit="kWh"
                      />
                    )}
                  </View>
                );
              }}
            />
          </View>

          {/* Pagination Dots */}
          {pages.length > 1 && (
            <View className="flex-row justify-center items-center mt-4 gap-2">
              {pages.map((_, index) => (
                <View
                  key={`dot-${index}`}
                  className={`h-2 rounded-full ${
                    index === currentPageIndex ? 'w-6 bg-[#0F0E41]' : 'w-2 bg-[#D1D5DB]'
                  }`}
                />
              ))}
            </View>
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
