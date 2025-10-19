import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
} from "react-native";

import { OutletTimerSetting } from "@/types/outlet";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;
const SPACER_COUNT = 1; // number of spacer rows at start/end

type WheelItem = number | null;

interface PickerColumnProps {
  label: string;
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
}

interface TimerPickerProps {
  value: OutletTimerSetting | null;
  onChange: (value: OutletTimerSetting) => void;
}

function formatNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function buildData(values: number[]): WheelItem[] {
  const spacers = Array.from({ length: SPACER_COUNT }, () => null);
  return [...spacers, ...values, ...spacers];
}

function PickerColumn({ label, values, selectedValue, onValueChange }: PickerColumnProps) {
  const listRef = useRef<ScrollView | null>(null);
  const data = useMemo(() => buildData(values), [values]);

  const safeSelected = useMemo(() => {
    if (values.includes(selectedValue)) {
      return selectedValue;
    }
    return values[0] ?? 0;
  }, [selectedValue, values]);

  useEffect(() => {
    const index = values.indexOf(safeSelected);
    if (index < 0) {
      return;
    }

    const offset = (index + SPACER_COUNT) * ITEM_HEIGHT;
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: offset, animated: false });
    });
  }, [safeSelected, values]);

  const alignToNearest = useCallback(
    (offset: number) => {
      const rawIndex = Math.round(offset / ITEM_HEIGHT);
      const valueIndex = Math.min(
        Math.max(rawIndex - SPACER_COUNT, 0),
        values.length - 1
      );
      const nextValue = values[valueIndex];

      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          y: (valueIndex + SPACER_COUNT) * ITEM_HEIGHT,
          animated: true,
        });
      });

      if (nextValue !== undefined && nextValue !== safeSelected) {
        onValueChange(nextValue);
      }
    },
    [onValueChange, safeSelected, values]
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      alignToNearest(event.nativeEvent.contentOffset.y);
    },
    [alignToNearest]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!event.nativeEvent.velocity || Math.abs(event.nativeEvent.velocity.y) < 0.01) {
        alignToNearest(event.nativeEvent.contentOffset.y);
      }
    },
    [alignToNearest]
  );

  return (
    <View className="items-center">
      <View
        className="overflow-hidden rounded-[20px] bg-[#EDEFF8]"
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 82 }}
      >
        <ScrollView
          ref={listRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleScrollEndDrag}
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
        >
          {data.map((item, index) => (
            <View
              key={item === null ? `spacer-${index}` : `value-${item}`}
              style={{ height: ITEM_HEIGHT }}
              className="items-center justify-center"
            >
              {item === null ? (
                <View />
              ) : (
                <Text
                  className={`text-[20px] font-semibold ${
                    item === safeSelected ? "text-[#0F0E41]" : "text-[#9AA0B8]"
                  }`}
                >
                  {formatNumber(item)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
        <View
          pointerEvents="none"
          className="absolute left-0 right-0"
          style={{
            top: ITEM_HEIGHT,
            height: ITEM_HEIGHT,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: "#D9DBF2",
            backgroundColor: "rgba(255,255,255,0.45)",
          }}
        />
      </View>
      <Text className="mt-3 text-[11px] uppercase tracking-[1px] text-[#6E6F82]">
        {label}
      </Text>
    </View>
  );
}

const FALLBACK_TIMER: OutletTimerSetting = {
  hours: 0,
  minutes: 0,
  seconds: 0,
  isActive: false,
};

export function TimerPicker({ value, onChange }: TimerPickerProps) {
  const timerValue = value ?? FALLBACK_TIMER;

  const hoursOptions = useMemo(() => Array.from({ length: 13 }, (_, index) => index), []);
  const minuteSecondOptions = useMemo(
    () => Array.from({ length: 60 }, (_, index) => index),
    []
  );

  const emitChange = useCallback(
    (partial: Partial<OutletTimerSetting>) => {
      onChange({ ...timerValue, ...partial });
    },
    [onChange, timerValue]
  );

  return (
    <View className="items-center">
      <View className="flex-row items-center justify-center">
        <PickerColumn
          label="hours"
          values={hoursOptions}
          selectedValue={timerValue.hours}
          onValueChange={(next) => emitChange({ hours: next })}
        />
        <Text className="mx-2 text-[22px] font-semibold text-[#0F0E41]">:</Text>
        <PickerColumn
          label="min"
          values={minuteSecondOptions}
          selectedValue={timerValue.minutes}
          onValueChange={(next) => emitChange({ minutes: next })}
        />
        <Text className="mx-2 text-[22px] font-semibold text-[#0F0E41]">:</Text>
        <PickerColumn
          label="sec"
          values={minuteSecondOptions}
          selectedValue={timerValue.seconds}
          onValueChange={(next) => emitChange({ seconds: next })}
        />
      </View>
    </View>
  );
}
