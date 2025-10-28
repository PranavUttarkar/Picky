import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';

// Simple, provider-agnostic analytics wrapper.
// Defaults to no-op/console to avoid breaking the app in any environment.

type Dict = Record<string, any>;

export type AnalyticsConfig = {
  amplitudeApiKey?: string | null; // Public key ok for client; set EXPO_PUBLIC_AMPLITUDE_KEY
};

const STORAGE_KEYS = {
  deviceId: 'analytics_device_id',
  optOut: 'analytics_opt_out',
};

function randomId(): string {
  // Lightweight random ID (not UUID v4 perfect but sufficient for analytics device id)
  const rnd = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
}

async function getPersistentDeviceId(): Promise<string> {
  try {
    // Prefer AsyncStorage (RN), fallback to localStorage on web
    const existing = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.deviceId) : null)
      : (await AsyncStorage.getItem(STORAGE_KEYS.deviceId));
    if (existing) return existing;
    const id = randomId();
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(STORAGE_KEYS.deviceId, id); } catch {}
    } else {
      try { await AsyncStorage.setItem(STORAGE_KEYS.deviceId, id); } catch {}
    }
    return id;
  } catch {
    return randomId();
  }
}

async function getOptOut(): Promise<boolean> {
  try {
    const v = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.optOut) : null)
      : (await AsyncStorage.getItem(STORAGE_KEYS.optOut));
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

async function setOptOutStorage(flag: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEYS.optOut, flag ? '1' : '0');
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.optOut, flag ? '1' : '0');
    }
  } catch {}
}

interface Provider {
  init(config: AnalyticsConfig, state: AnalyticsState): Promise<void>;
  identify(userId: string, traits?: Dict): Promise<void>;
  setUserProperties(traits: Dict): Promise<void>;
  track(name: string, props?: Dict): Promise<void>;
  flush?(): Promise<void>;
}

type AnalyticsState = {
  deviceId: string;
  userId?: string;
  userTraits?: Dict;
  optOut: boolean;
};

class ConsoleProvider implements Provider {
  async init() {}
  async identify(userId: string, traits?: Dict) {
    // eslint-disable-next-line no-console
    console.log('[analytics] identify', { userId, traits });
  }
  async setUserProperties(traits: Dict) {
    // eslint-disable-next-line no-console
    console.log('[analytics] user_properties', traits);
  }
  async track(name: string, props?: Dict) {
    // eslint-disable-next-line no-console
    console.log('[analytics] event', name, props ?? {});
  }
}

// Minimal Amplitude HTTP API v2 provider (no SDK dependency)
class AmplitudeHttpProvider implements Provider {
  private apiKey: string | null = null;
  async init(config: AnalyticsConfig) {
    this.apiKey = config.amplitudeApiKey ?? null;
  }
  async identify(userId: string, traits?: Dict) {
    if (!this.apiKey) return;
    try {
      await fetch('https://api2.amplitude.com/2/httpapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          events: [
            {
              event_type: '$identify',
              user_id: String(userId),
              user_properties: traits ?? {},
              time: Date.now(),
            },
          ],
        }),
      });
    } catch {}
  }
  async setUserProperties(traits: Dict) {
    // Treat as identify
    // Without user id, Amplitude may ignore; rely on track including user_properties too
    return;
  }
  async track(name: string, props?: Dict) {
    if (!this.apiKey) return;
    const { userId, deviceId, userTraits } = Analytics._state;
    try {
      await fetch('https://api2.amplitude.com/2/httpapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          events: [
            {
              event_type: name,
              user_id: userId ? String(userId) : undefined,
              device_id: deviceId,
              event_properties: props ?? {},
              user_properties: userTraits ?? {},
              platform: Platform.OS,
              time: Date.now(),
            },
          ],
        }),
      });
    } catch {}
  }
}

// Singleton controller
class Analytics {
  static _provider: Provider | null = null;
  static _config: AnalyticsConfig = {};
  static _state: AnalyticsState = { deviceId: 'unknown', optOut: false };

  static async init(config?: AnalyticsConfig) {
    if (config) this._config = config;
    const deviceId = await getPersistentDeviceId();
    const optOut = await getOptOut();
    this._state = { deviceId, optOut };
    const key = config?.amplitudeApiKey ?? (process.env.EXPO_PUBLIC_AMPLITUDE_KEY as string | undefined) ?? null;
    // Choose provider: Amplitude HTTP if key provided, else console
    this._provider = key ? new AmplitudeHttpProvider() : new ConsoleProvider();
    await this._provider.init({ amplitudeApiKey: key });
    // App open baseline event
    await this.track('app_open', { platform: Platform.OS });
  }

  static async setOptOut(flag: boolean) {
    this._state.optOut = flag;
    await setOptOutStorage(flag);
  }

  static async identify(userId: string, traits?: Dict) {
    if (!userId) return;
    this._state.userId = String(userId);
    if (traits) this._state.userTraits = { ...(this._state.userTraits ?? {}), ...traits };
    if (this._state.optOut) return;
    try { await this._provider?.identify(String(userId), traits); } catch {}
  }

  static async setUserProperties(traits: Dict) {
    this._state.userTraits = { ...(this._state.userTraits ?? {}), ...traits };
    if (this._state.optOut) return;
    try { await this._provider?.setUserProperties(traits); } catch {}
  }

  static async track(name: string, props?: Dict) {
    if (this._state.optOut) return;
    // Send to configured provider (Amplitude HTTP or console)
    try { await this._provider?.track(name, props); } catch {}
    // Also persist to Supabase for in-database analytics (best-effort)
    try {
      const record = {
        event: name,
        properties: props ?? {},
        platform: Platform.OS,
        device_id: this._state.deviceId,
        screen: (props?.screen ?? undefined) as any,
      } as any;
      // Avoid sending large objects; shallow copy is enough here
      await supabase.from('analytics_events').insert(record);
    } catch {}
  }

  // Helpers for common events
  static async trackScreenView(screen: string, props?: Dict) {
    return this.track('screen_view', { screen, ...props });
  }

  static async trackCTA(name: string, props?: Dict) {
    return this.track('cta_click', { name, ...props });
  }
}

// Public API (named exports) to keep usage consistent
export async function initAnalytics(config?: AnalyticsConfig) {
  return Analytics.init(config);
}

export async function identifyUser(userId: string, traits?: Dict) {
  return Analytics.identify(userId, traits);
}

export async function setUserProperties(traits: Dict) {
  return Analytics.setUserProperties(traits);
}

export async function trackEvent(name: string, props?: Dict) {
  return Analytics.track(name, props);
}

export async function trackScreenView(screen: string, props?: Dict) {
  return Analytics.trackScreenView(screen, props);
}

export async function trackCTA(name: string, props?: Dict) {
  return Analytics.trackCTA(name, props);
}

export async function setAnalyticsOptOut(flag: boolean) {
  return Analytics.setOptOut(flag);
}
