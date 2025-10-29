// PowerGuard API Service
// API URL from environment variables
// Set EXPO_PUBLIC_API_URL in .env file for local development

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';

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
  async getHourlyUsage(powerstripId: number, date?: string, all: boolean = false) {
    try {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (all) params.append('all', 'true');

      const queryString = params.toString() ? `?${params}` : '';
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/hourly${queryString}`);
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

  async getDailyUsage(powerstripId: number, year?: number, month?: number, all: boolean = false) {
    try {
      const params = new URLSearchParams();
      if (all) {
        params.append('all', 'true');
      } else {
        if (year) params.append('year', year.toString());
        if (month) params.append('month', month.toString());
      }

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

  async getMonthlyUsage(powerstripId: number, year?: number, all: boolean = false) {
    try {
      const params = new URLSearchParams();
      if (all) {
        params.append('all', 'true');
      } else if (year) {
        params.append('year', year.toString());
      }

      const queryString = params.toString() ? `?${params}` : '';
      const response = await fetch(`${this.baseUrl}/powerstrips/${powerstripId}/usage/monthly${queryString}`);
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

  // Notifications
  async getOutletNotifications(outletId: number, limit: number = 10, since?: string) {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (since) params.append('since', since);

      const response = await fetch(`${this.baseUrl}/outlets/${outletId}/notifications?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching notifications:', error);
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
