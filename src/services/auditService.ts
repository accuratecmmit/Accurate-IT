import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth, removeUndefinedFields } from '../lib/firebase';
import { AuditLog, OperationType, UserRole } from '../types';
import { handleFirestoreError } from '../lib/errors';
import { logger } from '../lib/logger';

export interface CreateAuditLogParams {
  action: string;
  entityType:
    | 'COMPANY'
    | 'LOCATION'
    | 'DEPARTMENT'
    | 'IT_TEAM'
    | 'USER'
    | 'TICKET'
    | 'ASSET'
    | 'INVENTORY'
    | 'SLA'
    | 'AUTH'
    | 'CONFIG';
  entityId: string;
  details?: string | Record<string, unknown>;
  companyId?: string;
  locationId?: string;
  actorRole?: UserRole | string;
}

/**
 * Service to record and query immutable security & operational audit logs.
 */
export async function logAuditEvent(params: CreateAuditLogParams): Promise<string> {
  const currentUser = auth.currentUser;
  const path = 'audit_logs';

  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const detailsString = typeof params.details === 'object'
    ? JSON.stringify(params.details)
    : params.details || '';

  const logEntry: Record<string, any> = {
    id: logId,
    timestamp: new Date().toISOString(),
    actorId: currentUser?.uid || 'system_bootstrap',
    actorEmail: currentUser?.email || 'system@internal',
    actorRole: params.actorRole || 'SYSTEM',
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: detailsString,
  };

  if (params.companyId !== undefined && params.companyId !== null) {
    logEntry.companyId = params.companyId;
  }
  if (params.locationId !== undefined && params.locationId !== null) {
    logEntry.locationId = params.locationId;
  }

  const sanitizedEntry = removeUndefinedFields(logEntry);

  try {
    await setDoc(doc(db, path, logId), sanitizedEntry);
    logger.info(`[Audit] ${params.action} on ${params.entityType}:${params.entityId}`, { logId });
    return logId;
  } catch (error) {
    logger.warn('Failed to write audit log to database', { error });
    // In production audit trail systems, fallback logging is critical
    handleFirestoreError(error, OperationType.CREATE, `${path}/${logId}`);
  }
}

/**
 * Subscribes to recent audit logs in real-time.
 */
export function subscribeToAuditLogs(
  maxEntries = 50,
  onUpdate: (logs: AuditLog[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'audit_logs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(maxEntries));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLog[] = snapshot.docs.map((docSnap) => docSnap.data() as AuditLog);
      onUpdate(logs);
    },
    (error) => {
      logger.error('Error fetching audit logs snapshot', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * One-time fetch of recent audit logs.
 */
export async function fetchAuditLogs(maxEntries = 50): Promise<AuditLog[]> {
  const path = 'audit_logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(maxEntries));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as AuditLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
