// app/(tabs)/pao/badge-ctx.tsx
import React, { createContext, useContext, useState } from 'react';

type BadgeState = { passengerLog: number };
type Ctx = BadgeState & { setPassengerLog: (n: number) => void };

const BadgeContext = createContext<Ctx>({
  passengerLog: 0,
  setPassengerLog: () => {},
});

export const BadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [passengerLog, setPassengerLog] = useState(0);
  return (
    <BadgeContext.Provider value={{ passengerLog, setPassengerLog }}>
      {children}
    </BadgeContext.Provider>
  );
};

export const useBadge = () => useContext(BadgeContext);
