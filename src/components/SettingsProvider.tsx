import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useStorage } from './StorageProvider';
import type { AppSettings } from '../services/storage';

/** §11.4: default rounding increment — matches the plate default (§9.1). */
export const DEFAULT_ROUNDING_INCREMENT = 2.5;

export const DEFAULT_SETTINGS: AppSettings = {
  roundingIncrement: DEFAULT_ROUNDING_INCREMENT,
};

interface SettingsContextValue {
  settings: AppSettings;
  setRoundingIncrement: (increment: number) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  setRoundingIncrement: () => {},
});

interface SettingsProviderProps {
  children: ReactNode;
}

/**
 * Loads persisted app settings once and keeps them in sync with storage
 * (§11.4). `useSettings()` outside the provider falls back to defaults so
 * isolated component tests work without extra wrapping.
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const storage = useStorage();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void storage.getSettings().then((loaded) => {
      if (cancelled) return;
      setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  function setRoundingIncrement(increment: number) {
    const next: AppSettings = { ...settings, roundingIncrement: increment };
    setSettings(next);
    void storage.saveSettings(next);
  }

  return (
    <SettingsContext.Provider value={{ settings, setRoundingIncrement }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
