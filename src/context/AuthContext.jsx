import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('contract_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('contract_auth_token'));
  const [loading, setLoading] = useState(true);

  // Initialize and verify user on mount
  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const res = await authService.me();
          if (res.data) {
            setUser(res.data);
            localStorage.setItem('contract_auth_user', JSON.stringify(res.data));
          }
        } catch {
          // Token invalid or expired
          setUser(null);
          setToken(null);
          localStorage.removeItem('contract_auth_token');
          localStorage.removeItem('contract_auth_user');
        }
      }
      setLoading(false);
    }
    verifyAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    const { user: authUser, token: authToken } = res.data;

    setUser(authUser);
    setToken(authToken);

    localStorage.setItem('contract_auth_token', authToken);
    localStorage.setItem('contract_auth_user', JSON.stringify(authUser));

    return authUser;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Continue cleanup on failure
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('contract_auth_token');
      localStorage.removeItem('contract_auth_user');
    }
  };

  const rawRole =
    user?.role?.slug ||
    user?.role?.name ||
    (typeof user?.role === 'string' ? user.role : '') ||
    user?.role_name ||
    user?.role_slug ||
    '';

  const normalizedRole = String(rawRole).toLowerCase().trim().replace(/[-_]/g, '');
  const userEmail = String(user?.email || '').toLowerCase().trim();

  // accounts@vrgroup.net.in is explicitly the designated administrator
  const isDesignatedAdmin =
    userEmail === 'accounts@vrgroup.net.in' ||
    userEmail === 'admin@contract.test' ||
    userEmail.startsWith('admin@');

  const isAdmin =
    isDesignatedAdmin ||
    normalizedRole.includes('admin') ||
    user?.role_id === 1 ||
    user?.is_admin === true ||
    Boolean(user?.is_super_admin);

  const isManager = normalizedRole.includes('manager') || user?.role_id === 2;
  const isSupervisor = normalizedRole.includes('supervisor') || user?.role_id === 3;
  const isWorker = normalizedRole.includes('worker') || user?.role_id === 4;

  const role = isAdmin
    ? 'admin'
    : isManager
    ? 'manager'
    : isSupervisor
    ? 'supervisor'
    : isWorker
    ? 'worker'
    : normalizedRole;

  // Specific permission helpers
  const canAssignStock = isAdmin || isSupervisor; // Manager CANNOT assign stock to workers
  const canApproveStock = isAdmin || isManager;   // Supervisor CANNOT approve; only Manager or Admin

  const hasRole = (allowedRoles) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.includes(role);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token && user),
      role,
      isAdmin,
      isManager,
      isSupervisor,
      isWorker,
      canAssignStock,
      canApproveStock,
      hasRole,
      login,
      logout,
    }),
    [user, token, loading, role, isAdmin, isManager, isSupervisor, isWorker, canAssignStock, canApproveStock]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
