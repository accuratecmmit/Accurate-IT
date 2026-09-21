import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  UserProfile,
  UserRole,
  RolePermissions,
  ROLE_DEFINITIONS,
  UserRegistrationInput,
  LoginResult,
} from '../types';
import {
  signInWithGoogle as authSignIn,
  signOutUser,
  syncUserProfile,
  BOOTSTRAP_SUPER_ADMIN_EMAIL,
  loginUser,
  registerEmployee,
  verifyCurrentSession,
  changePassword as apiChangePassword,
  logoutCurrentSession as apiLogoutCurrentSession,
  logoutAllDevices as apiLogoutAllDevices,
  clearStoredToken,
  getStoredToken,
} from '../services/authService';
import { initializeMasterDataIfEmpty } from '../services/masterDataService';
import { logger } from '../lib/logger';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  effectiveRole: UserRole;
  permissions: RolePermissions;
  simulatedRole: UserRole | null;
  setSimulatedRole: (role: UserRole | null) => void;
  isLoading: boolean;
  isSuperAdmin: boolean;

  // Enterprise Credential Auth Methods
  login: (username: string, password: string) => Promise<LoginResult>;
  register: (input: UserRegistrationInput) => Promise<{ success: boolean; message: string; error?: string }>;
  changePassword: (newPass: string, confirmPass: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  logoutCurrentSession: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;

  // Session & Inactivity State
  sessionId: string | null;
  activeSessions: any[];
  mustChangePassword: boolean;
  inactivityWarning: boolean;
  remainingInactivitySeconds: number;
  resetInactivityTimer: () => void;

  // UI Modal State
  authModalOpen: boolean;
  authModalTab: 'LOGIN' | 'REGISTER';
  openAuthModal: (tab?: 'LOGIN' | 'REGISTER') => void;
  closeAuthModal: () => void;
  sessionManagerOpen: boolean;
  openSessionManager: () => void;
  closeSessionManager: () => void;

  // Compatibility
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_WARNING_MS = 25 * 60 * 1000; // Warning at 25 minutes (5 minutes left)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Enterprise session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);

  // Inactivity tracking state
  const [inactivityWarning, setInactivityWarning] = useState<boolean>(false);
  const [remainingInactivitySeconds, setRemainingInactivitySeconds] = useState<number>(300);
  const lastActivityRef = useRef<number>(Date.now());

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [sessionManagerOpen, setSessionManagerOpen] = useState<boolean>(false);

  const openAuthModal = (tab: 'LOGIN' | 'REGISTER' = 'LOGIN') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const openSessionManager = () => setSessionManagerOpen(true);
  const closeSessionManager = () => setSessionManagerOpen(false);

  // Activity tracking for 30-minute inactivity timeout
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setInactivityWarning(false);
    setRemainingInactivitySeconds(300);
  }, []);

  // Check existing session token on mount
  const checkSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await verifyCurrentSession();
      if (res.valid && res.user) {
        setProfile(res.user);
        setSessionId(res.sessionId || null);
        setMustChangePassword(!!res.mustChangePassword);
        setActiveSessions(res.activeSessions || []);
      } else {
        clearStoredToken();
        setProfile(null);
        setSessionId(null);
      }
    } catch (e) {
      logger.warn('Error checking session on mount', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
    // Initialize master data
    initializeMasterDataIfEmpty().catch((err) =>
      logger.warn('Non-blocking master data init check:', err)
    );
  }, [checkSession]);

  // Sync with Firebase Auth as complementary provider
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        if (!profile) {
          try {
            const userProfile = await syncUserProfile(firebaseUser);
            setProfile(userProfile);
          } catch (error) {
            logger.error('Error synchronizing user profile', error);
          }
        }
        // When Super Admin signs into Firebase, verify/seed cloud master data if needed
        if (firebaseUser.email?.toLowerCase() === 'accuratecmmit@gmail.com') {
          initializeMasterDataIfEmpty().catch((err) =>
            logger.warn('Admin master data cloud sync notice:', err)
          );
        }
      }
    });

    return () => unsubscribe();
  }, [profile]);

  // Inactivity monitor loop (30 minutes)
  useEffect(() => {
    if (!profile) return;

    const handleUserEvent = () => {
      // Throttle update
      const now = Date.now();
      if (now - lastActivityRef.current > 2000) {
        lastActivityRef.current = now;
        if (inactivityWarning) {
          setInactivityWarning(false);
        }
      }
    };

    window.addEventListener('mousemove', handleUserEvent);
    window.addEventListener('keydown', handleUserEvent);
    window.addEventListener('mousedown', handleUserEvent);
    window.addEventListener('touchstart', handleUserEvent);
    window.addEventListener('scroll', handleUserEvent);

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        // Auto logout
        logger.info('Session timed out after 30 minutes of inactivity.');
        handleLogoutCurrentSession();
        setInactivityWarning(false);
      } else if (elapsed >= INACTIVITY_WARNING_MS) {
        setInactivityWarning(true);
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setRemainingInactivitySeconds(remaining);
      } else {
        if (inactivityWarning) setInactivityWarning(false);
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleUserEvent);
      window.removeEventListener('keydown', handleUserEvent);
      window.removeEventListener('mousedown', handleUserEvent);
      window.removeEventListener('touchstart', handleUserEvent);
      window.removeEventListener('scroll', handleUserEvent);
      clearInterval(interval);
    };
  }, [profile, inactivityWarning]);

  const actualRole: UserRole = profile?.role || (
    user?.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()
      ? 'SUPER_ADMIN'
      : 'EMPLOYEE'
  );

  const isSuperAdmin = actualRole === 'SUPER_ADMIN';
  const effectiveRole: UserRole = (isSuperAdmin && simulatedRole) ? simulatedRole : actualRole;
  const permissions = ROLE_DEFINITIONS[effectiveRole];

  // Enterprise Credential Login
  const handleLogin = async (username: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const result = await loginUser(username, password);
      if (result.success && result.user) {
        setProfile(result.user);
        setSessionId(result.sessionId || null);
        setMustChangePassword(!!result.mustChangePassword);
        resetInactivityTimer();
        setAuthModalOpen(false);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  // Enterprise Registration
  const handleRegister = async (input: UserRegistrationInput) => {
    setIsLoading(true);
    try {
      const result = await registerEmployee(input);
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  // Password Change
  const handleChangePassword = async (newPass: string, confirmPass: string) => {
    setIsLoading(true);
    try {
      const res = await apiChangePassword(newPass, confirmPass);
      if (res.success) {
        setMustChangePassword(false);
      }
      return res;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout current session
  const handleLogoutCurrentSession = async () => {
    setIsLoading(true);
    try {
      await apiLogoutCurrentSession();
      setProfile(null);
      setUser(null);
      setSessionId(null);
      setSimulatedRole(null);
      setMustChangePassword(false);
      setActiveSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout all devices
  const handleLogoutAllDevices = async () => {
    setIsLoading(true);
    try {
      await apiLogoutAllDevices();
      setProfile(null);
      setUser(null);
      setSessionId(null);
      setSimulatedRole(null);
      setMustChangePassword(false);
      setActiveSessions([]);
      setSessionManagerOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Legacy Google Sign-in
  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      const userProfile = await authSignIn();
      setProfile(userProfile);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await handleLogoutCurrentSession();
  };

  const refreshProfile = async () => {
    await checkSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: actualRole,
        effectiveRole,
        permissions,
        simulatedRole,
        setSimulatedRole,
        isLoading,
        isSuperAdmin,

        login: handleLogin,
        register: handleRegister,
        changePassword: handleChangePassword,
        logoutCurrentSession: handleLogoutCurrentSession,
        logoutAllDevices: handleLogoutAllDevices,

        sessionId,
        activeSessions,
        mustChangePassword,
        inactivityWarning,
        remainingInactivitySeconds,
        resetInactivityTimer,

        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        sessionManagerOpen,
        openSessionManager,
        closeSessionManager,

        signIn: handleSignIn,
        signOut: handleSignOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
