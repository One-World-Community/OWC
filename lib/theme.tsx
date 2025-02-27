import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark' | 'system';

export type Theme = {
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    error: string;
    success: string;
    warning: string;
  };
};

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  colors: Theme['colors'];
};

const lightTheme: Theme = {
  colors: {
    background: '#f8fafc',  // slate-50
    card: '#ffffff',
    text: '#1e293b',        // slate-800
    textSecondary: '#64748b', // slate-500
    border: '#e2e8f0',      // slate-200
    primary: '#6366f1',     // indigo-500
    error: '#dc2626',       // red-600
    success: '#16a34a',     // green-600
    warning: '#ca8a04',     // yellow-600
  },
};

const darkTheme: Theme = {
  colors: {
    background: '#0f172a',  // slate-900
    card: '#1e293b',        // slate-800
    text: '#f1f5f9',        // slate-100
    textSecondary: '#94a3b8', // slate-400
    border: '#334155',      // slate-700
    primary: '#818cf8',     // indigo-400
    error: '#ef4444',       // red-500
    success: '#22c55e',     // green-500
    warning: '#eab308',     // yellow-500
  },
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  setMode: () => {},
  colors: lightTheme.colors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('themeMode');
      if (savedMode) {
        setMode(savedMode as ThemeMode);
      }
    } catch (err) {
      console.error('Failed to load theme preference:', err);
    }
  };

  const updateMode = async (newMode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('themeMode', newMode);
      setMode(newMode);
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    }
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkTheme.colors : lightTheme.colors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode: updateMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};