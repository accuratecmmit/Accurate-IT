import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Custom database ID from firebase-applet-config.json must be passed
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Recursively removes any undefined keys from an object to satisfy Firestore's requirement
 * that document payloads cannot contain undefined values.
 */
export function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedFields(item)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] =
        value !== null && typeof value === 'object' && !(value instanceof Date)
          ? removeUndefinedFields(value)
          : value;
    }
  }
  return result as T;
}

/**
 * Validates connection to the provisioned Firestore database on startup.
 */
export async function testFirestoreConnection(): Promise<{ connected: boolean; message?: string }> {
  try {
    await getDocFromServer(doc(db, 'system_config', 'init'));
    return { connected: true, message: 'Connected to Firestore' };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('the client is offline')) {
      console.error('Firestore client is offline. Please check your network and Firebase configuration.');
      return { connected: false, message: 'Firestore is offline' };
    }
    // Permission-denied or not-found still proves connectivity to server!
    return { connected: true, message: 'Server reached' };
  }
}

export default app;
