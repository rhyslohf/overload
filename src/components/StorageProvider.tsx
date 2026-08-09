import { createContext, useContext, type ReactNode } from 'react';
import type { StorageService } from '../services/storage';

const StorageContext = createContext<StorageService | null>(null);

interface StorageProviderProps {
  storage: StorageService;
  children: ReactNode;
}

/**
 * Makes the StorageService available to the component tree. Feature code
 * never touches browser storage directly — it reads through `useStorage()`
 * (REQUIREMENTS.md §4.4).
 */
export function StorageProvider({ storage, children }: StorageProviderProps) {
  return (
    <StorageContext.Provider value={storage}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): StorageService {
  const storage = useContext(StorageContext);
  if (!storage) {
    throw new Error('useStorage must be used within a StorageProvider');
  }
  return storage;
}
