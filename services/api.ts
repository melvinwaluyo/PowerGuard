import { Platform } from 'react-native';
import Constants from 'expo-constants';

// PowerGuard API Service
// Automatically detects the backend server IP address
// - Web: localhost
// - Android Emulator: 10.0.2.2 (special alias to host machine)
// - iOS/Physical Devices: Auto-detects from Expo dev server

const getApiBaseUrl = () => {
  // For web, use localhost
  if (Platform.OS === 'web') {
    return 'http://localhost:3000';
  }

  // For Android emulator, use the special alias to reach host machine
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  // For iOS and physical devices, auto-detect IP from Expo
  // This gets the IP address of your development machine automatically
  const expoDebuggerHost = Constants.expoConfig?.hostUri;

  if (expoDebuggerHost) {
    // Extract just the IP address (remove port if present)
    const host = expoDebuggerHost.split(':')[0];
    return `http://${host}:3000`;
  }

  // Fallback to localhost if auto-detection fails
  console.warn('Could not auto-detect backend IP, falling back to localhost');
  return 'http://localhost:3000';
};

const API_BASE_URL = getApiBaseUrl();

export interface GeofenceSetting {
  settingID?: number;
  powerstripID: number;
  isEnabled: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number;
  autoShutdownTime?: number; // in seconds
  countdownIsActive?: boolean;
  countdownEndsAt?: string | null;
  countdownStartedAt?: string | null;
  lastAutoShutdownAt?: string | null;
  lastStatus?: string | null;
}

export interface TimerStatusResponse {
  outletId: number;
  isActive: boolean;
  durationSeconds: number | null;
  endsAt: string | null;
  remainingSeconds: number;
  source: string | null;
}

export interface TimerLogResponse {
  timerLogID: number;
  outletID: number;
  status: string;
  durationSeconds: number | null;
  remainingSeconds: number | null;
  note?: string | null;
  triggeredAt: string;
  source?: string | null;
}

export interface GeofenceEvaluationResponse {
  zone: "INSIDE" | "OUTSIDE";
  distanceMeters: number;
  countdownIsActive: boolean;
  countdownEndsAt: string | null;
  autoShutdownSeconds: number | null;
  triggeredOutlets: number[];
  pendingRequest: {
    requestId: number;
    outletId: number;
    initiatedAt: string;
    expiresAt: string | null;
  } | null;
}

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
    console.log('API Base URL:', this.baseUrl); // Debug log
  }

  // Geofence Settings
  async getGeofenceSetting(powerstripId: number): Promise<GeofenceSetting | null> {
    try {
      const response = await fetch(`${this.baseUrl}/geofence/powerstrip/${powerstripId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if response has content
      const text = await response.text();
      if (!text || text.trim() === '') return null;

      return JSON.parse(text);
    } catch (error) {
      console.error('Error fetching geofence setting:', error);
      throw error;
    }
  }

  async saveGeofenceSetting(data: GeofenceSetting): Promise<GeofenceSetting> {
    try {
      const response = await fetch(`${this.baseUrl}/geofence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error saving geofence setting:', error);
      throw error;
    }
  }

  async updateGeofenceEnabled(powerstripId: number, isEnabled: boolean): Promise<GeofenceSetting> {
    try {
      const response = await fetch(`${this.baseUrl}/geofence/powerstrip/${powerstripId}/enabled`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isEnabled }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating geofence enabled:', error);
      throw error;
    }
  }

  async reportGeofenceLocation(
    powerstripId: number,
    payload: { latitude: number; longitude: number; accuracy?: number },
  ): Promise<GeofenceEvaluationResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/geofence/powerstrip/${powerstripId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error reporting geofence location:', error);
      throw error;
    }
  }

  async confirmAutoShutdown(requestId: number) {
    try {
      const response = await fetch(`${this.baseUrl}/geofence/auto-shutdown/${requestId}/confirm`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error confirming auto shutdown:', error);
      throw error;
    }
  }

  async cancelAutoShutdown(requestId: number) {
    try {
      const response = await fetch(`${this.baseUrl}/geofence/auto-shutdown/${requestId}/cancel`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error cancelling auto shutdown:', error);
      throw error;
    }
  }

  // Outlets
  async getOutlets() {
    try {
      const response = await fetch(`${this.baseUrl}/outlets`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching outlets:', error);
      throw error;
    }
  }

  async getOutlet(id: number) {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching outlet:', error);
      throw error;
    }
  }

  async updateOutletState(id: number, state: boolean) {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${id}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating outlet state:', error);
      throw error;
    }
  }

  async getUsageLogs(outletId: number, limit: number = 100) {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/usage-logs?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching usage logs:', error);
      throw error;
    }
  }

  async updateOutletName(id: number, name: string) {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${id}/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating outlet name:', error);
      throw error;
    }
  }

  // Timers
  async getOutletTimerStatus(outletId: number): Promise<TimerStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/timer`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching timer status:', error);
      throw error;
    }
  }

  async startOutletTimer(outletId: number, durationSeconds: number): Promise<TimerStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/timer/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationSeconds }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error starting outlet timer:', error);
      throw error;
    }
  }

  async stopOutletTimer(outletId: number): Promise<TimerStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/timer/stop`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error stopping outlet timer:', error);
      throw error;
    }
  }

  async updateOutletTimerPreset(outletId: number, durationSeconds: number): Promise<TimerStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/timer/preset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ durationSeconds }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating timer preset:', error);
      throw error;
    }
  }

  async getOutletTimerLogs(outletId: number, limit: number = 20): Promise<TimerLogResponse[]> {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/timer/logs?limit=${limit}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching timer logs:', error);
      throw error;
    }
  }

  // Power Strips
  async getPowerstrips() {
    try {
      const response = await fetch(`${this.baseUrl}/powerstrips`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching powerstrips:', error);
      throw error;
    }
  }

  async getPowerstrip(id: number) {
    try {
      const response = await fetch(`${this.baseUrl}/powerstrips/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching powerstrip:', error);
      throw error;
    }
  }

  // Usage Aggregation APIs for Reporting Charts
  async getHourlyUsage(powerstripId: number, date?: string) {
    try {
      const params = date ? `?date=${date}` : '';
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/hourly${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching hourly usage:', error);
      throw error;
    }
  }

  // Get all dates that have hourly data
  async getAvailableDates(powerstripId: number) {
    try {
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/available-dates`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching available dates:', error);
      throw error;
    }
  }

  async getDailyUsage(powerstripId: number, year?: number, month?: number) {
    try {
      const params = new URLSearchParams();
      if (year) params.append('year', year.toString());
      if (month) params.append('month', month.toString());

      const url = `${this.baseUrl}/powerstrips/${powerstripId}/usage/daily${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching daily usage:', error);
      throw error;
    }
  }

  async getMonthlyUsage(powerstripId: number, year?: number) {
    try {
      const params = year ? `?year=${year}` : '';
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/monthly${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching monthly usage:', error);
      throw error;
    }
  }

  async getPast30DaysUsage(powerstripId: number) {
    try {
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/past30days`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching past 30 days usage:', error);
      throw error;
    }
  }

  async getTodayUsage(powerstripId: number) {
    try {
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/today`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching today usage:', error);
      throw error;
    }
  }

  // Development/Testing Utilities
  async clearAllUsageData() {
    try {
      const response = await fetch(`${this.baseUrl}/outlets/usage-logs/clear`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error clearing usage data:', error);
      throw error;
    }
  }
}

export const api = new ApiService();
