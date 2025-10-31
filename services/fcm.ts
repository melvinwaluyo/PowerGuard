import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from './api';

const FCM_TOKEN_KEY = 'fcm_token';

/**
 * Request FCM permission and get the device token
 */
export async function requestFCMPermission(): Promise<string | null> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('[FCM] Permission not granted');
      return null;
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log('[FCM] Device token:', token);

    // Save token locally
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);

    return token;
  } catch (error) {
    console.error('[FCM] Failed to get permission/token:', error);
    return null;
  }
}

/**
 * Get the current FCM token (from cache or fresh)
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    // Try to get cached token first
    const cachedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
    if (cachedToken) {
      return cachedToken;
    }

    // Get fresh token
    const token = await messaging().getToken();
    if (token) {
      await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    }
    return token;
  } catch (error) {
    console.error('[FCM] Failed to get token:', error);
    return null;
  }
}

/**
 * Register FCM token with backend
 */
export async function registerFCMToken(token: string): Promise<boolean> {
  try {
    // You'll need to add this endpoint to your backend API
    await api.registerFCMToken({
      token,
      platform: Platform.OS,
      deviceId: await getDeviceId(),
    });
    console.log('[FCM] Token registered with backend');
    return true;
  } catch (error) {
    console.error('[FCM] Failed to register token with backend:', error);
    return false;
  }
}

/**
 * Get a unique device identifier
 */
async function getDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  } catch (error) {
    console.error('[FCM] Failed to get device ID:', error);
    return `${Platform.OS}-fallback-${Date.now()}`;
  }
}

/**
 * Setup FCM handlers for foreground, background, and quit states
 */
export function setupFCMHandlers() {
  // Handle foreground messages (when app is open)
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    console.log('[FCM] Foreground message received:', remoteMessage);

    try {
      // Show local notification using expo-notifications
      if (remoteMessage.notification) {
        const { title, body } = remoteMessage.notification;
        const data = remoteMessage.data || {};

        // Determine channel based on message data
        const isCritical = data.isCritical === 'true' || data.type === 'geofence_exit';
        const channelId = isCritical ? 'critical-alerts-v3' : 'geofence-alerts-v2';

        console.log('[FCM] Scheduling notification:', { title, body, channelId, isCritical });

        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: title || 'PowerGuard Alert',
            body: body || '',
            sound: isCritical ? 'critical.wav' : 'normal.wav',
            priority: isCritical
              ? Notifications.AndroidNotificationPriority.MAX
              : Notifications.AndroidNotificationPriority.HIGH,
            data: data,
          },
          trigger: null,
          ...(Platform.OS === 'android' ? { channelId } : {}),
        });

        console.log('[FCM] Notification scheduled successfully:', notificationId);
      }
    } catch (error) {
      console.error('[FCM] Error displaying foreground notification:', error);
    }
  });

  // Handle background messages (when app is in background but not killed)
  // This is handled by the background handler below

  // Handle notification taps (when user taps on notification)
  const unsubscribeNotificationOpen = messaging().onNotificationOpenedApp(
    (remoteMessage) => {
      console.log('[FCM] Notification opened app:', remoteMessage);
      // Handle navigation based on notification data
      handleNotificationOpen(remoteMessage.data);
    }
  );

  // Check if app was opened by a notification (from quit state)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('[FCM] App opened from quit state by notification:', remoteMessage);
        handleNotificationOpen(remoteMessage.data);
      }
    });

  // Handle token refresh
  const unsubscribeTokenRefresh = messaging().onTokenRefresh(async (token) => {
    console.log('[FCM] Token refreshed:', token);
    await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
    await registerFCMToken(token);
  });

  // Return cleanup function
  return () => {
    unsubscribeForeground();
    unsubscribeNotificationOpen();
    unsubscribeTokenRefresh();
  };
}

/**
 * Handle notification tap/open
 */
function handleNotificationOpen(data: any) {
  console.log('[FCM] Handling notification open with data:', data);

  // Add your navigation logic here based on notification type
  // Example:
  // if (data.type === 'geofence_alert') {
  //   // Navigate to geofence screen
  // }
}

/**
 * Background message handler - MUST be set outside of app lifecycle
 * Call this at the top level of your index.js
 */
export function setBackgroundMessageHandler() {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[FCM] Background message received:', remoteMessage);

    // Process background notification
    // The notification will be automatically displayed by the system
    // You can perform additional background tasks here if needed

    return Promise.resolve();
  });
}

/**
 * Initialize FCM on app startup
 */
export async function initializeFCM() {
  try {
    // Request permission and get token
    const token = await requestFCMPermission();

    if (token) {
      // Register token with backend
      await registerFCMToken(token);

      // Setup message handlers
      const cleanup = setupFCMHandlers();

      console.log('[FCM] Initialized successfully');
      return cleanup;
    } else {
      console.warn('[FCM] Failed to initialize - no token');
      return null;
    }
  } catch (error) {
    console.error('[FCM] Initialization failed:', error);
    return null;
  }
}

/**
 * Unregister FCM token (e.g., on logout)
 */
export async function unregisterFCMToken() {
  try {
    const token = await getFCMToken();
    if (token) {
      // Delete token from backend
      await api.unregisterFCMToken(token);

      // Delete token from Firebase
      await messaging().deleteToken();

      // Clear local storage
      await AsyncStorage.removeItem(FCM_TOKEN_KEY);

      console.log('[FCM] Token unregistered');
    }
  } catch (error) {
    console.error('[FCM] Failed to unregister token:', error);
  }
}
