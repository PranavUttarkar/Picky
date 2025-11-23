import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors as DesignColors } from './designTokens';

// Re-export Colors for backward compatibility
export const Colors = DesignColors;

type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  scheme: Scheme;
  setScheme: (s: Scheme) => void;
  toggleScheme: () => void;
  colors: typeof Colors.light;
};

const THEME_KEY = 'picky.theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  // Prefer user-selected theme; fallback to system if none stored
  const systemScheme = useColorScheme() ?? 'light';
  const [scheme, setSchemeState] = useState<Scheme>(systemScheme === 'dark' ? 'dark' : 'light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY);
        if (stored === 'light' || stored === 'dark') {
          setSchemeState(stored);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setScheme = async (s: Scheme) => {
    setSchemeState(s);
    try {
      await AsyncStorage.setItem(THEME_KEY, s);
    } catch {}
  };

  const toggleScheme = () => setScheme(scheme === 'light' ? 'dark' : 'light');

  const colors = useMemo(() => (scheme === 'dark' ? Colors.dark : Colors.light), [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, setScheme, toggleScheme, colors }),
    [scheme, colors],
  );

  // Render ASAP to avoid layout shift; consumers can read colors immediately once ready
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

// Back-compat helper used throughout the app
export const useThemeColors = () => {
  const { colors } = useTheme();
  return colors;
};
