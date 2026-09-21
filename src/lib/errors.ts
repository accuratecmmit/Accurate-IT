import { auth } from './firebase';
import { FirestoreErrorInfo, OperationType } from '../types';

/**
 * Standardized Firestore error handler mandated by Firebase security guidelines.
 * Throws a formatted JSON string containing full diagnostic context.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo: currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) ?? [],
    },
  };

  console.error('[Firestore Error Context]', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Parses a serialized FirestoreErrorInfo if present, or returns friendly string.
 */
export function parseFirestoreError(error: unknown): { message: string; details?: FirestoreErrorInfo } {
  if (error instanceof Error) {
    try {
      const parsed: FirestoreErrorInfo = JSON.parse(error.message);
      if (parsed && parsed.error && parsed.operationType) {
        return {
          message: parsed.error.includes('insufficient permissions')
            ? `Permission Denied: You do not have authorization to perform ${parsed.operationType.toUpperCase()} on ${parsed.path || 'resource'}.`
            : parsed.error,
          details: parsed,
        };
      }
    } catch {
      // Not a JSON string error, return raw message
      return { message: error.message };
    }
    return { message: error.message };
  }
  return { message: String(error) };
}
