import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { Company, Location, Department, ITTeam } from '../types';
import {
  subscribeToCompanies,
  subscribeToLocations,
  subscribeToDepartments,
  subscribeToITTeams,
  createCompany as serviceCreateCompany,
  updateCompany as serviceUpdateCompany,
  archiveCompany as serviceArchiveCompany,
  restoreCompany as serviceRestoreCompany,
  deleteCompany as serviceDeleteCompany,
  deleteAllCompanies as serviceDeleteAllCompanies,
  createLocation as serviceCreateLocation,
  updateLocation as serviceUpdateLocation,
  archiveLocation as serviceArchiveLocation,
  restoreLocation as serviceRestoreLocation,
  deleteLocation as serviceDeleteLocation,
  deleteAllLocations as serviceDeleteAllLocations,
  createDepartment as serviceCreateDepartment,
  updateDepartment as serviceUpdateDepartment,
  archiveDepartment as serviceArchiveDepartment,
  restoreDepartment as serviceRestoreDepartment,
  deleteDepartment as serviceDeleteDepartment,
  deleteAllDepartments as serviceDeleteAllDepartments,
  clearAllDemoData as serviceClearAllDemoData,
  fetchMasterCompanies,
  fetchMasterLocations,
  fetchMasterDepartments,
  initializeMasterDataIfEmpty,
} from '../services/masterDataService';
import { fetchITTeams } from '../services/itTeamService';
import {
  INITIAL_COMPANIES,
  INITIAL_LOCATIONS,
  INITIAL_DEPARTMENTS,
  INITIAL_IT_TEAMS,
} from '../services/seedData';
import { useAuth } from './AuthContext';
import { logger } from '../lib/logger';

interface MasterDataContextType {
  companies: Company[];
  locations: Location[];
  departments: Department[];
  itTeams: ITTeam[];
  categories: string[];
  activeCompanies: Company[];
  activeLocations: Location[];
  activeDepartments: Department[];
  activeITTeams: ITTeam[];
  selectedCompanyId: string;
  selectedLocationId: string;
  setSelectedCompanyId: (id: string) => void;
  setSelectedLocationId: (id: string) => void;
  activeCompany: Company | null;
  activeLocation: Location | null;
  isLoading: boolean;
  isSeeding: boolean;
  refreshMasterData: () => Promise<void>;
  seedInitialData: () => Promise<void>;
  addCompany: (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Company>;
  editCompany: (id: string, updates: Partial<Omit<Company, 'id' | 'createdAt'>>) => Promise<Company | void>;
  archiveCompany: (id: string, code: string) => Promise<Company | void>;
  restoreCompany: (id: string) => Promise<Company | void>;
  removeCompany: (id: string, code: string) => Promise<void>;
  removeAllCompanies: () => Promise<void>;
  addLocation: (data: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Location>;
  editLocation: (id: string, updates: Partial<Omit<Location, 'id' | 'createdAt'>>) => Promise<Location | void>;
  archiveLocation: (id: string, code: string) => Promise<Location | void>;
  restoreLocation: (id: string) => Promise<Location | void>;
  removeLocation: (id: string, code: string) => Promise<void>;
  removeAllLocations: () => Promise<void>;
  addDepartment: (data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Department>;
  editDepartment: (id: string, updates: Partial<Omit<Department, 'id' | 'createdAt'>>) => Promise<Department | void>;
  archiveDepartment: (id: string, code: string) => Promise<Department | void>;
  restoreDepartment: (id: string) => Promise<Department | void>;
  removeDepartment: (id: string, code: string) => Promise<void>;
  removeAllDepartments: () => Promise<void>;
  purgeDemoData: () => Promise<void>;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export const MasterDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { effectiveRole } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [locations, setLocations] = useState<Location[]>(INITIAL_LOCATIONS);
  const [departments, setDepartments] = useState<Department[]>(INITIAL_DEPARTMENTS);
  const [itTeams, setItTeams] = useState<ITTeam[]>(INITIAL_IT_TEAMS);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('ALL');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  const categories = useMemo(() => [
    'HARDWARE',
    'SOFTWARE',
    'NETWORK',
    'ACCESS',
    'EMAIL',
    'TELEPHONY',
    'OTHER',
  ], []);

  const isAdmin = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'IT_ADMIN';

  const refreshMasterData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [compRes, locRes, deptRes, teamRes] = await Promise.all([
        fetchMasterCompanies(isAdmin),
        fetchMasterLocations(isAdmin),
        fetchMasterDepartments(isAdmin),
        fetchITTeams(),
      ]);

      if (compRes.companies && compRes.companies.length > 0) {
        setCompanies(compRes.companies);
      }
      if (locRes.locations && locRes.locations.length > 0) {
        setLocations(locRes.locations);
      }
      if (deptRes.departments && deptRes.departments.length > 0) {
        setDepartments(deptRes.departments);
      }
      if (teamRes.teams && teamRes.teams.length > 0) {
        setItTeams(teamRes.teams);
      }
    } catch (err) {
      logger.warn('Failed to refresh master data via REST API:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  // Initial load and role change
  useEffect(() => {
    refreshMasterData();
  }, [refreshMasterData]);

  // Firestore real-time subscriptions as secondary sync
  useEffect(() => {
    let unsubCompanies: (() => void) | null = null;
    let unsubLocations: (() => void) | null = null;
    let unsubDepartments: (() => void) | null = null;
    let unsubITTeams: (() => void) | null = null;

    try {
      unsubCompanies = subscribeToCompanies(
        (data) => {
          if (Array.isArray(data)) {
            setCompanies((prev) => {
              // Merge preserving usage counts from server
              const countMap = new Map((prev || []).map((p) => [p.id, p.usageCount]));
              return data.map((item) => ({
                ...item,
                usageCount: countMap.get(item.id) || item.usageCount,
              }));
            });
          }
        },
        (err) => logger.warn('Companies subscription fallback to seed', { error: String(err) })
      );

      unsubLocations = subscribeToLocations(
        (data) => {
          if (Array.isArray(data)) {
            setLocations((prev) => {
              const countMap = new Map((prev || []).map((p) => [p.id, p.usageCount]));
              return data.map((item) => ({
                ...item,
                usageCount: countMap.get(item.id) || item.usageCount,
              }));
            });
          }
        },
        (err) => logger.warn('Locations subscription fallback to seed', { error: String(err) })
      );

      unsubDepartments = subscribeToDepartments(
        (data) => {
          if (Array.isArray(data)) {
            setDepartments((prev) => {
              const countMap = new Map((prev || []).map((p) => [p.id, p.usageCount]));
              return data.map((item) => ({
                ...item,
                usageCount: countMap.get(item.id) || item.usageCount,
              }));
            });
          }
        },
        (err) => logger.warn('Departments subscription fallback to seed', { error: String(err) })
      );

      unsubITTeams = subscribeToITTeams(
        (data) => {
          if (Array.isArray(data)) {
            setItTeams(data);
          }
        },
        (err) => logger.warn('IT Teams subscription fallback', { error: String(err) })
      );
    } catch (e) {
      logger.warn('Non-blocking master data subscription notice:', e);
    }

    return () => {
      if (unsubCompanies) unsubCompanies();
      if (unsubLocations) unsubLocations();
      if (unsubDepartments) unsubDepartments();
      if (unsubITTeams) unsubITTeams();
    };
  }, []);

  // Filtered active lists for form dropdowns (tickets, assets, registration)
  // Ensures archived master records CANNOT be selected for new records!
  const activeCompanies = useMemo(() => {
    return (companies || []).filter((c) => !c.isDeleted && !c.isArchived && c.status === 'ACTIVE');
  }, [companies]);

  const activeLocations = useMemo(() => {
    return (locations || []).filter((l) => !l.isDeleted && !l.isArchived && l.status === 'ACTIVE');
  }, [locations]);

  const activeDepartments = useMemo(() => {
    return (departments || []).filter((d) => !d.isDeleted && !d.isArchived && d.status === 'ACTIVE');
  }, [departments]);

  const activeITTeams = useMemo(() => {
    return (itTeams || []).filter((t) => !t.isDeleted && t.status === 'ACTIVE');
  }, [itTeams]);

  const activeCompany = useMemo(() => {
    if (selectedCompanyId === 'ALL') return null;
    return (companies || []).find((c) => c.id === selectedCompanyId) || null;
  }, [companies, selectedCompanyId]);

  const activeLocation = useMemo(() => {
    if (selectedLocationId === 'ALL') return null;
    return (locations || []).find((l) => l.id === selectedLocationId) || null;
  }, [locations, selectedLocationId]);

  const seedInitialData = async () => {
    setIsSeeding(true);
    try {
      await initializeMasterDataIfEmpty();
      await refreshMasterData();
    } finally {
      setIsSeeding(false);
    }
  };

  // Company operations
  const addCompany = async (data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await serviceCreateCompany(data, effectiveRole);
    await refreshMasterData();
    return created;
  };

  const editCompany = async (id: string, updates: Partial<Omit<Company, 'id' | 'createdAt'>>) => {
    const updated = await serviceUpdateCompany(id, updates, effectiveRole);
    await refreshMasterData();
    return updated;
  };

  const archiveCompany = async (id: string, code: string) => {
    const archived = await serviceArchiveCompany(id, code, effectiveRole);
    await refreshMasterData();
    return archived;
  };

  const restoreCompany = async (id: string) => {
    const restored = await serviceRestoreCompany(id, effectiveRole);
    await refreshMasterData();
    return restored;
  };

  const removeCompany = async (id: string, code: string) => {
    await serviceDeleteCompany(id, code, effectiveRole);
    await refreshMasterData();
  };

  const removeAllCompanies = async () => {
    await serviceDeleteAllCompanies(effectiveRole);
    setCompanies([]);
    await refreshMasterData();
  };

  // Location operations
  const addLocation = async (data: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await serviceCreateLocation(data, effectiveRole);
    await refreshMasterData();
    return created;
  };

  const editLocation = async (id: string, updates: Partial<Omit<Location, 'id' | 'createdAt'>>) => {
    const updated = await serviceUpdateLocation(id, updates, effectiveRole);
    await refreshMasterData();
    return updated;
  };

  const archiveLocation = async (id: string, code: string) => {
    const archived = await serviceArchiveLocation(id, code, effectiveRole);
    await refreshMasterData();
    return archived;
  };

  const restoreLocation = async (id: string) => {
    const restored = await serviceRestoreLocation(id, effectiveRole);
    await refreshMasterData();
    return restored;
  };

  const removeLocation = async (id: string, code: string) => {
    await serviceDeleteLocation(id, code, effectiveRole);
    await refreshMasterData();
  };

  const removeAllLocations = async () => {
    await serviceDeleteAllLocations(effectiveRole);
    setLocations([]);
    await refreshMasterData();
  };

  // Department operations (Super Admin alone)
  const addDepartment = async (data: Omit<Department, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await serviceCreateDepartment(data, effectiveRole);
    await refreshMasterData();
    return created;
  };

  const editDepartment = async (id: string, updates: Partial<Omit<Department, 'id' | 'createdAt'>>) => {
    const updated = await serviceUpdateDepartment(id, updates, effectiveRole);
    await refreshMasterData();
    return updated;
  };

  const archiveDepartment = async (id: string, code: string) => {
    const archived = await serviceArchiveDepartment(id, code, effectiveRole);
    await refreshMasterData();
    return archived;
  };

  const restoreDepartment = async (id: string) => {
    const restored = await serviceRestoreDepartment(id, effectiveRole);
    await refreshMasterData();
    return restored;
  };

  const removeDepartment = async (id: string, code: string) => {
    await serviceDeleteDepartment(id, code, effectiveRole);
    await refreshMasterData();
  };

  const removeAllDepartments = async () => {
    await serviceDeleteAllDepartments(effectiveRole);
    setDepartments([]);
    await refreshMasterData();
  };

  const purgeDemoData = async () => {
    await serviceClearAllDemoData();
    await refreshMasterData();
  };

  return (
    <MasterDataContext.Provider
      value={{
        companies,
        locations,
        departments,
        itTeams,
        categories,
        activeCompanies,
        activeLocations,
        activeDepartments,
        activeITTeams,
        selectedCompanyId,
        selectedLocationId,
        setSelectedCompanyId,
        setSelectedLocationId,
        activeCompany,
        activeLocation,
        isLoading,
        isSeeding,
        refreshMasterData,
        seedInitialData,
        addCompany,
        editCompany,
        archiveCompany,
        restoreCompany,
        removeCompany,
        removeAllCompanies,
        addLocation,
        editLocation,
        archiveLocation,
        restoreLocation,
        removeLocation,
        removeAllLocations,
        addDepartment,
        editDepartment,
        archiveDepartment,
        restoreDepartment,
        removeDepartment,
        removeAllDepartments,
        purgeDemoData,
      }}
    >
      {children}
    </MasterDataContext.Provider>
  );
};

export function useMasterData() {
  const context = useContext(MasterDataContext);
  if (!context) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}
