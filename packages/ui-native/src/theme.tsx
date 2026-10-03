import {
  DEFAULT_THEME,
  THEME_NAMES,
  THEME_STORAGE_KEY,
  parseStoredTheme,
  themeChannelVars,
  type ThemeName,
} from '@turf-and-taste/design-tokens';
import { vars } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

const themeStyles = {
  'clubhouse-ivory': vars(themeChannelVars('clubhouse-ivory')),
  'midnight-ivory': vars(themeChannelVars('midnight-ivory')),
} as const;

interface ThemeContextValue {
  theme: ThemeName;
  ready: boolean;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  storage,
}: {
  children: ReactNode;
  storage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
}) {
  const storageRef = useRef(storage);
  storageRef.current = storage;
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    storageRef.current
      .getItem(THEME_STORAGE_KEY)
      .then((value) => {
        if (active) {
          setTheme(parseStoredTheme(value));
        }
      })
      .catch(() => {
        if (active) {
          setTheme(DEFAULT_THEME);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void storageRef.current.setItem(THEME_STORAGE_KEY, theme);
  }, [ready, theme]);

  const value = useMemo(() => ({ theme, ready, setTheme }), [ready, theme]);

  return (
    <ThemeContext.Provider value={value}>
      <View className="flex-1 bg-background" style={themeStyles[theme]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return value;
}

export const themeNames = THEME_NAMES;
