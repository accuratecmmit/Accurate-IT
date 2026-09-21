import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Briefcase,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  Globe,
  Mail,
  Clock,
  ShieldCheck,
  Filter,
  History,
  Ticket,
  Laptop,
  Users,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { useMasterData } from '../../context/MasterDataContext';
import { useAuth } from '../../context/AuthContext';
import { Company, Location, Department } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const MasterDataManager: React.FC = () => {
  const {
    companies,
    locations,
    departments,
    isLoading,
    refreshMasterData,
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
  } = useMasterData();

  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'companies' | 'locations' | 'departments'>('companies');
  const [showArchived, setShowArchived] = useState<boolean>(true);

  // Company modal state
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState({
    code: '',
    name: '',
    domain: '',
    contactEmail: '',
    status: 'ACTIVE' as Company['status'],
  });

  // Location modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    address: '',
    city: '',
    country: '',
    timezone: 'UTC',
    status: 'ACTIVE' as Location['status'],
  });

  // Department modal state
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState({
    code: '',
    name: '',
    description: '',
    status: 'ACTIVE' as Department['status'],
  });

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Destructive Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const displayMessage = (msg: string, isError = false) => {
    if (isError) {
      setActionError(msg);
      setActionSuccess(null);
    } else {
      setActionSuccess(msg);
      setActionError(null);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // ---------------------------------------------
  // Filtered lists (Archived toggle)
  // ---------------------------------------------
  const filteredCompanies = (companies || []).filter((c) => (showArchived ? true : !c.isArchived && c.status === 'ACTIVE'));
  const filteredLocations = (locations || []).filter((l) => (showArchived ? true : !l.isArchived && l.status === 'ACTIVE'));
  const filteredDepartments = (departments || []).filter((d) => (showArchived ? true : !d.isArchived && d.status === 'ACTIVE'));

  // ---------------------------------------------
  // Company Handlers
  // ---------------------------------------------
  const handleOpenCreateCompany = () => {
    setEditingCompany(null);
    setCompanyForm({
      code: '',
      name: '',
      domain: '',
      contactEmail: '',
      status: 'ACTIVE',
    });
    setActionError(null);
    setIsCompanyModalOpen(true);
  };

  const handleOpenEditCompany = (company: Company) => {
    setEditingCompany(company);
    setCompanyForm({
      code: company.code,
      name: company.name,
      domain: company.domain || '',
      contactEmail: company.contactEmail || '',
      status: company.status,
    });
    setActionError(null);
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.code || !companyForm.name) {
      setActionError('Company code and name are required.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      if (editingCompany) {
        await editCompany(editingCompany.id, companyForm);
        displayMessage(`Company "${companyForm.name}" updated successfully.`);
      } else {
        await addCompany(companyForm);
        displayMessage(`Company "${companyForm.name}" created successfully.`);
      }
      setIsCompanyModalOpen(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveCompany = (company: Company) => {
    const usage = company.usageCount || { tickets: 0, assets: 0, users: 0 };
    setConfirmModal({
      isOpen: true,
      title: `Archive Company: ${company.name} (${company.code})`,
      message: `Historical integrity is strictly guaranteed: ${usage.tickets} tickets, ${usage.assets} assets, and ${usage.users} users will retain their original company reference.\n\nThis company will be deactivated from future ticket and inventory forms, but remains visible to Super Admins.`,
      confirmText: 'Archive Company',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await archiveCompany(company.id, company.code);
          displayMessage(`Company "${company.name}" archived successfully. Historical references preserved.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleRestoreCompany = (company: Company) => {
    setConfirmModal({
      isOpen: true,
      title: `Restore Company: ${company.name}`,
      message: `Restore company "${company.name}" (${company.code}) to ACTIVE status? It will become selectable again across new tickets and inventory items.`,
      confirmText: 'Restore Company',
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await restoreCompany(company.id);
          displayMessage(`Company "${company.name}" restored to ACTIVE status.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleDeleteCompany = (company: Company) => {
    setConfirmModal({
      isOpen: true,
      title: `Permanently Delete Company: ${company.name}?`,
      message: `Warning: This will permanently delete ${company.name} (${company.code}) from the database. Any users or assets assigned to this company will have their company reference removed.\n\nThis action cannot be undone.`,
      confirmText: 'Delete Company',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await removeCompany(company.id, company.code);
          displayMessage(`Company "${company.name}" has been permanently deleted.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleDeleteAllCompanies = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete ALL Companies?',
      message: 'Critical warning: You are about to permanently delete all companies in the organization database. This action cannot be undone.',
      confirmText: 'Delete All Companies',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await removeAllCompanies();
          displayMessage('All companies have been permanently deleted.');
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  // ---------------------------------------------
  // Location Handlers (Independent from Company)
  // ---------------------------------------------
  const handleOpenCreateLocation = () => {
    setEditingLocation(null);
    setLocationForm({
      code: '',
      name: '',
      address: '',
      city: '',
      country: '',
      timezone: 'UTC',
      status: 'ACTIVE',
    });
    setActionError(null);
    setIsLocationModalOpen(true);
  };

  const handleOpenEditLocation = (location: Location) => {
    setEditingLocation(location);
    setLocationForm({
      code: location.code,
      name: location.name,
      address: location.address || '',
      city: location.city,
      country: location.country,
      timezone: location.timezone || 'UTC',
      status: location.status,
    });
    setActionError(null);
    setIsLocationModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationForm.code || !locationForm.name || !locationForm.city || !locationForm.country) {
      setActionError('Location code, name, city, and country are required.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      if (editingLocation) {
        await editLocation(editingLocation.id, locationForm);
        displayMessage(`Location "${locationForm.name}" updated successfully.`);
      } else {
        await addLocation(locationForm);
        displayMessage(`Location "${locationForm.name}" created successfully.`);
      }
      setIsLocationModalOpen(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveLocation = (location: Location) => {
    const usage = location.usageCount || { tickets: 0, assets: 0, users: 0 };
    setConfirmModal({
      isOpen: true,
      title: `Archive Location: ${location.name} (${location.code})`,
      message: `Historical integrity is strictly guaranteed: ${usage.tickets} tickets, ${usage.assets} assets, and ${usage.users} users will retain their original location reference.\n\nThis location will be disabled from new selections, but remains accessible to Super Admin.`,
      confirmText: 'Archive Location',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await archiveLocation(location.id, location.code);
          displayMessage(`Location "${location.name}" archived successfully. Historical references preserved.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleRestoreLocation = (location: Location) => {
    setConfirmModal({
      isOpen: true,
      title: `Restore Location: ${location.name}`,
      message: `Restore location "${location.name}" (${location.code}) to ACTIVE status?`,
      confirmText: 'Restore Location',
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await restoreLocation(location.id);
          displayMessage(`Location "${location.name}" restored to ACTIVE status.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleDeleteLocation = (location: Location) => {
    setConfirmModal({
      isOpen: true,
      title: `Permanently Delete Location: ${location.name}?`,
      message: `Warning: This will permanently delete ${location.name} (${location.code}) from the database. Any users or assets assigned to this location will have their location reference removed.\n\nThis action cannot be undone.`,
      confirmText: 'Delete Location',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await removeLocation(location.id, location.code);
          displayMessage(`Location "${location.name}" has been permanently deleted.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleDeleteAllLocations = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete ALL Locations?',
      message: 'Critical warning: You are about to permanently delete all locations in the organization database. This action cannot be undone.',
      confirmText: 'Delete All Locations',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await removeAllLocations();
          displayMessage('All locations have been permanently deleted.');
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  // ---------------------------------------------
  // Department Handlers (Super Admin Alone)
  // ---------------------------------------------
  const handleOpenCreateDepartment = () => {
    setEditingDepartment(null);
    setDepartmentForm({
      code: '',
      name: '',
      description: '',
      status: 'ACTIVE',
    });
    setActionError(null);
    setIsDepartmentModalOpen(true);
  };

  const handleOpenEditDepartment = (dept: Department) => {
    setEditingDepartment(dept);
    setDepartmentForm({
      code: dept.code,
      name: dept.name,
      description: dept.description || '',
      status: dept.status,
    });
    setActionError(null);
    setIsDepartmentModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departmentForm.code || !departmentForm.name) {
      setActionError('Department code and name are required.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      if (editingDepartment) {
        await editDepartment(editingDepartment.id, departmentForm);
        displayMessage(`Department "${departmentForm.name}" updated successfully.`);
      } else {
        await addDepartment(departmentForm);
        displayMessage(`Department "${departmentForm.name}" created successfully.`);
      }
      setIsDepartmentModalOpen(false);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveDepartment = (dept: Department) => {
    const usage = dept.usageCount || { tickets: 0, assets: 0, users: 0 };
    setConfirmModal({
      isOpen: true,
      title: `Archive Department: ${dept.name} (${dept.code})`,
      message: `Historical integrity is strictly guaranteed: ${usage.tickets} tickets, ${usage.assets} assets, and ${usage.users} users will retain their original department reference.\n\nThis department will be disabled from employee dropdowns for new tickets, but remains accessible to Super Admin.`,
      confirmText: 'Archive Department',
      variant: 'warning',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await archiveDepartment(dept.id, dept.code);
          displayMessage(`Department "${dept.name}" archived successfully. Historical references preserved.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleRestoreDepartment = (dept: Department) => {
    setConfirmModal({
      isOpen: true,
      title: `Restore Department: ${dept.name}`,
      message: `Restore department "${dept.name}" (${dept.code}) to ACTIVE status?`,
      confirmText: 'Restore Department',
      variant: 'info',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await restoreDepartment(dept.id);
          displayMessage(`Department "${dept.name}" restored to ACTIVE status.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleDeleteDepartment = (dept: Department) => {
    setConfirmModal({
      isOpen: true,
      title: `Permanently Delete Department: ${dept.name}?`,
      message: `Warning: This will permanently delete ${dept.name} (${dept.code}) from the database. Any users or assets assigned to this department will have their department reference removed.\n\nThis action cannot be undone.`,
      confirmText: 'Delete Department',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await removeDepartment(dept.id, dept.code);
          displayMessage(`Department "${dept.name}" has been permanently deleted.`);
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handleDeleteAllDepartments = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Permanently Delete ALL Departments?',
      message: 'Critical warning: You are about to permanently delete all departments in the organization database. This action cannot be undone.',
      confirmText: 'Delete All Departments',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await removeAllDepartments();
          displayMessage('All departments have been permanently deleted.');
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  const handlePurgeDemoData = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Purge All Demo Data?',
      message: 'This will purge all demo tickets, assets, notifications, comments, and demo accounts. Your Super Admin account and current master-data will remain intact.\n\nProceed with purge?',
      confirmText: 'Purge Demo Data',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await purgeDemoData();
          displayMessage('All demo tickets, assets, and demo users have been purged successfully.');
        } catch (err: unknown) {
          displayMessage(err instanceof Error ? err.message : String(err), true);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Organization Master-Data Management
            </h2>
            <Badge variant="purple">Database Driven</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Manage decoupled Companies, independent Locations, and predefined Departments.
            Super Admin alone manages departments and master data lifecycle with soft-delete historical preservation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Show / Hide Archived Toggle */}
          {isSuperAdmin && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                showArchived
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700'
              }`}
              title="Toggle display of archived master records"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{showArchived ? 'Archived Visible' : 'Archived Hidden'}</span>
            </button>
          )}

          {isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={Trash2}
                onClick={handlePurgeDemoData}
                className="text-amber-700 dark:text-amber-400 hover:text-amber-800 hover:bg-amber-100/60 dark:hover:bg-amber-950/60 text-xs border border-amber-300 dark:border-amber-800 font-semibold"
                title="Purge all demo tickets, assets, comments, and demo accounts"
              >
                Clear Demo Data
              </Button>

              {activeTab === 'companies' && (companies || []).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={handleDeleteAllCompanies}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-xs border border-rose-200 dark:border-rose-900"
                  title="Permanently delete all companies from the database"
                >
                  Delete All
                </Button>
              )}

              {activeTab === 'locations' && (locations || []).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={handleDeleteAllLocations}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-xs border border-rose-200 dark:border-rose-900"
                  title="Permanently delete all locations from the database"
                >
                  Delete All
                </Button>
              )}

              {activeTab === 'departments' && (departments || []).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={handleDeleteAllDepartments}
                  className="text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-xs border border-rose-200 dark:border-rose-900"
                  title="Permanently delete all departments from the database"
                >
                  Delete All
                </Button>
              )}

              {activeTab === 'companies' ? (
                <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreateCompany}>
                  Add Company
                </Button>
              ) : activeTab === 'locations' ? (
                <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreateLocation}>
                  Add Location
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon={Plus} onClick={handleOpenCreateDepartment}>
                  Add Department
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Architectural Independence & Historical Integrity Notice */}
      <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-start gap-3 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-950 dark:text-indigo-200 space-y-1">
          <p className="font-bold">
            Independent Data Architecture &amp; Historical Preservation Rule
          </p>
          <p className="text-indigo-800 dark:text-indigo-300/90 font-medium">
            • <strong>Independent Master Data:</strong> Company and Location are independent entities with no mandatory hierarchy.
            <br />
            • <strong>Department Governance:</strong> Predefined dropdown selections; Super Admin alone adds, edits, or archives departments.
            <br />
            • <strong>Historical Integrity:</strong> Archived records are never physically removed; existing tickets, assets, and users preserve original historical references.
          </p>
        </div>
      </div>

      {/* Bento Segmented Tabs */}
      <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
        <button
          onClick={() => setActiveTab('companies')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'companies'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Companies ({(companies || []).length})</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200/60 dark:border-indigo-800">
            {(companies || []).filter((c) => !c.isArchived).length} Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'locations'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Locations ({(locations || []).length})</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800">
            {(locations || []).filter((l) => !l.isArchived).length} Active
          </span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'departments'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Departments ({(departments || []).length})</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800">
            {(departments || []).filter((d) => !d.isArchived).length} Active
          </span>
        </button>
      </div>

      {/* Tab 1: Companies Grid */}
      {activeTab === 'companies' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredCompanies.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No companies found</p>
              <p className="text-xs text-slate-500 mt-1">
                {(companies || []).length === 0
                  ? "You have deleted or cleared all companies. Use 'Add Company' to create one."
                  : "No companies match the current filter."}
              </p>
            </div>
          ) : (
            filteredCompanies.map((company) => {
            const usage = company.usageCount || { tickets: 0, assets: 0, users: 0 };
            return (
              <Card
                key={company.id}
                title={company.name}
                subtitle={`Code: ${company.code}`}
                action={
                  <div className="flex items-center gap-1.5">
                    {company.isArchived ? (
                      <Badge variant="default" size="sm">ARCHIVED</Badge>
                    ) : (
                      <Badge
                        variant={company.status === 'ACTIVE' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {company.status}
                      </Badge>
                    )}
                  </div>
                }
                footer={
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {company.id}
                    </span>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => handleOpenEditCompany(company)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                          title="Edit Company"
                        >
                          <span className="sr-only">Edit</span>
                        </Button>

                        {company.isArchived ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => handleRestoreCompany(company)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Restore Company to Active Status"
                          >
                            <span className="sr-only">Restore</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Archive}
                            onClick={() => handleArchiveCompany(company)}
                            className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Archive Company (Preserves Historical Integrity)"
                          >
                            <span className="sr-only">Archive</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteCompany(company)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                          title="Permanently Delete Company"
                        >
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                }
              >
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Globe className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="font-mono text-[11px] truncate">{company.domain || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{company.contactEmail || 'N/A'}</span>
                  </div>

                  {/* Historical Usage Indicators */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Ticket className="w-3 h-3 text-indigo-500" />
                        {usage.tickets} tickets
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Laptop className="w-3 h-3 text-blue-500" />
                        {usage.assets} assets
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Users className="w-3 h-3 text-emerald-500" />
                        {usage.users} users
                      </span>
                    </div>
                  </div>

                  {company.isArchived && company.archivedAt && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <History className="w-3 h-3 shrink-0" />
                      <span>Archived on {new Date(company.archivedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          }))}
        </div>
      )}

      {/* Tab 2: Locations Grid */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLocations.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <MapPin className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No locations found</p>
              <p className="text-xs text-slate-500 mt-1">
                {(locations || []).length === 0
                  ? "You have deleted or cleared all locations. Use 'Add Location' to create one."
                  : "No locations match the current filter."}
              </p>
            </div>
          ) : (
            filteredLocations.map((location) => {
            const usage = location.usageCount || { tickets: 0, assets: 0, users: 0 };
            return (
              <Card
                key={location.id}
                title={location.name}
                subtitle={`Code: ${location.code}`}
                action={
                  <div className="flex items-center gap-1.5">
                    {location.isArchived ? (
                      <Badge variant="default" size="sm">ARCHIVED</Badge>
                    ) : (
                      <Badge
                        variant={location.status === 'ACTIVE' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {location.status}
                      </Badge>
                    )}
                  </div>
                }
                footer={
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {location.id}
                    </span>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => handleOpenEditLocation(location)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                          title="Edit Location"
                        >
                          <span className="sr-only">Edit</span>
                        </Button>

                        {location.isArchived ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => handleRestoreLocation(location)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Restore Location to Active Status"
                          >
                            <span className="sr-only">Restore</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Archive}
                            onClick={() => handleArchiveLocation(location)}
                            className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Archive Location (Preserves Historical Integrity)"
                          >
                            <span className="sr-only">Archive</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteLocation(location)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                          title="Permanently Delete Location"
                        >
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                }
              >
                <div className="space-y-2 text-xs">
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {location.address || 'Address on file'}
                  </p>
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span>{location.city}</span>
                    <span>, {location.country}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>Timezone: {location.timezone || 'UTC'}</span>
                  </div>

                  {/* Historical Usage Indicators */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Ticket className="w-3 h-3 text-indigo-500" />
                        {usage.tickets} tickets
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Laptop className="w-3 h-3 text-blue-500" />
                        {usage.assets} assets
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Users className="w-3 h-3 text-emerald-500" />
                        {usage.users} users
                      </span>
                    </div>
                  </div>

                  {location.isArchived && location.archivedAt && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <History className="w-3 h-3 shrink-0" />
                      <span>Archived on {new Date(location.archivedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          }))}
        </div>
      )}

      {/* Tab 3: Departments Grid (Super Admin Alone) */}
      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepartments.length === 0 ? (
            <div className="col-span-full p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No departments found</p>
              <p className="text-xs text-slate-500 mt-1">
                {(departments || []).length === 0
                  ? "You have deleted or cleared all departments. Use 'Add Department' to create one."
                  : "No departments match the current filter."}
              </p>
            </div>
          ) : (
            filteredDepartments.map((dept) => {
            const usage = dept.usageCount || { tickets: 0, assets: 0, users: 0 };
            return (
              <Card
                key={dept.id}
                title={dept.name}
                subtitle={`Code: ${dept.code}`}
                action={
                  <div className="flex items-center gap-1.5">
                    {dept.isArchived ? (
                      <Badge variant="default" size="sm">ARCHIVED</Badge>
                    ) : (
                      <Badge
                        variant={dept.status === 'ACTIVE' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {dept.status}
                      </Badge>
                    )}
                  </div>
                }
                footer={
                  <div className="w-full flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">
                      ID: {dept.id}
                    </span>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => handleOpenEditDepartment(dept)}
                          className="p-1 text-slate-600 hover:text-slate-900"
                          title="Edit Department"
                        >
                          <span className="sr-only">Edit</span>
                        </Button>

                        {dept.isArchived ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={RotateCcw}
                            onClick={() => handleRestoreDepartment(dept)}
                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Restore Department to Active Status"
                          >
                            <span className="sr-only">Restore</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Archive}
                            onClick={() => handleArchiveDepartment(dept)}
                            className="p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title="Archive Department (Preserves Historical Integrity)"
                          >
                            <span className="sr-only">Archive</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteDepartment(dept)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60"
                          title="Permanently Delete Department"
                        >
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    )}
                  </div>
                }
              >
                <div className="space-y-2 text-xs">
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                    {dept.description || 'Predefined organization department.'}
                  </p>

                  {/* Historical Usage Indicators */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Ticket className="w-3 h-3 text-indigo-500" />
                        {usage.tickets} tickets
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Laptop className="w-3 h-3 text-blue-500" />
                        {usage.assets} assets
                      </span>
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                        <Users className="w-3 h-3 text-emerald-500" />
                        {usage.users} users
                      </span>
                    </div>
                  </div>

                  {dept.isArchived && dept.archivedAt && (
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <History className="w-3 h-3 shrink-0" />
                      <span>Archived on {new Date(dept.archivedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          }))}
        </div>
      )}

      {/* Company Modal */}
      <Modal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        title={editingCompany ? 'Edit Company Master Record' : 'Create Independent Company'}
        subtitle="Saved to backend database and logged to security audit trail"
      >
        <form onSubmit={handleSaveCompany} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company Code"
              placeholder="e.g. APEX"
              value={companyForm.code}
              onChange={(e) => setCompanyForm({ ...companyForm, code: e.target.value.toUpperCase() })}
              required
              disabled={!!editingCompany}
              helperText="Unique identifier code"
            />
            <Select
              label="Status"
              value={companyForm.status}
              onChange={(e) => setCompanyForm({ ...companyForm, status: e.target.value as Company['status'] })}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'INACTIVE', label: 'INACTIVE' },
                { value: 'ARCHIVED', label: 'ARCHIVED' },
              ]}
            />
          </div>

          <Input
            label="Company Name"
            placeholder="e.g. Apex Global Technologies"
            value={companyForm.name}
            onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            required
          />

          <Input
            label="Domain"
            placeholder="e.g. apexglobal.io"
            value={companyForm.domain}
            onChange={(e) => setCompanyForm({ ...companyForm, domain: e.target.value })}
          />

          <Input
            label="Contact Email"
            type="email"
            placeholder="e.g. it-admin@apexglobal.io"
            value={companyForm.contactEmail}
            onChange={(e) => setCompanyForm({ ...companyForm, contactEmail: e.target.value })}
          />

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCompanyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              {editingCompany ? 'Save Changes' : 'Create Company'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Location Modal */}
      <Modal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        title={editingLocation ? 'Edit Location Master Record' : 'Create Independent Location'}
        subtitle="Independent facility master data stored in backend database"
      >
        <form onSubmit={handleSaveLocation} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Location Code"
              placeholder="e.g. NYC-HQ"
              value={locationForm.code}
              onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value.toUpperCase() })}
              required
              disabled={!!editingLocation}
            />
            <Select
              label="Status"
              value={locationForm.status}
              onChange={(e) => setLocationForm({ ...locationForm, status: e.target.value as Location['status'] })}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'INACTIVE', label: 'INACTIVE' },
                { value: 'ARCHIVED', label: 'ARCHIVED' },
              ]}
            />
          </div>

          <Input
            label="Facility / Campus Name"
            placeholder="e.g. Global Headquarters - New York"
            value={locationForm.name}
            onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
            required
          />

          <Input
            label="Street Address"
            placeholder="e.g. 350 5th Avenue, Fl 42"
            value={locationForm.address}
            onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="City"
              placeholder="e.g. New York"
              value={locationForm.city}
              onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
              required
            />
            <Input
              label="Country"
              placeholder="e.g. United States"
              value={locationForm.country}
              onChange={(e) => setLocationForm({ ...locationForm, country: e.target.value })}
              required
            />
          </div>

          <Input
            label="Timezone (IANA)"
            placeholder="e.g. America/New_York or UTC"
            value={locationForm.timezone}
            onChange={(e) => setLocationForm({ ...locationForm, timezone: e.target.value })}
          />

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLocationModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              {editingLocation ? 'Save Changes' : 'Create Location'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Department Modal (Super Admin Alone) */}
      <Modal
        isOpen={isDepartmentModalOpen}
        onClose={() => setIsDepartmentModalOpen(false)}
        title={editingDepartment ? 'Edit Department Master Record' : 'Create Organization Department'}
        subtitle="Super Admin governance: Predefined list used in employee selection dropdowns"
      >
        <form onSubmit={handleSaveDepartment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Department Code"
              placeholder="e.g. ENG"
              value={departmentForm.code}
              onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value.toUpperCase() })}
              required
              disabled={!!editingDepartment}
              helperText="Unique department code"
            />
            <Select
              label="Status"
              value={departmentForm.status}
              onChange={(e) => setDepartmentForm({ ...departmentForm, status: e.target.value as Department['status'] })}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'INACTIVE', label: 'INACTIVE' },
                { value: 'ARCHIVED', label: 'ARCHIVED' },
              ]}
            />
          </div>

          <Input
            label="Department Name"
            placeholder="e.g. Engineering & Technology"
            value={departmentForm.name}
            onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
            required
          />

          <Input
            label="Description / Responsibilities"
            placeholder="e.g. Software development, technical infrastructure, QA"
            value={departmentForm.description}
            onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
          />

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDepartmentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              {editingDepartment ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Corporate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
