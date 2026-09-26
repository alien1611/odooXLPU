import React, { createContext, useState, useEffect } from 'react';
import api from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('stockyard_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => api.getAuthToken());
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    async function verifyAuth() {
      if (token) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          localStorage.setItem('stockyard_user', JSON.stringify(profile));
        } catch (err) {
          console.warn('[AUTH] Stored token invalid or expired:', err.message);
          logout();
        }
      }
      setLoading(false);
    }
    verifyAuth();
  }, [token]);

  const login = async (credentials) => {
    const data = await api.login(credentials);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const signup = async (payload) => {
    const data = await api.signup(payload);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const logout = () => {
    api.clearAuthToken();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        signup,
        logout,
        isManager: user?.role === 'inventory_manager' || user?.role === 'admin',
        isStaff: user?.role === 'warehouse_staff'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
