// ============================================
// Module 2: Authentication Context & Hooks
// ============================================

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { User, Role, AuthState, LoginMode, ActivityLog, EmergencyMode, FrontdeskOverride } from '@/types';
import { userDb, roleDb, activityLogDb, sessionDb, ensureModule2DataSeeded } from '@/lib/db/database';

// Default login mode (Module 2.4)
const DEFAULT_LOGIN_MODE: LoginMode = 'none';

// Auth Context Interface
interface AuthContextType extends AuthState {
  // Login methods
  login: (identifier: string, password?: string) => Promise<boolean>;
  logout: () => void;
  
  // Permission checks
  hasPermission: (permissionKey: string) => boolean;
  hasAnyPermission: (keys: string[]) => boolean;
  hasAllPermissions: (keys: string[]) => boolean;
  
  // Emergency mode (Module 2.13)
  enableEmergencyMode: (reason?: string) => void;
  disableEmergencyMode: () => void;
  
  // Frontdesk override (Module 2.9)
  enableFrontdeskOverride: () => void;
  disableFrontdeskOverride: () => void;
  
  // Activity logging (Module 2.10)
  logActivity: (action: string, module: string, details?: Record<string, unknown>, patientId?: string) => void;
  
  // Session management
  updateLastActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate session ID
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Provider Component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialization function
  const initializeAuth = useCallback(() => {
    // Ensure Module 2 data is seeded
    ensureModule2DataSeeded();
    
    // Check if we should auto-login in 'none' mode
    if (DEFAULT_LOGIN_MODE === 'none') {
      const doctorRole = roleDb.getById('role-doctor') as Role;
      const doctorUser = userDb.getById('user-doctor') as User;
      
      if (doctorRole && doctorUser) {
        return {
          isAuthenticated: true,
          user: doctorUser,
          role: doctorRole,
          loginMode: 'none' as const,
          sessionId: generateSessionId(),
          emergencyMode: false,
          frontdeskOverride: false,
        };
      }
    }
    
    return {
      isAuthenticated: false,
      user: null,
      role: null,
      loginMode: DEFAULT_LOGIN_MODE,
      sessionId: null,
      emergencyMode: false,
      frontdeskOverride: false,
    };
  }, []);

  const [authState, setAuthState] = useState<AuthState>(initializeAuth);

  const [emergencyMode, setEmergencyMode] = useState<EmergencyMode>({
    enabled: false,
    enabledBy: '',
    enabledAt: new Date(),
    restrictionsDisabled: false,
  });

  const [frontdeskOverride, setFrontdeskOverride] = useState<FrontdeskOverride>({
    enabled: false,
    enabledBy: '',
    enabledAt: new Date(),
  });

  // Use ref for logActivity to avoid circular dependencies
  const logActivityRef = useRef<(action: string, module: string, details?: Record<string, unknown>, patientId?: string) => void>((action: string, module: string, details?: Record<string, unknown>) => {
    if (authState.user) {
      activityLogDb.create({
        userId: authState.user.id,
        userName: authState.user.name,
        action,
        module,
        details: details || {},
        patientId: undefined,
        ipAddress: '127.0.0.1',
        timestamp: new Date(),
      });
    }
  });

  // Update ref when user changes
  useEffect(() => {
    logActivityRef.current = (action: string, module: string, details?: Record<string, unknown>) => {
      if (authState.user) {
        activityLogDb.create({
          userId: authState.user.id,
          userName: authState.user.name,
          action,
          module,
          details: details || {},
          patientId: undefined,
          ipAddress: '127.0.0.1',
          timestamp: new Date(),
        });
      }
    };
  }, [authState.user]);

  // Login function (Module 2.5)
  const login = useCallback(async (identifier: string, password?: string): Promise<boolean> => {
    // Find user by identifier
    const user = userDb.getByIdentifier(identifier) as User | undefined;
    
    if (!user) {
      return false;
    }

    if (!user.isActive) {
      return false;
    }

    // For 'none' login mode, skip password check
    if (authState.loginMode !== 'none' && password) {
      if (user.password !== password) {
        return false;
      }
    }

    // Get user role
    const role = roleDb.getById(user.roleId) as Role;
    
    if (!role) {
      return false;
    }

    // Update last login
    userDb.update(user.id, { lastLogin: new Date() });

    // Create session
    const sessionId = generateSessionId();
    sessionDb.create({
      userId: user.id,
      deviceId: 'default',
      deviceName: 'Browser',
      ipAddress: '127.0.0.1',
      isActive: true,
      lastActivity: new Date(),
    });

    setAuthState({
      isAuthenticated: true,
      user,
      role,
      loginMode: authState.loginMode,
      sessionId,
      emergencyMode: false,
      frontdeskOverride: false,
    });

    // Log activity using ref
    logActivityRef.current('login', 'auth', { loginMode: authState.loginMode });

    return true;
  }, [authState.loginMode]);

  // Logout function
  const logout = useCallback(() => {
    if (authState.sessionId) {
      sessionDb.update(authState.sessionId, { isActive: false });
    }

    // Log activity using ref
    logActivityRef.current('logout', 'auth');

    setAuthState({
      isAuthenticated: false,
      user: null,
      role: null,
      loginMode: authState.loginMode,
      sessionId: null,
      emergencyMode: false,
      frontdeskOverride: false,
    });
  }, [authState.sessionId, authState.loginMode]);

  // Permission check (Module 2.6)
  const hasPermission = useCallback((permissionKey: string): boolean => {
    // Emergency mode bypasses all restrictions (Module 2.13)
    if (emergencyMode.enabled) {
      return true;
    }

    // Frontdesk override allows frontdesk permissions (Module 2.9)
    if (authState.frontdeskOverride && authState.role?.name === 'Doctor') {
      // Doctor can act as frontdesk
      const frontdeskRole = roleDb.getById('role-frontdesk') as Role;
      return frontdeskRole?.permissions[permissionKey] ?? false;
    }

    if (!authState.role) {
      return false;
    }

    return authState.role.permissions[permissionKey] ?? false;
  }, [authState.role, emergencyMode.enabled, authState.frontdeskOverride]);

  const hasAnyPermission = useCallback((keys: string[]): boolean => {
    return keys.some((key) => hasPermission(key));
  }, [hasPermission]);

  const hasAllPermissions = useCallback((keys: string[]): boolean => {
    return keys.every((key) => hasPermission(key));
  }, [hasPermission]);

  // Emergency mode (Module 2.13)
  const enableEmergencyMode = useCallback((reason?: string) => {
    if (authState.user) {
      setEmergencyMode({
        enabled: true,
        enabledBy: authState.user.id,
        enabledAt: new Date(),
        reason,
        restrictionsDisabled: true,
      });

      setAuthState((prev) => ({
        ...prev,
        emergencyMode: true,
      }));

      // Log activity using ref
      logActivityRef.current('enable_emergency_mode', 'system', { reason });
    }
  }, [authState.user]);

  const disableEmergencyMode = useCallback(() => {
    setEmergencyMode((prev) => ({
      ...prev,
      enabled: false,
      restrictionsDisabled: false,
    }));

    setAuthState((prev) => ({
      ...prev,
      emergencyMode: false,
    }));

    // Log activity using ref
    logActivityRef.current('disable_emergency_mode', 'system');
  }, []);

  // Frontdesk override (Module 2.9)
  const enableFrontdeskOverride = useCallback(() => {
    if (authState.user?.isDoctor && authState.user) {
      setFrontdeskOverride({
        enabled: true,
        enabledBy: authState.user.id,
        enabledAt: new Date(),
      });

      setAuthState((prev) => ({
        ...prev,
        frontdeskOverride: true,
      }));

      // Log activity using ref
      logActivityRef.current('enable_frontdesk_override', 'system');
    }
  }, [authState.user]);

  const disableFrontdeskOverride = useCallback(() => {
    setFrontdeskOverride((prev) => ({
      ...prev,
      enabled: false,
    }));

    setAuthState((prev) => ({
      ...prev,
      frontdeskOverride: false,
    }));

    // Log activity using ref
    logActivityRef.current('disable_frontdesk_override', 'system');
  }, []);

  // Activity logging (Module 2.10)
  const logActivity = useCallback((
    action: string,
    module: string,
    details?: Record<string, unknown>,
    patientId?: string
  ) => {
    logActivityRef.current(action, module, details, patientId);
  }, []);

  // Update last activity (Module 2.12)
  const updateLastActivity = useCallback(() => {
    if (authState.user) {
      userDb.update(authState.user.id, { lastActivity: new Date() });
      
      if (authState.sessionId) {
        sessionDb.update(authState.sessionId, { lastActivity: new Date() });
      }
    }
  }, [authState.user, authState.sessionId]);

  // Activity heartbeat
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(() => {
      updateLastActivity();
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [authState.isAuthenticated, updateLastActivity]);

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    enableEmergencyMode,
    disableEmergencyMode,
    enableFrontdeskOverride,
    disableFrontdeskOverride,
    logActivity,
    updateLastActivity,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to require permission (redirects or throws)
export function useRequirePermission(permissionKey: string): void {
  const { hasPermission, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !hasPermission(permissionKey)) {
      // Could redirect to access denied page
      console.warn(`Permission denied: ${permissionKey}`);
    }
  }, [isAuthenticated, hasPermission, permissionKey]);
}
