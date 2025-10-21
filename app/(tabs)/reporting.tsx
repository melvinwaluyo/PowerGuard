import { BottomNavigation } from "@/components/BottomNavigation";
import { MobileBarChart } from "@/components/MobileBarChart";
import { ReportHeader } from "@/components/ReportHeader";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
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

// Simple seeded random function for consistent dummy data
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate dynamic chart data based on current date/time
// This will be replaced with real DB data later (showing average from 4 outlets)
const generateChartData = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth(); // 0-indexed
  const monthFullNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Day: Generate data for ALL 24 hours (including future hours as empty)
  const todayData = [];
  for (let hour = 0; hour < 24; hour++) {
    // Calculate next hour for interval
    const nextHour = hour + 1;

    // Create interval label for tooltip (e.g., "10:00 - 11:00")
    const timeLabel = `${hour.toString().padStart(2, '0')}:00 - ${nextHour.toString().padStart(2, '0')}:00`;

    // Generate static dummy usage data only for past hours, 0 for future
    const usage = hour <= currentHour ? 0.05 + seededRandom(hour + 100) * 0.2 : 0;

    // Show labels at 0, 6, 12, 18, and add 24 at the end
    const showLabel = hour === 0 || hour === 6 || hour === 12 || hour === 18;
    const labelText = showLabel ? `${hour}:00` : "";

    todayData.push({
      time: labelText,
      usage: parseFloat(usage.toFixed(3)),
      label: timeLabel, // Interval label for tooltip
      hourIndex: hour, // Store for future reference
      isFuture: hour > currentHour, // Mark if this is future data
    });
  }

  // Month: Generate data for ALL days in current month (including future days as empty)
  const monthData = [];
  const currentMonthNumber = now.getMonth() + 1; // 1-12
  const currentMonthName = monthFullNames[currentMonth];
  const currentYear = now.getFullYear();

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

  for (let day = 1; day <= daysInMonth; day++) {
    // Generate static dummy usage data only for past days, 0 for future
    const usage = day <= currentDay ? 3 + seededRandom(day + 200) * 4 : 0;

    // Format as day/month (e.g., "21/10")
    const dateLabel = `${day}/${currentMonthNumber}`;

    // Format full date (e.g., "10 October 2025")
    const dayPadded = day.toString().padStart(2, '0');
    const fullDate = `${dayPadded} ${currentMonthName} ${currentYear}`;

    // Show label if this day is in our calculated positions
    const showLabel = labelPositions.includes(day);

    monthData.push({
      time: showLabel ? dateLabel : "", // day/month format
      usage: parseFloat(usage.toFixed(1)),
      label: fullDate, // Full date for tooltip
      dayIndex: day,
      isFuture: day > currentDay, // Mark if this is future data
    });
  }

  // Year: Generate data for ALL 12 months (including future months as empty)
  const yearData = [];
  // Only show labels at months 1, 4, 8, 12 (indices 0, 3, 7, 11)
  const yearLabelPositions = [0, 3, 7, 11];

  for (let month = 0; month < 12; month++) {
    // Generate static dummy usage data only for past months, 0 for future
    const usage = month <= currentMonth ? 100 + seededRandom(month + 300) * 100 : 0;

    // Only show label if this month is in our label positions
    const showLabel = yearLabelPositions.includes(month);

    yearData.push({
      time: showLabel ? (month + 1).toString() : "", // Show month number (1-12) only at specific positions
      usage: parseFloat(usage.toFixed(0)),
      label: monthFullNames[month], // Full month name for tooltip
      monthIndex: month,
      isFuture: month > currentMonth, // Mark if this is future data
    });
  }

  // Past 30 Days: Generate data for last 30 days
  const past30DaysData = [];
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    const dayOfMonth = date.getDate();
    const monthOfDay = date.getMonth();

    // Generate static dummy usage data (3-7 kWh per day)
    const usage = 3 + seededRandom(dayOfMonth + monthOfDay * 100 + 400) * 4;

    // Format as day/month (e.g., "21/10")
    const dateLabel = `${dayOfMonth}/${monthOfDay + 1}`;

    // Format full date (e.g., "10 October 2025")
    const dayPadded = dayOfMonth.toString().padStart(2, '0');
    const fullDate = `${dayPadded} ${monthFullNames[monthOfDay]} ${date.getFullYear()}`;

    past30DaysData.push({
      time: dateLabel,
      usage: parseFloat(usage.toFixed(1)),
      label: fullDate,
      dayIndex: daysAgo,
    });
  }

  return {
    Day: todayData,
    Month: monthData,
    Year: yearData,
    Past30Days: past30DaysData,
  };
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
  const { outlets } = useOutlets();

  // Calculate total current power draw from all outlets
  const totalPowerDraw = React.useMemo(() => {
    return outlets.reduce((sum, outlet) => sum + outlet.powerDraw, 0);
  }, [outlets]);

  // Generate data dynamically based on current date/time
  const chartData = React.useMemo(() => generateChartData(), []);
  const data = chartData[period];
  const maxValue = React.useMemo(() => calculateMaxValue(data), [data]);

  const handleExpand = () => {
    // TODO: Implement expand functionality
    console.log("Expand chart");
  };

  // Calculate total usage for current period
  const getTotalUsage = () => {
    if (data.length === 0) return 0;
    const total = data.reduce((sum, item) => sum + item.usage, 0);
    return total;
  };

  // Calculate totals for all periods for stat cards
  const todayTotal = React.useMemo(() => {
    return chartData.Day.reduce((sum, item) => sum + item.usage, 0);
  }, [chartData.Day]);

  const past30DaysTotal = React.useMemo(() => {
    return chartData.Past30Days.reduce((sum, item) => sum + item.usage, 0);
  }, [chartData.Past30Days]);

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
              <TouchableOpacity
                onPress={handleExpand}
                className="w-8 h-8 items-center justify-center rounded-full bg-[#F3F4F6]"
              >
                <Ionicons name="expand-outline" size={18} color="#0F0E41" />
              </TouchableOpacity>
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
                const now = new Date();
                switch (period) {
                  case "Day":
                    return now.toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    });
                  case "Month":
                    return now.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric"
                    });
                  case "Year":
                    return now.getFullYear().toString();
                  default:
                    return "";
                }
              })()}
            </Text>
          </View>

          {Platform.OS === "web" ? (
            <View className="w-full h-[260px]">
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
                  <Tooltip />
                  <Bar dataKey="usage" fill="url(#barGradientWeb)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </View>
          ) : (
            <MobileBarChart data={data} maxValue={maxValue} unit="kWh" />
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
