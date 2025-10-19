import { BottomNavigation } from "@/components/BottomNavigation";
import { MobileChart } from "@/components/MobileChart";
import { ReportHeader } from "@/components/ReportHeader";
import React, { useState } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "../../global.css";

const chartData = {
  Day: [
    { time: "6 AM", usage: 120 },
    { time: "9 AM", usage: 180 },
    { time: "12 PM", usage: 160 },
    { time: "3 PM", usage: 200 },
    { time: "6 PM", usage: 150 },
    { time: "9 PM", usage: 190 },
  ],
  Month: [
    { time: "Week 1", usage: 140 },
    { time: "Week 2", usage: 170 },
    { time: "Week 3", usage: 190 },
    { time: "Week 4", usage: 160 },
  ],
  Year: [
    { time: "Jan", usage: 180 },
    { time: "Mar", usage: 160 },
    { time: "Jun", usage: 200 },
    { time: "Sep", usage: 150 },
    { time: "Dec", usage: 220 },
  ],
};

const periods = ["Day", "Month", "Year"] as const;

const PowerUsageChart: React.FC = () => {
  const [period, setPeriod] = useState<"Day" | "Month" | "Year">("Month");

  return (
    <View className="flex-1 bg-[#E7E7E7]">
      <ReportHeader />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: Platform.OS === "web" ? 32 : 16,
          paddingBottom: 120, // Extra padding to avoid navbar covering content
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
          <Text className="text-[#374151] text-lg font-semibold mb-3">
            Power Usage
          </Text>
          {Platform.OS === "web" ? (
            <View className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData[period]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    ticks={[50, 100, 150, 200, 250, 300]}
                    domain={[0, 300]}
                    unit=" W"
                  />
                  <Tooltip />
                  <Line type="monotone" dataKey="usage" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </View>
          ) : (
            <MobileChart data={chartData[period]} maxValue={300} />
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
            <Text className="text-xl font-bold mt-1.5">8.7 kWh</Text>
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
            <Text className="text-[#6B7280] text-[15px]">This Month</Text>
            <Text className="text-xl font-bold mt-1.5">124.5 kWh</Text>
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
            <Text className="text-xl font-bold mt-1.5">450 W</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNavigation activeTab="reporting" />
    </View>
  );
};

export default PowerUsageChart;
