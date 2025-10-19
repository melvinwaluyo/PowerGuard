import { Dimensions, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

interface DataPoint {
  time: string;
  usage: number;
}

interface MobileChartProps {
  data: DataPoint[];
  maxValue?: number;
}

export function MobileChart({ data, maxValue = 300 }: MobileChartProps) {
  const screenWidth = Dimensions.get("window").width;
  const width = Math.min(screenWidth - 32, 360);
  const height = 240;
  const padding = { top: 20, right: 28, bottom: 56, left: 48 };
  const chartWidth = Math.max(width - padding.left - padding.right, 0);
  const chartHeight = Math.max(height - padding.top - padding.bottom, 0);
  const safeMax = maxValue > 0 ? maxValue : 1;
  const axisBaselineY = padding.top + chartHeight;

  if (!data || data.length === 0) {
    return null;
  }

  const horizontalStep = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((item, index) => {
    const clampedUsage = Math.max(0, Math.min(item.usage, safeMax));
    const proportion = chartHeight === 0 ? 0 : clampedUsage / safeMax;
    const x = padding.left + horizontalStep * index;
    const y = padding.top + chartHeight - proportion * chartHeight;

    return { ...item, x, y };
  });

  const linePath =
    points.length > 0
      ? points
          .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ")
      : "";

  const gradientPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${axisBaselineY} L ${points[0].x} ${axisBaselineY} Z`
      : "";

  const divisions = 3;
  const yAxisTicks = Array.from({ length: divisions + 1 }, (_, index) => {
    const value = (safeMax / divisions) * index;
    const y =
      axisBaselineY - (chartHeight === 0 ? 0 : (value / safeMax) * chartHeight);
    return {
      value: Math.round(value),
      y,
    };
  });

  return (
    <View className="w-full items-center justify-center" style={{ height, paddingHorizontal: 8 }}>
      <Svg width={width} height={height}>
        {gradientPath ? (
          <Path d={gradientPath} fill="#E0E7FF" opacity={0.3} />
        ) : null}

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

        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={axisBaselineY}
          stroke="#D1D5DB"
          strokeWidth={1}
        />
        <Line
          x1={padding.left}
          y1={axisBaselineY}
          x2={width - padding.right}
          y2={axisBaselineY}
          stroke="#D1D5DB"
          strokeWidth={1}
        />

        {linePath ? (
          <Path
            d={linePath}
            stroke="#2563eb"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {points.map((point, index) => (
          <Circle
            key={`point-${index}`}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="#2563eb"
            stroke="#ffffff"
            strokeWidth={2}
          />
        ))}

        {yAxisTicks.map(({ value, y }) => (
          <SvgText
            key={`y-label-${value}`}
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

        {points.map((point, index) => {
          const textAnchor =
            index === 0
              ? "start"
              : index === points.length - 1
              ? "end"
              : "middle";
          const xOffset =
            index === 0 ? 4 : index === points.length - 1 ? -4 : 0;

          return (
            <SvgText
              key={`x-label-${index}`}
              x={point.x + xOffset}
              y={axisBaselineY + 18}
              fontSize={10}
              fill="#6B7280"
              textAnchor={textAnchor}
            >
              {point.time}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
