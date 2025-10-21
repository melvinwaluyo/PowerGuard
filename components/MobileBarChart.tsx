import { useState } from "react";
import { Dimensions, View, Text, GestureResponderEvent } from "react-native";
import Svg, { Rect, Path, Line, Text as SvgText, G, Defs, LinearGradient, Stop } from "react-native-svg";

interface DataPoint {
  time: string;
  usage: number;
  label?: string; // Optional detailed label
  isFuture?: boolean; // Mark if this is future data (no tooltip)
}

interface MobileBarChartProps {
  data: DataPoint[];
  maxValue?: number;
  unit?: string;
}

// Helper function to create a path for a rectangle with rounded top corners only
const createRoundedTopRectPath = (x: number, y: number, width: number, height: number, radius: number): string => {
  // Ensure radius doesn't exceed half the width or height
  const r = Math.min(radius, width / 2, height);

  if (height <= 0 || width <= 0) return '';

  // Start at bottom-left, go counter-clockwise
  return `
    M ${x},${y + height}
    L ${x},${y + r}
    Q ${x},${y} ${x + r},${y}
    L ${x + width - r},${y}
    Q ${x + width},${y} ${x + width},${y + r}
    L ${x + width},${y + height}
    Z
  `;
};

export function MobileBarChart({ data, maxValue = 300, unit = "" }: MobileBarChartProps) {
  const screenWidth = Dimensions.get("window").width;
  const width = Math.min(screenWidth - 32, 360);
  const height = 240;
  const padding = { top: 40, right: 28, bottom: 56, left: 48 }; // Increased top padding for tooltip
  const chartWidth = Math.max(width - padding.left - padding.right, 0);
  const chartHeight = Math.max(height - padding.top - padding.bottom, 0);
  const safeMax = maxValue > 0 ? maxValue : 1;
  const axisBaselineY = padding.top + chartHeight;

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [touchX, setTouchX] = useState<number>(0);

  if (!data || data.length === 0) {
    return null;
  }

  // Adjust for positioning bars between axis labels
  // We have one more label than bars (e.g., 0-24 for 24 bars)
  const numBars = data.filter(d => d.label).length; // Count actual data bars (exclude end marker)
  const barWidth = chartWidth / numBars;
  const barSpacing = barWidth * 0.2; // Add spacing between bars
  const actualBarWidth = barWidth - barSpacing;

  const bars = data.map((item, index) => {
    const clampedUsage = Math.max(0, Math.min(item.usage, safeMax));
    const proportion = chartHeight === 0 ? 0 : clampedUsage / safeMax;
    // Position bars between labels by using the same barWidth calculation
    const x = padding.left + barWidth * index + barSpacing / 2;
    const barHeight = proportion * chartHeight;
    const y = axisBaselineY - barHeight;

    return { ...item, x, y, barHeight };
  });

  const divisions = 3;
  const yAxisTicks = Array.from({ length: divisions + 1 }, (_, index) => {
    const value = (safeMax / divisions) * index;
    const y =
      axisBaselineY - (chartHeight === 0 ? 0 : (value / safeMax) * chartHeight);

    // Format value based on magnitude (avoid showing 0 for small decimals)
    let displayValue: string;
    if (value >= 100) {
      displayValue = Math.round(value).toString();
    } else if (value >= 10) {
      displayValue = value.toFixed(1);
    } else if (value >= 1) {
      displayValue = value.toFixed(1);
    } else {
      displayValue = value.toFixed(2);
    }

    return {
      value: displayValue,
      y,
    };
  });

  const handleTouch = (event: GestureResponderEvent) => {
    const { locationX } = event.nativeEvent;
    setTouchX(locationX);

    // Find which bar was touched
    const relativeX = locationX - padding.left;
    if (relativeX >= 0 && relativeX <= chartWidth) {
      const index = Math.floor(relativeX / barWidth);
      if (index >= 0 && index < data.length) {
        // Don't show tooltip for future data or empty labels
        if (!data[index].isFuture && data[index].label) {
          setActiveIndex(index);
        } else {
          setActiveIndex(null);
        }
      }
    } else {
      setActiveIndex(null);
    }
  };

  const handleTouchEnd = () => {
    setActiveIndex(null);
  };

  return (
    <View className="w-full items-center justify-center" style={{ height, paddingHorizontal: 8 }}>
      {/* Tooltip */}
      {activeIndex !== null && (
        <View
          className="absolute bg-[#0F0E41] rounded-lg px-3 py-2"
          style={{
            top: 10,
            left: Math.max(20, Math.min(width - 100, touchX - 40)),
            zIndex: 10,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          <Text className="text-white text-xs font-semibold">
            {data[activeIndex].label || data[activeIndex].time}
          </Text>
          <Text className="text-white text-sm font-bold mt-0.5">
            {parseFloat(data[activeIndex].usage.toFixed(2))} {unit}
          </Text>
        </View>
      )}

      <Svg
        width={width}
        height={height}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={handleTouchEnd}
      >
        {/* Define gradients */}
        <Defs>
          {/* Normal bar gradient */}
          <LinearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
            <Stop offset="100%" stopColor="#1e40af" stopOpacity="1" />
          </LinearGradient>
          {/* Active bar gradient (darker) */}
          <LinearGradient id="barGradientActive" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
            <Stop offset="100%" stopColor="#1e3a8a" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yAxisTicks.map(({ y }, index) =>
          index === 0 ? null : (
            <Line
              key={`grid-${index}`}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )
        )}

        {/* Y-axis */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={axisBaselineY}
          stroke="#D1D5DB"
          strokeWidth={1}
        />

        {/* X-axis */}
        <Line
          x1={padding.left}
          y1={axisBaselineY}
          x2={width - padding.right}
          y2={axisBaselineY}
          stroke="#D1D5DB"
          strokeWidth={1}
        />

        {/* Bars */}
        {bars.map((bar, index) => (
          <Path
            key={`bar-${index}`}
            d={createRoundedTopRectPath(bar.x, bar.y, actualBarWidth, bar.barHeight, 4)}
            fill={activeIndex === index ? "url(#barGradientActive)" : "url(#barGradient)"}
            opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
          />
        ))}

        {/* Y-axis labels */}
        {yAxisTicks.map(({ value, y }, index) => (
          <SvgText
            key={`y-label-${index}`}
            x={padding.left - 10}
            y={y}
            fontSize={10}
            fill="#6B7280"
            textAnchor="end"
            alignmentBaseline="middle"
          >
            {value}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {data.map((item, index) => {
          if (!item.time) return null; // Skip empty labels

          // Calculate label position: labels mark boundaries between bars
          // For index i, the label is at the left edge of bar i
          const labelX = padding.left + (chartWidth / numBars) * index;

          return (
            <SvgText
              key={`x-label-${index}`}
              x={labelX}
              y={axisBaselineY + 18}
              fontSize={10}
              fill="#6B7280"
              textAnchor="start"
            >
              {item.time}
            </SvgText>
          );
        })}
        {/* Add final boundary label (e.g., 24:00 for day tab) */}
        {numBars === 24 && (
          <SvgText
            x={padding.left + chartWidth}
            y={axisBaselineY + 18}
            fontSize={10}
            fill="#6B7280"
            textAnchor="end"
          >
            24:00
          </SvgText>
        )}
      </Svg>
    </View>
  );
}
