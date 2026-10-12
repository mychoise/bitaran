import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from './api';

export interface Membership {
  orgId: string;
  orgName: string;
  roleName: string;
  permissions: string[];
  canBuy: boolean;
  canSell: boolean;
  orgStatus: string;
}

export interface User {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
}

export interface AuthContextType {
  user: User | null;
  memberships: Membership[];
  activeOrg: Membership | null;
  isAuthenticated: boolean;
  isPlatformStaff: boolean;
  isFieldSeller: boolean;
  login: (data: { user: User; tokens: { accessToken: string; refreshToken: string }; memberships: Membership[] }) => void;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => void;
  refreshUserData: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('bitaran_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [memberships, setMemberships] = useState<Membership[]>(() => {
    const saved = localStorage.getItem('bitaran_memberships');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    return localStorage.getItem('bitaran_active_org_id');
  });

  const activeOrg = memberships.find((m) => m.orgId === activeOrgId) || memberships[0] || null;

  useEffect(() => {
    if (activeOrg && activeOrg.orgId !== activeOrgId) {
      setActiveOrgId(activeOrg.orgId);
      api.setActiveOrgId(activeOrg.orgId);
    }
  }, [activeOrg, activeOrgId]);

  const login = (data: {
    user: User;
    tokens: { accessToken: string; refreshToken: string };
    memberships: Membership[];
  }) => {
    api.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    setUser(data.user);
    setMemberships(data.memberships);
    localStorage.setItem('bitaran_user', JSON.stringify(data.user));
    localStorage.setItem('bitaran_memberships', JSON.stringify(data.memberships));

    // Default to the first membership
    if (data.memberships.length > 0) {
      const firstOrg = data.memberships[0];
      setActiveOrgId(firstOrg.orgId);
      api.setActiveOrgId(firstOrg.orgId);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    api.clearTokens();
    setUser(null);
    setMemberships([]);
    setActiveOrgId(null);
  };

  const switchOrg = (orgId: string) => {
    const exists = memberships.find((m) => m.orgId === orgId);
    if (exists) {
      setActiveOrgId(orgId);
      api.setActiveOrgId(orgId);
    }
  };

  const refreshUserData = async () => {
    try {
      const data = await api.get<{ memberships: Membership[] }>('/orgs/my');
      if (data && data.memberships) {
        setMemberships(data.memberships);
        localStorage.setItem('bitaran_memberships', JSON.stringify(data.memberships));
      }
    } catch {
      // Silently fail if offline or not logged in
    }
  };

  const isPlatformStaff = memberships.some(
    (m) => m.roleName === 'ADMIN' || m.roleName === 'SUPER_ADMIN',
  );

  const isFieldSeller = memberships.some(
    (m) => m.roleName === 'FIELD_SELLER',
  );

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partial };
      localStorage.setItem('bitaran_user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        activeOrg,
        isAuthenticated: !!user,
        isPlatformStaff,
        isFieldSeller,
        login,
        logout,
        switchOrg,
        refreshUserData,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
