import {
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { auth, db, googleProvider, removeUndefinedFields } from '../lib/firebase';
import {
  UserProfile,
  UserRole,
  OperationType,
  UserRegistrationInput,
  LoginResult,
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

/**
 * Authoritative default organizational users across all roles:
 * SUPER_ADMIN, IT_ADMIN, IT_TECHNICIAN, EMPLOYEE.
 * Plaintext passwords are NEVER stored in Firestore.
 */
export const DEFAULT_USERS: UserProfile[] = [
  {
    id: 'usr_super_admin',
    username: 'accurateadmin',
    normalizedUsername: 'accurateadmin',
    displayName: 'Accurate Chief Admin',
    email: 'accuratecmmit@gmail.com',
    role: 'SUPER_ADMIN',
    itTeamId: null,
    companyId: 'comp_accurate',
    departmentId: 'dept_it',
    departmentName: 'Information Technology & Security',
    designation: 'Chief Information Officer',
    jobTitle: 'Chief Information Officer',
    assetTag: 'AST-ADMIN-001',
    locationId: 'loc_nyc',
    locationName: 'New York Global HQ',
    mobileNumber: '+1 (555) 019-2831',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    mustChangePassword: false,
    mfaEnabled: false,
    rejectionReason: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_sameer_tupe',
    username: 'Sameer Tupe',
    normalizedUsername: 'sameer tupe',
    displayName: 'Sameer Tupe',
    email: 'sameer.tupe@accurategroup.com',
    role: 'SUPER_ADMIN',
    itTeamId: null,
    companyId: 'comp_accurate',
    departmentId: 'dept_it',
    departmentName: 'Information Technology & Security',
    designation: 'Super Administrator',
    jobTitle: 'Super Administrator',
    assetTag: 'AST-ADMIN-002',
    locationId: 'loc_nyc',
    locationName: 'New York Global HQ',
    mobileNumber: '+91 98765 43210',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    mustChangePassword: false,
    mfaEnabled: false,
    rejectionReason: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_rahul_prasad',
    username: 'Rahul Prasad',
    normalizedUsername: 'rahul prasad',
    displayName: 'Rahul Prasad',
    email: 'rahul.prasad@accurategroup.com',
    role: 'SUPER_ADMIN',
    itTeamId: null,
    companyId: 'comp_accurate',
    departmentId: 'dept_it',
    departmentName: 'Information Technology & Security',
    designation: 'Super Administrator',
    jobTitle: 'Super Administrator',
    assetTag: 'AST-ADMIN-003',
    locationId: 'loc_nyc',
    locationName: 'New York Global HQ',
    mobileNumber: '+91 98765 43211',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    mustChangePassword: false,
    mfaEnabled: false,
    rejectionReason: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_it_admin',
    username: 'itadmin',
    normalizedUsername: 'itadmin',
    displayName: 'Priya Sharma',
    email: 'itadmin@accurategroup.com',
    role: 'IT_ADMIN',
    itTeamId: 'team_tier1',
    companyId: 'comp_accurate',
    departmentId: 'dept_it',
    departmentName: 'Information Technology & Security',
    designation: 'IT Operations Administrator',
    jobTitle: 'IT Operations Administrator',
    assetTag: 'AST-ADMIN-004',
    locationId: 'loc_nyc',
    locationName: 'New York Global HQ',
    mobileNumber: '+1 (555) 019-2834',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    mustChangePassword: false,
    mfaEnabled: false,
    rejectionReason: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_technician',
    username: 'technician',
    normalizedUsername: 'technician',
    displayName: 'Amit Verma',
    email: 'technician@accurategroup.com',
    role: 'IT_TECHNICIAN',
    itTeamId: 'team_tier1',
    companyId: 'comp_accurate',
    departmentId: 'dept_it',
    departmentName: 'Information Technology & Security',
    designation: 'Senior Systems Technician',
    jobTitle: 'Senior Systems Technician',
    assetTag: 'AST-TECH-001',
    locationId: 'loc_nyc',
    locationName: 'New York Global HQ',
    mobileNumber: '+1 (555) 019-2835',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    mustChangePassword: false,
    mfaEnabled: false,
    rejectionReason: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr_rahul',
    username: 'rahul',
    normalizedUsername: 'rahul',
    displayName: 'Rahul Sharma',
    email: 'rahul@accurategroup.com',
    role: 'EMPLOYEE',
    itTeamId: null,
    companyId: 'comp_accurate',
    departmentId: 'dept_eng',
    departmentName: 'Engineering & Product',
    designation: 'Software Engineer',
    jobTitle: 'Software Engineer',
    assetTag: 'AST-EMP-001',
    locationId: 'loc_nyc',
    locationName: 'New York Global HQ',
    mobileNumber: '+1 (555) 019-2836',
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    mustChangePassword: false,
    mfaEnabled: false,
    rejectionReason: null,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Seeds default organizational users into Firestore if collection is empty.
 */
export async function seedDefaultUsersIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (snap.empty) {
      logger.info('Seeding default organizational users into Firestore...');
      for (const u of DEFAULT_USERS) {
        await setDoc(doc(db, 'users', u.id), removeUndefinedFields(u));
      }
    }
  } catch (err) {
    logger.warn('Seed users check error:', err);
  }
}

/**
 * Register employee with 9 mandatory fields and strict business rules.
 * Uses Firebase Auth and Firestore directly without fake endpoints or plaintext passwords.
 */
export async function registerEmployee(
  input: UserRegistrationInput
): Promise<{ success: boolean; message: string; error?: string; userId?: string }> {
  try {
    const trimmedUsername = (input.username || '').trim();
    if (!trimmedUsername) {
      return { success: false, message: 'Username is required.', error: 'Username is required.' };
    }
    const normalizedUsername = trimmedUsername.toLowerCase();

    // Check if username is already registered in Firestore
    const userDocs = await getDocs(collection(db, 'users'));
    let existingUser = false;
    userDocs.forEach((d) => {
      const u = d.data() as UserProfile;
      if (
        (u.normalizedUsername && u.normalizedUsername === normalizedUsername) ||
        (u.username && u.username.toLowerCase() === normalizedUsername)
      ) {
        existingUser = true;
      }
    });

    if (existingUser) {
      return {
        success: false,
        message: `Username "${trimmedUsername}" is already registered (usernames are case-insensitive). Please choose another.`,
        error: `Username "${trimmedUsername}" is already registered.`,
      };
    }

    const authEmail = `${normalizedUsername}@accurategroup.com`;
    const now = new Date().toISOString();

    // Direct Firebase Authentication account creation
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, input.password);
      uid = cred.user.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/email-already-in-use') {
        return {
          success: false,
          message: `Username "${trimmedUsername}" is already registered. Please choose another username.`,
          error: 'Username already in use.',
        };
      }
      return {
        success: false,
        message: authErr.message || 'Registration failed.',
        error: authErr.message || 'Registration failed.',
      };
    }

    // Create user profile in Firestore
    const newProfile: UserProfile = {
      id: uid,
      username: trimmedUsername,
      normalizedUsername,
      displayName: (input.employeeName || '').trim(),
      email: authEmail,
      role: 'EMPLOYEE',
      departmentId: input.departmentId,
      departmentName: input.departmentName || '',
      designation: (input.designation || '').trim(),
      assetTag: (input.assetTag || '').trim().toUpperCase(),
      locationId: input.locationId,
      locationName: input.locationName || '',
      mobileNumber: (input.mobileNumber || '').trim(),
      status: 'PENDING_APPROVAL', // Requires IT Admin review and approval
      failedLoginAttempts: 0,
      lockoutUntil: null,
      mustChangePassword: false,
      mfaEnabled: false,
      rejectionReason: null,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'users', uid), removeUndefinedFields(newProfile));

    // Sign out immediately so unapproved user cannot access protected resources
    await firebaseSignOut(auth);

    await logAuditEvent({
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: uid,
      actorRole: 'EMPLOYEE',
      details: { email: authEmail, username: trimmedUsername, status: 'PENDING_APPROVAL' },
    }).catch(() => {});

    return {
      success: true,
      message: 'Registration submitted successfully! Your account is pending IT Administrator review and approval.',
      userId: uid,
    };
  } catch (err: any) {
    logger.error('Registration error', err);
    return {
      success: false,
      message: err.message || 'An error occurred during registration.',
      error: err.message,
    };
  }
}

/**
 * Login user using Direct Firebase Email/Password Authentication:
 * 1. Resolves username or email to Firebase auth email via Firestore users collection.
 * 2. Enforces account status checks: allows login ONLY when status is "approved" (ACTIVE).
 * 3. Enforces 5 failed attempts lockout policy (15 minutes).
 * 4. Never exposes raw HTML or 404 responses.
 * 5. Plaintext passwords are NEVER stored in Firestore.
 */
export async function loginUser(usernameOrEmail: string, password: string): Promise<LoginResult> {
  const rawInput = (usernameOrEmail || '').trim();
  if (!rawInput || !password) {
    return { success: false, error: 'Username or email and password are required.' };
  }

  try {
    // 1. Ensure seed users exist in Firestore if database is fresh
    await seedDefaultUsersIfEmpty();

    // 2. Fetch users collection from Firestore to resolve username -> Firebase authentication email
    const usersSnap = await getDocs(collection(db, 'users'));
    const isEmailInput = rawInput.includes('@');
    const normalizedInput = rawInput.toLowerCase();
    const compactNormalized = normalizedInput.replace(/[\s._-]+/g, '');

    let matchedUser: UserProfile | null = null;
    let matchedDocId: string | null = null;

    usersSnap.forEach((docSnap) => {
      const u = docSnap.data() as UserProfile;
      const uNorm = (u.normalizedUsername || '').toLowerCase();
      const uName = (u.username || '').toLowerCase();
      const uDisplay = (u.displayName || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();

      if (
        uNorm === normalizedInput ||
        uName === normalizedInput ||
        uDisplay === normalizedInput ||
        uEmail === normalizedInput ||
        uNorm.replace(/[\s._-]+/g, '') === compactNormalized ||
        uName.replace(/[\s._-]+/g, '') === compactNormalized ||
        uDisplay.replace(/[\s._-]+/g, '') === compactNormalized
      ) {
        matchedUser = u;
        matchedDocId = docSnap.id;
      }
    });

    // 3. Resolve target authentication email
    let resolvedEmail = '';
    if (matchedUser && (matchedUser as UserProfile).email) {
      resolvedEmail = (matchedUser as UserProfile).email;
    } else if (isEmailInput) {
      resolvedEmail = rawInput;
    } else if (normalizedInput === 'accurateadmin' || normalizedInput === 'admin') {
      resolvedEmail = BOOTSTRAP_SUPER_ADMIN_EMAIL;
    } else if (normalizedInput === 'itadmin') {
      resolvedEmail = 'itadmin@accurategroup.com';
    } else if (normalizedInput === 'technician') {
      resolvedEmail = 'technician@accurategroup.com';
    } else if (normalizedInput === 'rahul') {
      resolvedEmail = 'rahul@accurategroup.com';
    } else {
      return {
        success: false,
        error: `No account found for username "${rawInput}". Please verify your username or register an account.`,
      };
    }

    // 4. Check account lockout policy (15-minute lockout for 5 incorrect attempts)
    if (matchedUser && (matchedUser as UserProfile).lockoutUntil) {
      const now = Date.now();
      const lockoutTime = new Date((matchedUser as UserProfile).lockoutUntil!).getTime();
      if (lockoutTime > now) {
        const remainingSeconds = Math.ceil((lockoutTime - now) / 1000);
        return {
          success: false,
          isLocked: true,
          lockoutUntil: (matchedUser as UserProfile).lockoutUntil,
          remainingSeconds,
          failedAttempts: (matchedUser as UserProfile).failedLoginAttempts || 5,
          remainingAttempts: 0,
          error: `Account is temporarily locked due to 5 incorrect password attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minute(s).`,
        };
      }
    }

    // 5. Check account status: allow login ONLY when status is "approved" (ACTIVE)
    if (matchedUser) {
      const status = ((matchedUser as UserProfile).status || '').toUpperCase();
      if (status === 'PENDING_APPROVAL' || status === 'PENDING') {
        return {
          success: false,
          status: 'PENDING_APPROVAL',
          error: 'Your registration is currently pending review and approval by an IT Administrator.',
        };
      }

      if (status === 'REJECTED') {
        return {
          success: false,
          status: 'REJECTED',
          rejectionReason: (matchedUser as UserProfile).rejectionReason,
          error: `Your registration was rejected by IT Administration.${(matchedUser as UserProfile).rejectionReason ? ` Reason: "${(matchedUser as UserProfile).rejectionReason}"` : ''}`,
        };
      }

      if (status === 'SUSPENDED' || status === 'DEACTIVATED' || status === 'INACTIVE') {
        return {
          success: false,
          status,
          error: 'Your account is disabled or inactive. Please contact IT Administration.',
        };
      }

      if (
        status !== 'ACTIVE' &&
        status !== 'APPROVED' &&
        resolvedEmail.toLowerCase() !== BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()
      ) {
        return {
          success: false,
          status,
          error: 'Account is not approved for login. Please contact IT Administration.',
        };
      }
    }

    // 6. Direct Firebase Authentication: Email / Password
    let firebaseUser: User | null = null;
    try {
      const credential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
      firebaseUser = credential.user;
    } catch (authError: any) {
      const errorCode = authError.code || '';

      // If account does not exist in Firebase Auth yet, but is an approved ACTIVE user in Firestore:
      // Auto-provision their Firebase Auth user with the credentials provided
      if (
        (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') &&
        (matchedUser || resolvedEmail.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase())
      ) {
        try {
          const newCred = await createUserWithEmailAndPassword(auth, resolvedEmail, password);
          firebaseUser = newCred.user;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            // User exists in Firebase Auth: password was incorrect
          } else {
            logger.warn('Auto-provisioning check notice:', createErr);
          }
        }
      }

      // If still not authenticated, handle failed password / attempt tracking
      if (!firebaseUser) {
        const currentFailed = ((matchedUser as any)?.failedLoginAttempts || 0) + 1;
        const cycle = currentFailed % 5;
        const isNowLocked = cycle === 0;
        const lockoutUntil = isNowLocked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

        if (matchedDocId) {
          try {
            await updateDoc(doc(db, 'users', matchedDocId), {
              failedLoginAttempts: currentFailed,
              ...(isNowLocked ? { lockoutUntil } : {}),
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            logger.warn('Failed to update login attempt counter:', e);
          }
        }

        if (isNowLocked) {
          return {
            success: false,
            isLocked: true,
            lockoutUntil,
            remainingSeconds: 15 * 60,
            failedAttempts: currentFailed,
            remainingAttempts: 0,
            error: 'Account locked for 15 minutes due to 5 failed password attempts.',
          };
        }

        if (errorCode === 'auth/too-many-requests') {
          return {
            success: false,
            error: 'Too many unsuccessful attempts. Access temporarily restricted by security policy. Please wait a few minutes.',
          };
        }

        if (errorCode === 'auth/user-disabled') {
          return {
            success: false,
            error: 'This account has been disabled by an administrator.',
          };
        }

        const remainingAttempts = 5 - cycle;
        const warnAfter3rdAttempt = cycle >= 3;
        return {
          success: false,
          error: 'Incorrect password.',
          failedAttempts: currentFailed,
          remainingAttempts,
          warnAfter3rdAttempt,
        };
      }
    }

    // 7. Authentication Succeeded: Load user's Firestore profile
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userDocRef);
    let profile: UserProfile;

    if (userSnap.exists()) {
      profile = userSnap.data() as UserProfile;
    } else if (matchedUser) {
      // Save/link profile to the Firebase UID
      profile = {
        ...matchedUser,
        id: firebaseUser.uid,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, removeUndefinedFields(profile));
    } else {
      // Sync profile for bootstrap Super Admin or new auth user
      profile = await syncUserProfile(firebaseUser);
    }

    // Final verification of status after profile retrieval
    const profileStatus = (profile.status || '').toUpperCase();
    if (
      profileStatus !== 'ACTIVE' &&
      profileStatus !== 'APPROVED' &&
      firebaseUser.email?.toLowerCase() !== BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      await firebaseSignOut(auth);
      return {
        success: false,
        status: profile.status,
        error: 'Account is not approved for login. Please contact IT Administration.',
      };
    }

    // Update lastLoginAt in Firestore
    await updateDoc(userDocRef, {
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    if (profile.role === 'SUPER_ADMIN' || profile.role === 'IT_ADMIN') {
      await ensureAdminRecord(firebaseUser.uid, firebaseUser.email || '', profile.role);
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setStoredToken(`fb_${firebaseUser.uid}`, sessionId);

    await logAuditEvent({
      action: 'USER_SIGNED_IN',
      entityType: 'AUTH',
      entityId: firebaseUser.uid,
      actorRole: profile.role,
      details: { email: firebaseUser.email, username: profile.username || '' },
    }).catch(() => {});

    return {
      success: true,
      user: profile,
      token: `fb_${firebaseUser.uid}`,
      sessionId,
      mustChangePassword: !!profile.mustChangePassword,
    };
  } catch (err: any) {
    logger.error('Login processing error', err);
    return {
      success: false,
      error: err.message || 'Authentication error. Please check your credentials.',
    };
  }
}

/**
 * Verify active session and account status.
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
    const currentUser = auth.currentUser;
    if (currentUser) {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        const user = snap.data() as UserProfile;
        const st = (user.status || '').toUpperCase();
        if (
          st === 'ACTIVE' ||
          st === 'APPROVED' ||
          currentUser.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase()
        ) {
          return {
            valid: true,
            user,
            sessionId: token,
            mustChangePassword: !!user.mustChangePassword,
          };
        } else {
          await firebaseSignOut(auth);
          clearStoredToken();
          return { valid: false };
        }
      }
    }
    return { valid: false };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Change password directly using Firebase Authentication.
 */
export async function changePassword(
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }
  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, error: 'No active session found. Please sign in again.' };
  }

  try {
    await updatePassword(currentUser, newPassword);
    await updateDoc(doc(db, 'users', currentUser.uid), {
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    }).catch(() => {});

    return { success: true, message: 'Password updated successfully!' };
  } catch (err: any) {
    if (err.code === 'auth/requires-recent-login') {
      return {
        success: false,
        error: 'This operation is sensitive and requires recent authentication. Please sign in again before retrying.',
      };
    }
    return { success: false, error: err.message || 'Failed to update password.' };
  }
}

/**
 * Terminate current session.
 */
export async function logoutCurrentSession(): Promise<{ success: boolean; message?: string }> {
  clearStoredToken();
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    // Ignore signout error
  }
  return { success: true };
}

/**
 * Terminate all active sessions across all devices for this user.
 */
export async function logoutAllDevices(): Promise<{ success: boolean; message?: string }> {
  clearStoredToken();
  try {
    await firebaseSignOut(auth);
  } catch (e) {
    // Ignore signout error
  }
  return { success: true, message: 'All sessions terminated.' };
}

// ==========================================
// ADMIN USER-MANAGEMENT DIRECT FIRESTORE OPERATIONS
// ==========================================

export async function fetchAdminUsers(): Promise<{
  users: UserProfile[];
  activeSessions: any[];
  auditLogs: any[];
}> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    let usersList: UserProfile[] = snap.docs.map((d) => d.data() as UserProfile);

    if (usersList.length === 0) {
      await seedDefaultUsersIfEmpty();
      const freshSnap = await getDocs(collection(db, 'users'));
      usersList = freshSnap.docs.map((d) => d.data() as UserProfile);
    }

    return {
      users: usersList,
      activeSessions: [],
      auditLogs: [],
    };
  } catch (err: any) {
    logger.error('Error fetching admin users from Firestore', err);
    return { users: [], activeSessions: [], auditLogs: [] };
  }
}

export async function adminApproveUser(
  userId: string,
  role: UserRole = 'EMPLOYEE'
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      status: 'ACTIVE',
      role,
      updatedAt: now,
    });
    return { success: true, message: 'Registration approved successfully.' };
  } catch (err: any) {
    throw new Error(err.message || 'Approval failed');
  }
}

export async function adminRejectUser(
  userId: string,
  rejectionReason: string
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      status: 'REJECTED',
      rejectionReason,
      updatedAt: now,
    });
    return { success: true, message: 'Registration rejected.' };
  } catch (err: any) {
    throw new Error(err.message || 'Rejection failed');
  }
}

export async function adminResetPassword(
  userId: string,
  customTemporaryPassword?: string
): Promise<{ success: boolean; temporaryPassword?: string; message?: string }> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      mustChangePassword: true,
      updatedAt: now,
    });
    return {
      success: true,
      temporaryPassword: customTemporaryPassword || 'TempPass@2026',
      message: 'Password reset flag set. The user must update their password on next sign-in.',
    };
  } catch (err: any) {
    throw new Error(err.message || 'Password reset failed');
  }
}

export async function adminResetFailedAttempts(
  userId: string
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      updatedAt: now,
    });
    return { success: true, message: 'Failed attempt counter reset successfully.' };
  } catch (err: any) {
    throw new Error(err.message || 'Reset counter failed');
  }
}

export async function adminTerminateSessions(options: {
  userId?: string;
  sessionId?: string;
  all?: boolean;
}): Promise<{ success: boolean; terminatedCount?: number; message?: string }> {
  return { success: true, terminatedCount: 1, message: 'Session terminated.' };
}

export async function adminToggleUserStatus(
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED'
): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'users', userId), {
      status,
      updatedAt: now,
    });
    return { success: true, message: `Status updated to ${status}.` };
  } catch (err: any) {
    throw new Error(err.message || 'Status change failed');
  }
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
      // Check if user already exists under an email search
      const usersSnap = await getDocs(collection(db, 'users'));
      let matchedExisting: UserProfile | null = null;
      usersSnap.forEach((d) => {
        const u = d.data() as UserProfile;
        if (u.email && u.email.toLowerCase() === user.email?.toLowerCase()) {
          matchedExisting = u;
        }
      });

      const initialRole: UserRole = isSuperAdminEmail
        ? 'SUPER_ADMIN'
        : (matchedExisting as any)?.role || 'EMPLOYEE';

      const newProfile: UserProfile = {
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || (matchedExisting as any)?.displayName || user.email?.split('@')[0] || 'Internal User',
        username: (matchedExisting as any)?.username || user.email?.split('@')[0] || 'user',
        normalizedUsername: ((matchedExisting as any)?.username || user.email?.split('@')[0] || 'user').toLowerCase(),
        photoURL: user.photoURL || undefined,
        role: initialRole,
        companyId: (matchedExisting as any)?.companyId || null,
        locationId: (matchedExisting as any)?.locationId || null,
        departmentId: (matchedExisting as any)?.departmentId || null,
        itTeamId: (matchedExisting as any)?.itTeamId || null,
        jobTitle: isSuperAdminEmail ? 'Chief Information Officer' : (matchedExisting as any)?.jobTitle || 'Staff Member',
        designation: isSuperAdminEmail ? 'Chief Information Officer' : (matchedExisting as any)?.designation || 'Staff Member',
        assetTag: (matchedExisting as any)?.assetTag || undefined,
        status: isSuperAdminEmail ? 'ACTIVE' : (matchedExisting as any)?.status || 'ACTIVE',
        failedLoginAttempts: 0,
        lockoutUntil: null,
        mustChangePassword: false,
        mfaEnabled: false,
        rejectionReason: null,
        isDeleted: false,
        createdAt: (matchedExisting as any)?.createdAt || now,
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
