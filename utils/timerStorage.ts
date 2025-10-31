import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_TIMER_KEY = '@powerguard_last_timer_seconds';
const DEFAULT_TIMER_SECONDS = 15 * 60; // 15 minutes fallback
const MIN_TIMER_SECONDS = 10; // Minimum 10 seconds to prevent issues

/**
 * Get the last set timer duration in seconds.
 * Returns the stored value or default (15 minutes) if not found.
 * Ensures the value is at least MIN_TIMER_SECONDS.
 */
export async function getLastTimerSeconds(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(LAST_TIMER_KEY);
    if (value !== null) {
      const parsed = parseInt(value, 10);
      // Validate the parsed value is a positive number and at least the minimum
      if (Number.isFinite(parsed) && parsed >= MIN_TIMER_SECONDS) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to load last timer value:', error);
  }
  return DEFAULT_TIMER_SECONDS;
}

/**
 * Save the timer duration in seconds for future use.
 * Only saves if the value is at least MIN_TIMER_SECONDS.
 */
export async function saveLastTimerSeconds(seconds: number): Promise<void> {
  try {
    if (Number.isFinite(seconds) && seconds >= MIN_TIMER_SECONDS) {
      await AsyncStorage.setItem(LAST_TIMER_KEY, seconds.toString());
      console.log(`[TimerStorage] Saved timer value: ${seconds}s (${Math.floor(seconds/60)} minutes)`);
    } else {
      console.warn(`[TimerStorage] Rejected invalid timer value: ${seconds}s (minimum is ${MIN_TIMER_SECONDS}s)`);
    }
  } catch (error) {
    console.warn('Failed to save last timer value:', error);
  }
}

/**
 * Get the last timer value synchronously (for initialization).
 * Returns default if not available. Use getLastTimerSeconds() for async loading.
 */
export function getLastTimerSecondsSync(): number {
  return DEFAULT_TIMER_SECONDS;
}
