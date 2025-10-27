import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import { TimerDurationValue } from "@/types/timer";

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
  value: TimerDurationValue | null;
  onChange: (value: TimerDurationValue) => void;
}

function formatNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function buildData(values: number[]): WheelItem[] {
  const spacers = Array.from({ length: SPACER_COUNT }, () => null);
  return [...spacers, ...values, ...spacers];
}

function PickerColumn({
  label,
  values,
  selectedValue,
  onValueChange,
}: PickerColumnProps) {
  const listRef = useRef<ScrollView | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const data = useMemo(() => buildData(values), [values]);

  const safeSelected = useMemo(() => {
    if (values.includes(selectedValue)) {
      return selectedValue;
    }
    return values[0] ?? 0;
  }, [selectedValue, values]);

  const selectedIndex = useMemo(
    () => values.indexOf(safeSelected),
    [safeSelected, values]
  );

  const centerVisibleRow = useMemo(() => Math.floor(VISIBLE_ITEMS / 2), []);

  useEffect(() => {
    const index = values.indexOf(safeSelected);
    if (index < 0) {
      return;
    }

    // Position the selected item in the middle visible row
    const dataIndex = index + SPACER_COUNT;
    const offset = (dataIndex - centerVisibleRow) * ITEM_HEIGHT;
    setScrollOffset(offset);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ y: offset, animated: false });
    });
  }, [safeSelected, values, centerVisibleRow]);

  const alignToNearest = useCallback(
    (offset: number) => {
      // Calculate which data item is in the middle visible row
      const middleDataIndex = Math.round(offset / ITEM_HEIGHT) + centerVisibleRow;
      // Convert data index to value index (accounting for spacers)
      const valueIndex = Math.min(
        Math.max(middleDataIndex - SPACER_COUNT, 0),
        values.length - 1
      );
      const nextValue = values[valueIndex];

      // Position this value in the middle row
      const targetOffset = (valueIndex + SPACER_COUNT - centerVisibleRow) * ITEM_HEIGHT;
      setScrollOffset(targetOffset);
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          y: targetOffset,
          animated: true,
        });
      });

      if (nextValue !== undefined && nextValue !== safeSelected) {
        onValueChange(nextValue);
      }
    },
    [onValueChange, safeSelected, values, centerVisibleRow]
  );

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      alignToNearest(event.nativeEvent.contentOffset.y);
    },
    [alignToNearest]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (
        !event.nativeEvent.velocity ||
        Math.abs(event.nativeEvent.velocity.y) < 0.01
      ) {
        alignToNearest(event.nativeEvent.contentOffset.y);
      }
    },
    [alignToNearest]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollOffset(event.nativeEvent.contentOffset.y);
    },
    []
  );

  return (
    <View className="items-center">
      <View
        className="overflow-hidden rounded-[20px] bg-[#EDEFF8]"
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 82 }}
        collapsable={false}
      >
        <ScrollView
          ref={listRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumEnd}
          onScrollEndDrag={handleScrollEndDrag}
          onScroll={handleScroll}
          bounces={false}
          overScrollMode="never"
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          removeClippedSubviews={false}
          persistentScrollbar={Platform.OS === 'android'}
        >
          {data.map((item, index) => {
            const itemPosition = index * ITEM_HEIGHT;
            const visiblePosition = (itemPosition - scrollOffset) / ITEM_HEIGHT;
            const isCenter = Math.abs(visiblePosition - centerVisibleRow) < 0.5;

            return (
              <View
                key={item === null ? `spacer-${index}` : `value-${item}`}
                style={{ height: ITEM_HEIGHT }}
                className="items-center justify-center"
              >
                {item === null ? (
                  <View />
                ) : (
                  <Text
                    className={`text-[20px] ${
                      isCenter
                        ? "font-bold text-[#0F0E41]"
                        : "font-medium text-[#9AA0B8]"
                    }`}
                    style={{ opacity: isCenter ? 1 : 0.32 }}
                  >
                    {formatNumber(item)}
                  </Text>
                )}
              </View>
            );
          })}
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

const FALLBACK_TIMER: TimerDurationValue = {
  hours: 0,
  minutes: 0,
  seconds: 0,
};

export function TimerPicker({ value, onChange }: TimerPickerProps) {
  const timerValue = value ?? FALLBACK_TIMER;

  const hoursOptions = useMemo(() => Array.from({ length: 13 }, (_, index) => index), []);
  const minuteSecondOptions = useMemo(
    () => Array.from({ length: 60 }, (_, index) => index),
    []
  );

  const emitChange = useCallback(
    (partial: Partial<TimerDurationValue>) => {
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
