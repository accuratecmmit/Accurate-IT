import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, auth, removeUndefinedFields } from '../lib/firebase';
import { parseResponseJson } from '../lib/apiClient';
import {
  Company,
  Location,
  Department,
  ITTeam,
  SLAConfig,
  SequenceCounter,
  SystemConfig,
  OperationType,
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_LOCATIONS,
  INITIAL_DEPARTMENTS,
  INITIAL_IT_TEAMS,
  INITIAL_SLA_CONFIGS,
  INITIAL_SEQUENCES,
  INITIAL_ROLES,
} from './seedData';
import { handleFirestoreError } from '../lib/errors';
import { logAuditEvent } from './auditService';
import { logger } from '../lib/logger';

import { getStoredToken } from './authService';

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  let userEmail = auth.currentUser?.email || '';
  if (!userEmail) {
    try {
      const stored = localStorage.getItem('accurate_auth_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        userEmail = parsed?.user?.email || '';
      }
    } catch {}
  }
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userEmail ? { 'x-user-email': userEmail, 'x-actor-email': userEmail } : {}),
  };
}

/**
 * REST API Client for Server Master Data API
 */
export async function fetchMasterCompanies(includeArchived = false): Promise<{ companies: Company[]; error?: string }> {
  try {
    const res = await fetch(`/api/master/companies?includeArchived=${includeArchived}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { companies: [], error: data.error || 'Failed to fetch companies' };
    }
    return { companies: data.companies || [] };
  } catch (err: any) {
    return { companies: [], error: err.message || 'Network error fetching companies' };
  }
}

export async function fetchMasterLocations(includeArchived = false): Promise<{ locations: Location[]; error?: string }> {
  try {
    const res = await fetch(`/api/master/locations?includeArchived=${includeArchived}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { locations: [], error: data.error || 'Failed to fetch locations' };
    }
    return { locations: data.locations || [] };
  } catch (err: any) {
    return { locations: [], error: err.message || 'Network error fetching locations' };
  }
}

export async function fetchMasterDepartments(includeArchived = false): Promise<{ departments: Department[]; error?: string }> {
  try {
    const res = await fetch(`/api/master/departments?includeArchived=${includeArchived}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { departments: [], error: data.error || 'Failed to fetch departments' };
    }
    return { departments: data.departments || [] };
  } catch (err: any) {
    return { departments: [], error: err.message || 'Network error fetching departments' };
  }
}

/**
 * Initializes the database configuration if not yet initialized.
 * Seeds initial 3 companies, 6 locations, departments, IT teams, SLAs, roles,
 * and sequence counters into Firestore.
 */
export async function initializeMasterDataIfEmpty(): Promise<{
  seeded: boolean;
  companiesCount: number;
  locationsCount: number;
  departmentsCount: number;
  itTeamsCount: number;
}> {
  const configPath = 'system_config';
  const configDocRef = doc(db, configPath, 'init');

  try {
    const configSnap = await getDoc(configDocRef);
    if (configSnap.exists() && configSnap.data().initialSeedCompleted) {
      return {
        seeded: false,
        companiesCount: INITIAL_COMPANIES.length,
        locationsCount: INITIAL_LOCATIONS.length,
        departmentsCount: INITIAL_DEPARTMENTS.length,
        itTeamsCount: INITIAL_IT_TEAMS.length,
      };
    }

    // Verify if current session has Firebase Super Admin authorization before executing write operations
    const currentUser = auth.currentUser;
    const isAuthorizedAdmin = Boolean(
      currentUser &&
      currentUser.email &&
      (currentUser.email.toLowerCase() === 'accuratecmmit@gmail.com')
    );

    if (!isAuthorizedAdmin) {
      // Unauthenticated or non-admin sessions utilize authoritative local seeds; cloud seeding requires Super Admin
      return {
        seeded: false,
        companiesCount: INITIAL_COMPANIES.length,
        locationsCount: INITIAL_LOCATIONS.length,
        departmentsCount: INITIAL_DEPARTMENTS.length,
        itTeamsCount: INITIAL_IT_TEAMS.length,
      };
    }

    logger.info('Initializing full database-driven master data in Firestore as authorized Super Admin...');
    const now = new Date().toISOString();

    // 1. Seed Roles
    for (const role of INITIAL_ROLES) {
      const roleRef = doc(db, 'roles', role.id);
      const snap = await getDoc(roleRef);
      if (!snap.exists()) {
        await setDoc(roleRef, role);
      }
    }

    // 2. Seed initial 3 companies
    for (const company of INITIAL_COMPANIES) {
      const compDocRef = doc(db, 'companies', company.id);
      const existingSnap = await getDoc(compDocRef);
      if (!existingSnap.exists()) {
        await setDoc(compDocRef, {
          ...company,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Seed initial 6 locations
    for (const location of INITIAL_LOCATIONS) {
      const locDocRef = doc(db, 'locations', location.id);
      const existingSnap = await getDoc(locDocRef);
      if (!existingSnap.exists()) {
        await setDoc(locDocRef, {
          ...location,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 4. Seed Departments
    for (const dept of INITIAL_DEPARTMENTS) {
      const deptRef = doc(db, 'departments', dept.id);
      const existingSnap = await getDoc(deptRef);
      if (!existingSnap.exists()) {
        await setDoc(deptRef, {
          ...dept,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 5. Seed IT Teams
    for (const team of INITIAL_IT_TEAMS) {
      const teamRef = doc(db, 'it_teams', team.id);
      const existingSnap = await getDoc(teamRef);
      if (!existingSnap.exists()) {
        await setDoc(teamRef, {
          ...team,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 6. Seed SLA Configs
    for (const sla of INITIAL_SLA_CONFIGS) {
      const slaRef = doc(db, 'sla_configs', sla.id);
      const existingSnap = await getDoc(slaRef);
      if (!existingSnap.exists()) {
        await setDoc(slaRef, {
          ...sla,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 7. Seed Atomic Sequence Counters (Non-reusable tickets & assets)
    for (const seq of INITIAL_SEQUENCES) {
      const seqRef = doc(db, 'sequences', seq.id);
      const existingSnap = await getDoc(seqRef);
      if (!existingSnap.exists()) {
        await setDoc(seqRef, {
          ...seq,
          updatedAt: now,
        });
      }
    }

    // 8. Mark config as completed
    const systemConfig: SystemConfig = {
      id: 'init',
      initialSeedCompleted: true,
      seededAt: now,
      systemVersion: '1.0.0',
      updatedAt: now,
    };
    await setDoc(configDocRef, systemConfig);

    logger.info('Database master data initialization completed successfully.');
    return {
      seeded: true,
      companiesCount: INITIAL_COMPANIES.length,
      locationsCount: INITIAL_LOCATIONS.length,
      departmentsCount: INITIAL_DEPARTMENTS.length,
      itTeamsCount: INITIAL_IT_TEAMS.length,
    };
  } catch (error) {
    logger.error('Master data database seed error', error);
    return {
      seeded: false,
      companiesCount: 0,
      locationsCount: 0,
      departmentsCount: 0,
      itTeamsCount: 0,
    };
  }
}

// ========================
// COMPANIES CRUD & LIFECYCLE
// ========================

export function subscribeToCompanies(
  onUpdate: (companies: Company[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'companies';
  const q = query(collection(db, path), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const companies: Company[] = snapshot.docs
        .map((d) => d.data() as Company)
        .filter((c) => !c.isDeleted);
      onUpdate(companies);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCompany(
  companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
  actorRole: string
): Promise<Company> {
  // Call server API for centralized state, uniqueness validation, and server audit logging
  const res = await fetch('/api/master/companies', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(companyData),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create company');
  }

  const created: Company = data.company;

  // Sync to Firestore for real-time subscribers if connected
  try {
    await setDoc(doc(db, 'companies', created.id), removeUndefinedFields(created));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for createCompany:', err);
  }

  return created;
}

export async function updateCompany(
  id: string,
  updates: Partial<Omit<Company, 'id' | 'createdAt'>>,
  actorRole: string
): Promise<Company> {
  const res = await fetch(`/api/master/companies/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update company');
  }

  const updated: Company = data.company;

  try {
    await updateDoc(doc(db, 'companies', id), removeUndefinedFields({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for updateCompany:', err);
  }

  return updated;
}

/**
 * Disable/Archive: never physically deletes records to preserve historical integrity.
 */
export async function archiveCompany(id: string, code: string, actorRole: string): Promise<Company> {
  const res = await fetch(`/api/master/companies/${id}/archive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to archive company');
  }

  try {
    await updateDoc(doc(db, 'companies', id), {
      isArchived: true,
      status: 'ARCHIVED',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for archiveCompany:', err);
  }

  return data.company;
}

/**
 * Re-create / Restore archived company.
 */
export async function restoreCompany(id: string, actorRole: string): Promise<Company> {
  const res = await fetch(`/api/master/companies/${id}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore company');
  }

  try {
    await updateDoc(doc(db, 'companies', id), {
      isArchived: false,
      status: 'ACTIVE',
      archivedAt: null,
      archivedBy: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for restoreCompany:', err);
  }

  return data.company;
}

export async function deleteCompany(id: string, code: string, actorRole: string): Promise<void> {
  const res = await fetch(`/api/master/companies/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete company');
  }

  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'companies', id));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for deleteCompany:', err);
  }

  await logAuditEvent({
    action: 'COMPANY_DELETED',
    entityType: 'COMPANY',
    entityId: id,
    details: `Super Admin permanently deleted company ${code}.`,
  });
}

export async function deleteAllCompanies(actorRole: string): Promise<void> {
  const res = await fetch('/api/master/companies/all', {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete all companies');
  }

  try {
    const { getDocs, deleteDoc } = await import('firebase/firestore');
    const snaps = await getDocs(collection(db, 'companies'));
    for (const d of snaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for deleteAllCompanies:', err);
  }

  await logAuditEvent({
    action: 'ALL_COMPANIES_DELETED',
    entityType: 'COMPANY',
    entityId: 'ALL',
    details: 'Super Admin permanently deleted all companies.',
  });
}

// ========================
// LOCATIONS CRUD & LIFECYCLE (INDEPENDENT DATA ARCHITECTURE)
// ========================

export function subscribeToLocations(
  onUpdate: (locations: Location[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'locations';
  const q = query(collection(db, path), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const locations: Location[] = snapshot.docs
        .map((d) => d.data() as Location)
        .filter((l) => !l.isDeleted);
      onUpdate(locations);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createLocation(
  locationData: Omit<Location, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
  actorRole: string
): Promise<Location> {
  const res = await fetch('/api/master/locations', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(locationData),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create location');
  }

  const created: Location = data.location;

  try {
    await setDoc(doc(db, 'locations', created.id), removeUndefinedFields(created));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for createLocation:', err);
  }

  return created;
}

export async function updateLocation(
  id: string,
  updates: Partial<Omit<Location, 'id' | 'createdAt'>>,
  actorRole: string
): Promise<Location> {
  const res = await fetch(`/api/master/locations/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update location');
  }

  const updated: Location = data.location;

  try {
    await updateDoc(doc(db, 'locations', id), removeUndefinedFields({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for updateLocation:', err);
  }

  return updated;
}

/**
 * Disable/Archive: never physically deletes records to preserve historical integrity.
 */
export async function archiveLocation(id: string, code: string, actorRole: string): Promise<Location> {
  const res = await fetch(`/api/master/locations/${id}/archive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to archive location');
  }

  try {
    await updateDoc(doc(db, 'locations', id), {
      isArchived: true,
      status: 'ARCHIVED',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for archiveLocation:', err);
  }

  return data.location;
}

/**
 * Re-create / Restore archived location.
 */
export async function restoreLocation(id: string, actorRole: string): Promise<Location> {
  const res = await fetch(`/api/master/locations/${id}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore location');
  }

  try {
    await updateDoc(doc(db, 'locations', id), {
      isArchived: false,
      status: 'ACTIVE',
      archivedAt: null,
      archivedBy: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for restoreLocation:', err);
  }

  return data.location;
}

export async function deleteLocation(id: string, code: string, actorRole: string): Promise<void> {
  const res = await fetch(`/api/master/locations/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete location');
  }

  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'locations', id));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for deleteLocation:', err);
  }

  await logAuditEvent({
    action: 'LOCATION_DELETED',
    entityType: 'LOCATION',
    entityId: id,
    details: `Super Admin permanently deleted location ${code}.`,
  });
}

export async function deleteAllLocations(actorRole: string): Promise<void> {
  const res = await fetch('/api/master/locations/all', {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete all locations');
  }

  try {
    const { getDocs, deleteDoc } = await import('firebase/firestore');
    const snaps = await getDocs(collection(db, 'locations'));
    for (const d of snaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for deleteAllLocations:', err);
  }

  await logAuditEvent({
    action: 'ALL_LOCATIONS_DELETED',
    entityType: 'LOCATION',
    entityId: 'ALL',
    details: 'Super Admin permanently deleted all locations.',
  });
}

// ========================
// DEPARTMENTS CRUD & LIFECYCLE (SUPER ADMIN ALONE)
// ========================

export function subscribeToDepartments(
  onUpdate: (departments: Department[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'departments';
  const q = query(collection(db, path), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const departments: Department[] = snapshot.docs
        .map((d) => d.data() as Department)
        .filter((dept) => !dept.isDeleted);
      onUpdate(departments);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createDepartment(
  departmentData: Omit<Department, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>,
  actorRole: string
): Promise<Department> {
  const res = await fetch('/api/master/departments', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(departmentData),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create department');
  }

  const created: Department = data.department;

  try {
    await setDoc(doc(db, 'departments', created.id), removeUndefinedFields(created));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for createDepartment:', err);
  }

  return created;
}

export async function updateDepartment(
  id: string,
  updates: Partial<Omit<Department, 'id' | 'createdAt'>>,
  actorRole: string
): Promise<Department> {
  const res = await fetch(`/api/master/departments/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update department');
  }

  const updated: Department = data.department;

  try {
    await updateDoc(doc(db, 'departments', id), removeUndefinedFields({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for updateDepartment:', err);
  }

  return updated;
}

/**
 * Super Admin alone can disable/archive department.
 * Preserves historical references.
 */
export async function archiveDepartment(id: string, code: string, actorRole: string): Promise<Department> {
  const res = await fetch(`/api/master/departments/${id}/archive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to archive department');
  }

  try {
    await updateDoc(doc(db, 'departments', id), {
      isArchived: true,
      status: 'ARCHIVED',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for archiveDepartment:', err);
  }

  return data.department;
}

/**
 * Super Admin alone can restore/re-create department.
 */
export async function restoreDepartment(id: string, actorRole: string): Promise<Department> {
  const res = await fetch(`/api/master/departments/${id}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to restore department');
  }

  try {
    await updateDoc(doc(db, 'departments', id), {
      isArchived: false,
      status: 'ACTIVE',
      archivedAt: null,
      archivedBy: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for restoreDepartment:', err);
  }

  return data.department;
}

export async function deleteDepartment(id: string, code: string, actorRole: string): Promise<void> {
  const res = await fetch(`/api/master/departments/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete department');
  }

  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'departments', id));
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for deleteDepartment:', err);
  }

  await logAuditEvent({
    action: 'DEPARTMENT_DELETED',
    entityType: 'DEPARTMENT',
    entityId: id,
    details: `Super Admin permanently deleted department ${code}.`,
  });
}

export async function deleteAllDepartments(actorRole: string): Promise<void> {
  const res = await fetch('/api/master/departments/all', {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to delete all departments');
  }

  try {
    const { getDocs, deleteDoc } = await import('firebase/firestore');
    const snaps = await getDocs(collection(db, 'departments'));
    for (const d of snaps.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    logger.warn('Non-blocking firestore sync notice for deleteAllDepartments:', err);
  }

  await logAuditEvent({
    action: 'ALL_DEPARTMENTS_DELETED',
    entityType: 'DEPARTMENT',
    entityId: 'ALL',
    details: 'Super Admin permanently deleted all departments.',
  });
}

export async function clearAllDemoData(): Promise<void> {
  const res = await fetch('/api/admin/clear-demo-data', {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
  if (!res.ok) {
    throw new Error(data.error || 'Failed to clear demo data');
  }
}

// ========================
// IT TEAMS CRUD
// ========================

export function subscribeToITTeams(
  onUpdate: (teams: ITTeam[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'it_teams';
  const q = query(collection(db, path), orderBy('name', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const teams: ITTeam[] = snapshot.docs
        .map((d) => d.data() as ITTeam)
        .filter((t) => !t.isDeleted);
      onUpdate(teams);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ========================
// SLA CONFIGS CRUD
// ========================

export function subscribeToSLAConfigs(
  onUpdate: (slas: SLAConfig[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const path = 'sla_configs';
  const q = query(collection(db, path), orderBy('responseTimeMinutes', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const slas: SLAConfig[] = snapshot.docs
        .map((d) => d.data() as SLAConfig)
        .filter((s) => !s.isDeleted);
      onUpdate(slas);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ========================
// AUDIT LOGS QUERY API
// ========================

export async function fetchServerAuditLogs(params?: {
  entityType?: string;
  search?: string;
  limit?: number;
}): Promise<{ auditLogs: any[]; error?: string }> {
  try {
    const qs = new URLSearchParams();
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.search) qs.set('search', params.search);
    if (params?.limit) qs.set('limit', String(params.limit));

    const res = await fetch(`/api/audit-logs?${qs.toString()}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { auditLogs: [], error: data.error || 'Failed to fetch audit logs' };
    }
    return { auditLogs: data.auditLogs || [] };
  } catch (err: any) {
    return { auditLogs: [], error: err.message || 'Network error fetching audit logs' };
  }
}
