import { Platform } from 'react-native';

// PowerGuard API Service
// For development:
// - Web: localhost works fine
// - Android Emulator: Use 10.0.2.2 (special alias to host machine)
// - iOS Simulator: localhost works fine
// - Physical Device: Replace with your computer's local IP (e.g., 192.168.1.100)

const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    // Android emulator uses 10.0.2.2 to reach host machine's localhost
    return 'http://10.0.2.2:3000';
  }
  if (Platform.OS === 'ios') {
    // For iOS physical device, use your computer's local IP
    // This also works for iOS simulator
    return 'http://192.168.68.69:3000';
  }
  // For web, localhost works
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
