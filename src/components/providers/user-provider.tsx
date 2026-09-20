'use client';

import { createContext, useContext } from 'react';

export interface UserContextType {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
  };
  member: {
    id: string;
    organizationId: string;
    role: 'employee' | 'manager' | 'admin' | string;
    status: string;
    weeklyTargetHours: string | null;
    department: string | null;
  };
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
    defaultTimezone: string;
    defaultWeeklyHours: string;
  };
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children, value }: { children: React.ReactNode; value: UserContextType }) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
