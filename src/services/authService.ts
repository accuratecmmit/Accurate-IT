import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, removeUndefinedFields } from '../lib/firebase';
import { parseResponseJson } from '../lib/apiClient';
import {
  UserProfile,
  UserRole,
  OperationType,
  UserRegistrationInput,
  LoginResult,
  UserSession,
} from '../types';
import { handleFirestoreError } from '../lib/errors';
import { logAuditEvent } from './auditService';
import { logger } from '../lib/logger';

// Designate the bootstrap Super Admin
export const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'accuratecmmit@gmail.com';

const TOKEN_KEY = 'accurate_auth_token';
const SESSION_ID_KEY = 'accurate_session_id';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string, sessionId?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (sessionId) localStorage.setItem(SESSION_ID_KEY, sessionId);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Register employee with 9 mandatory fields and strict business rules.
 */
export async function registerEmployee(
  input: UserRegistrationInput
): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const parsed = await parseResponseJson(res, 'Registration failed');
    if (!parsed.ok || !parsed.data) {
      return { success: false, message: parsed.error || 'Registration failed', error: parsed.error };
    }
    const data = parsed.data;
    return { success: true, message: data.message, userId: data.userId };
  } catch (err: any) {
    logger.error('Registration network error', err);
    return { success: false, message: err.message || 'Network error during registration', error: err.message };
  }
}

/**
 * Login user with enterprise login security:
 * - 5 incorrect password attempts causes a 15-minute lockout
 * - Failed attempt counter is NOT reset automatically
 * - Warning after 3rd attempt
 * - Returns lockout remaining seconds
 */
export async function loginUser(username: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const parsed = await parseResponseJson(res, 'Login failed');

    if (!parsed.ok || !parsed.data) {
      return {
        success: false,
        error: parsed.error || 'Login failed',
      };
    }

    const data = parsed.data;
    if (data.error && !data.token) {
      return {
        success: false,
        error: data.error || 'Login failed',
        isLocked: data.isLocked || false,
        lockoutUntil: data.lockoutUntil,
        remainingSeconds: data.remainingSeconds,
        failedAttempts: data.failedAttempts,
        remainingAttempts: data.remainingAttempts,
        warnAfter3rdAttempt: data.warnAfter3rdAttempt,
        status: data.status,
        rejectionReason: data.rejectionReason,
      };
    }

    // Save token
    if (data.token) {
      setStoredToken(data.token, data.sessionId);
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
      sessionId: data.sessionId,
      mustChangePassword: data.mustChangePassword,
    };
  } catch (err: any) {
    logger.error('Login network error', err);
    return { success: false, error: err.message || 'Connection error to authentication service' };
  }
}

/**
 * Verify active session, enforce 30-minute inactivity, and check account status.
 */
export async function verifyCurrentSession(): Promise<{
  valid: boolean;
  user?: UserProfile;
  sessionId?: string;
  mustChangePassword?: boolean;
  activeSessions?: any[];
  error?: string;
}> {
  const token = getStoredToken();
  if (!token) return { valid: false };

  try {
    const res = await fetch('/api/auth/session', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      clearStoredToken();
      return { valid: false };
    }
    const parsed = await parseResponseJson(res, 'Session check failed');
    if (!parsed.ok || !parsed.data) {
      clearStoredToken();
      return { valid: false };
    }
    const data = parsed.data;
    return {
      valid: true,
      user: data.user,
      sessionId: data.sessionId,
      mustChangePassword: data.mustChangePassword,
      activeSessions: data.activeSessions,
    };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Forced / voluntary password change obeying 5 security criteria.
 */
export async function changePassword(
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword, confirmPassword }),
    });
    const parsed = await parseResponseJson(res, 'Failed to update password');
    if (!parsed.ok || !parsed.data) {
      return { success: false, error: parsed.error || 'Failed to update password' };
    }
    const data = parsed.data;
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Terminate current session.
 */
export async function logoutCurrentSession(): Promise<{ success: boolean; message?: string }> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch (e) {
    // Ignore error
  } finally {
    clearStoredToken();
    try {
      await firebaseSignOut(auth);
    } catch (_) {}
  }
  return { success: true };
}

/**
 * Terminate all active sessions across all devices for this user.
 */
export async function logoutAllDevices(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch('/api/auth/logout-all', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    clearStoredToken();
    return { success: true, message: parsed.data?.message || 'All devices logged out' };
  } catch (err: any) {
    clearStoredToken();
    return { success: true, message: 'All devices logged out' };
  }
}

// ==========================================
// ADMIN USER-MANAGEMENT APIs
// ==========================================

export async function fetchAdminUsers(): Promise<{
  users: UserProfile[];
  activeSessions: any[];
  auditLogs: any[];
}> {
  const res = await fetch('/api/admin/users', {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res, 'Failed to fetch users from server.');
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.error || 'Failed to fetch users from server.');
  }
  return parsed.data;
}

export async function adminApproveUser(
  userId: string,
  role?: UserRole
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  const res = await fetch('/api/admin/approve-user', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, role }),
  });
  const parsed = await parseResponseJson(res, 'Approval failed');
  if (!parsed.ok || !parsed.data) throw new Error(parsed.error || 'Approval failed');
  return parsed.data;
}

export async function adminRejectUser(
  userId: string,
  rejectionReason: string
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  const res = await fetch('/api/admin/reject-user', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, rejectionReason }),
  });
  const parsed = await parseResponseJson(res, 'Rejection failed');
  if (!parsed.ok || !parsed.data) throw new Error(parsed.error || 'Rejection failed');
  return parsed.data;
}

export async function adminResetPassword(
  userId: string,
  customTemporaryPassword?: string
): Promise<{ success: boolean; temporaryPassword?: string; message?: string }> {
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, customTemporaryPassword }),
  });
  const parsed = await parseResponseJson(res, 'Password reset failed');
  if (!parsed.ok || !parsed.data) throw new Error(parsed.error || 'Password reset failed');
  return parsed.data;
}

export async function adminResetFailedAttempts(
  userId: string
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  const res = await fetch('/api/admin/reset-failed-counter', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId }),
  });
  const parsed = await parseResponseJson(res, 'Reset counter failed');
  if (!parsed.ok || !parsed.data) throw new Error(parsed.error || 'Reset counter failed');
  return parsed.data;
}

export async function adminTerminateSessions(options: {
  userId?: string;
  sessionId?: string;
  all?: boolean;
}): Promise<{ success: boolean; terminatedCount?: number; message?: string }> {
  const res = await fetch('/api/admin/terminate-sessions', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(options),
  });
  const parsed = await parseResponseJson(res, 'Session termination failed');
  if (!parsed.ok || !parsed.data) throw new Error(parsed.error || 'Session termination failed');
  return parsed.data;
}

export async function adminToggleUserStatus(
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED'
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  const res = await fetch('/api/admin/toggle-user-status', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ userId, status }),
  });
  const parsed = await parseResponseJson(res, 'Status change failed');
  if (!parsed.ok || !parsed.data) throw new Error(parsed.error || 'Status change failed');
  return parsed.data;
}

// ==========================================
// GOOGLE AUTH INTEGRATION & FIRESTORE SYNC
// ==========================================

export async function signInWithGoogle(): Promise<UserProfile> {
  const path = 'users';
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const userProfile = await syncUserProfile(user);

    await logAuditEvent({
      action: 'USER_SIGNED_IN',
      entityType: 'AUTH',
      entityId: user.uid,
      actorRole: userProfile.role,
      details: { email: user.email, provider: 'google.com' },
    });

    return userProfile;
  } catch (error) {
    logger.error('Google Sign-In failed', error);
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function signOutUser(currentRole?: UserRole): Promise<void> {
  await logoutCurrentSession();
}

export async function syncUserProfile(user: User): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  const isSuperAdminEmail = user.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();

  try {
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const existing = userSnap.data() as UserProfile;
      const effectiveRole: UserRole = isSuperAdminEmail ? 'SUPER_ADMIN' : existing.role;

      if (existing.role !== effectiveRole) {
        await updateDoc(userDocRef, {
          role: effectiveRole,
          updatedAt: now,
        });
        existing.role = effectiveRole;
      }

      if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'IT_ADMIN') {
        await ensureAdminRecord(user.uid, user.email || '', effectiveRole);
      }

      return existing;
    } else {
      const initialRole: UserRole = isSuperAdminEmail ? 'SUPER_ADMIN' : 'EMPLOYEE';
      const newProfile: UserProfile = {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Internal User',
        photoURL: user.photoURL || undefined,
        role: initialRole,
        companyId: null,
        locationId: null,
        departmentId: null,
        itTeamId: null,
        jobTitle: isSuperAdminEmail ? 'Chief Information Officer' : 'Staff Member',
        designation: isSuperAdminEmail ? 'Chief Information Officer' : 'Staff Member',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        mustChangePassword: false,
        mfaEnabled: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(userDocRef, removeUndefinedFields(newProfile));

      if (initialRole === 'SUPER_ADMIN') {
        await ensureAdminRecord(user.uid, user.email || '', initialRole);
      }

      await logAuditEvent({
        action: 'USER_REGISTERED',
        entityType: 'USER',
        entityId: user.uid,
        actorRole: initialRole,
        details: { email: user.email, initialRole },
      });

      return newProfile;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    throw error;
  }
}

async function ensureAdminRecord(uid: string, email: string, role: 'SUPER_ADMIN' | 'IT_ADMIN'): Promise<void> {
  try {
    const adminDocRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminDocRef);
    if (!snap.exists() || snap.data().role !== role) {
      await setDoc(adminDocRef, {
        id: uid,
        email,
        role,
        grantedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.warn('Error setting admin record doc', err);
  }
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  actorRole: UserRole
): Promise<void> {
  const path = `users/${userId}`;
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      role: newRole,
      updatedAt: now,
    });

    if (newRole === 'SUPER_ADMIN' || newRole === 'IT_ADMIN') {
      const userSnap = await getDoc(doc(db, 'users', userId));
      const email = userSnap.data()?.email || '';
      await ensureAdminRecord(userId, email, newRole);
    }

    await logAuditEvent({
      action: 'USER_ROLE_CHANGED',
      entityType: 'USER',
      entityId: userId,
      actorRole,
      details: { newRole },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
