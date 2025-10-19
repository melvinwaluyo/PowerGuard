import { BottomNavigation } from "@/components/BottomNavigation";
import { ReportHeader } from "@/components/ReportHeader";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    <View style={styles.outerContainer}>
      <ReportHeader/>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs */}
        <View style={styles.tabContainer}>
          {periods.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tabButton, period === p && styles.activeTab]}
              onPress={() => setPeriod(p)}
            >
              <Text style={period === p ? styles.activeTabText : styles.tabText}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Power Usage</Text>
          <View style={styles.chartWrapper}>
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
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Today</Text>
            <Text style={styles.statsValue}>8.7 kWh</Text>
          </View>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>This Month</Text>
            <Text style={styles.statsValue}>124.5 kWh</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Text style={styles.statsLabel}>Current Power Draw</Text>
            <Text style={styles.statsValue}>450 W</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNavigation />
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#E7E7E7",
  },
  scrollContent: {
    flexGrow: 1,
    padding: Platform.OS === "web" ? 32 : 16,
    paddingBottom: 100,
    alignItems: "center", // This centers everything horizontally
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
    width: "100%",
    maxWidth: 600, // Consistent with other content
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  activeTab: {
    backgroundColor: "#0F0E41",
  },
  tabText: {
    color: "#0F0E41",
    fontSize: 16,
    fontWeight: "500",
  },
  activeTabText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  card: {
    width: "100%",
    maxWidth: 600,
    backgroundColor: "white",
    borderRadius: 20,
    padding: Platform.OS === "web" ? 24 : 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#374151",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  chartWrapper: {
    width: "100%",
    height: 260,
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    maxWidth: 600,
    marginTop: 16,
    justifyContent: "space-between",
  },
  statsCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    padding: Platform.OS === "web" ? 24 : 16,
    marginHorizontal: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    minWidth: 0, // Important for flex to work properly
  },
  statsLabel: {
    color: "#6B7280",
    fontSize: 15,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 6,
  },
});

export default PowerUsageChart;