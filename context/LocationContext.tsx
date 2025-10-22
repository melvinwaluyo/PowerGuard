import { createContext, useContext, useState, ReactNode } from 'react';

interface LocationContextType {
  pendingLocation: { latitude: number; longitude: number } | null;
  setPendingLocation: (location: { latitude: number; longitude: number } | null) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  return (
    <LocationContext.Provider value={{ pendingLocation, setPendingLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
