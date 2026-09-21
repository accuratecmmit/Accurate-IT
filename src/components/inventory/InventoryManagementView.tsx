import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';
import {
  fetchAssets,
  fetchCustomFields,
  downloadInventoryExcel,
  AssetCustomField,
} from '../../services/assetService';
import { fetchITTeams, ITTeam } from '../../services/itTeamService';
import { fetchAdminUsers } from '../../services/authService';
import { Asset } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ExcelImportModal } from './ExcelImportModal';
import { AssetDetailModal } from './AssetDetailModal';
import { AssetFormModal } from './AssetFormModal';
import { CustomFieldsModal } from './CustomFieldsModal';
import {
  Laptop,
  Plus,
  Search,
  RefreshCw,
  Building,
  MapPin,
  Cpu,
  User,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Calendar,
  FileSpreadsheet,
  Download,
  Upload,
  Sliders,
  History,
  Archive,
  ArrowRight,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  DollarSign,
  AlertCircle,
  Network,
  HardDrive,
} from 'lucide-react';

export const InventoryManagementView: React.FC = () => {
  const { user, profile, effectiveRole, isSuperAdmin } = useAuth();
  const {
    companies,
    locations,
    departments,
    activeCompanies,
    activeLocations,
    activeDepartments,
  } = useMasterData();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [itTeams, setItTeams] = useState<ITTeam[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<AssetCustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'REPLACEMENT' | 'WARRANTY'>('ALL');
  const [includeRetired, setIncludeRetired] = useState(false);
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('TABLE');

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCustomFieldsModalOpen, setIsCustomFieldsModalOpen] = useState(false);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);

  const isEmployee = effectiveRole === 'EMPLOYEE';
  const isTechnician = effectiveRole === 'IT_TECHNICIAN';
  const isITAdmin = effectiveRole === 'IT_ADMIN';
  const canManage = isSuperAdmin || isITAdmin || isTechnician;

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [assetRes, teamRes, customFieldsRes] = await Promise.all([
        fetchAssets({ includeRetired }),
        fetchITTeams(),
        fetchCustomFields(),
      ]);

      if (assetRes.error) {
        setErrorMsg(assetRes.error);
      } else {
        setAssets(assetRes.assets || []);
      }

      setItTeams(teamRes.teams || []);
      setCustomFields(customFieldsRes.customFields || []);

      if (effectiveRole !== 'EMPLOYEE') {
        try {
          const userRes = await fetchAdminUsers();
          setEmployees(userRes.users || []);
        } catch {
          // non-critical
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load computer asset inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveRole, includeRetired]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    setErrorMsg(null);
    try {
      await downloadInventoryExcel();
      showSuccess('Inventory spreadsheet exported with all 42 canonical columns.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to export inventory spreadsheet.');
    } finally {
      setIsExporting(false);
    }
  };

  // KPIs & Metrics
  const metrics = useMemo(() => {
    let activeCount = 0;
    let inStockCount = 0;
    let underRepairCount = 0;
    let retiredCount = 0;
    let totalDepreciatedValue = 0;
    let replacementAlerts = 0;
    let warrantyAlerts = 0;

    for (const a of assets) {
      if (a.status === 'Active') activeCount++;
      else if (a.status === 'Inactive') inStockCount++;
      else if (a.status === 'Under Repair') underRepairCount++;
      else if (a.status === 'Retired') retiredCount++;

      if (a.depreciatedValue && !isNaN(Number(a.depreciatedValue))) {
        totalDepreciatedValue += Number(a.depreciatedValue);
      }

      if (a.replacementAlert && !a.replacementAlert.toLowerCase().includes('good') && !a.replacementAlert.toLowerCase().includes('n/a')) {
        replacementAlerts++;
      }
      if (a.warrantyAlert && (a.warrantyAlert.toLowerCase().includes('expired') || a.warrantyAlert.toLowerCase().includes('expiring'))) {
        warrantyAlerts++;
      }
    }

    return {
      total: assets.length,
      activeCount,
      inStockCount,
      underRepairCount,
      retiredCount,
      totalDepreciatedValue,
      replacementAlerts,
      warrantyAlerts,
    };
  }, [assets]);

  // Filtered Assets
  const filteredAssets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return (assets || []).filter((a) => {
      const matchesSearch =
        !q ||
        a.assetTag.toLowerCase().includes(q) ||
        (a.assetNumber && a.assetNumber.toLowerCase().includes(q)) ||
        a.serialNumber.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.assignedUserName && a.assignedUserName.toLowerCase().includes(q)) ||
        (a.assignedEmployeeName && a.assignedEmployeeName.toLowerCase().includes(q)) ||
        (a.assetUserName && a.assetUserName.toLowerCase().includes(q)) ||
        (a.model && a.model.toLowerCase().includes(q)) ||
        (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
        (a.ipAddress && a.ipAddress.toLowerCase().includes(q)) ||
        ((a as any)['IP Adresss'] && String((a as any)['IP Adresss']).toLowerCase().includes(q)) ||
        (a.processor && a.processor.toLowerCase().includes(q)) ||
        (a.vendor && a.vendor.toLowerCase().includes(q)) ||
        (a.invoiceNumber && a.invoiceNumber.toLowerCase().includes(q)) ||
        (a.location && a.location.toLowerCase().includes(q)) ||
        (a.locationName && a.locationName.toLowerCase().includes(q)) ||
        (a.company && a.company.toLowerCase().includes(q)) ||
        (a.companyName && a.companyName.toLowerCase().includes(q)) ||
        (a.department && a.department.toLowerCase().includes(q));

      const matchesType = typeFilter === 'ALL' || a.assetType === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const matchesLocation =
        locationFilter === 'ALL' ||
        a.locationId === locationFilter ||
        a.location === locationFilter;

      let matchesAlert = true;
      if (alertFilter === 'REPLACEMENT') {
        matchesAlert = Boolean(
          a.replacementAlert &&
          !a.replacementAlert.toLowerCase().includes('good') &&
          !a.replacementAlert.toLowerCase().includes('n/a')
        );
      } else if (alertFilter === 'WARRANTY') {
        matchesAlert = Boolean(
          a.warrantyAlert &&
          (a.warrantyAlert.toLowerCase().includes('expired') || a.warrantyAlert.toLowerCase().includes('expiring'))
        );
      }

      return matchesSearch && matchesType && matchesStatus && matchesLocation && matchesAlert;
    });
  }, [assets, searchTerm, typeFilter, statusFilter, locationFilter, alertFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge variant="success">Active</Badge>;
      case 'Inactive':
        return <Badge variant="neutral">In Stock</Badge>;
      case 'Under Repair':
        return <Badge variant="warning">Under Repair</Badge>;
      case 'Retired':
        return <Badge variant="danger">Retired</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getAlertBadge = (alertText?: string | null) => {
    if (!alertText) return <span className="text-slate-400 text-[11px]">-</span>;
    const lower = alertText.toLowerCase();
    if (lower.includes('expired') || lower.includes('overdue') || lower.includes('critical')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-2.5 h-2.5" />
          {alertText}
        </span>
      );
    }
    if (lower.includes('expiring') || lower.includes('due') || lower.includes('soon')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-2.5 h-2.5" />
          {alertText}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="w-2.5 h-2.5" />
        {alertText}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Hardware Computer & Asset Inventory
            </h2>
            <Badge variant={isEmployee ? 'neutral' : isTechnician ? 'warning' : isITAdmin ? 'info' : 'purple'}>
              {effectiveRole} SCOPE
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isEmployee && 'Viewing hardware computers and peripherals assigned exclusively to your profile.'}
            {isTechnician && 'Add and manage computers within your permitted IT Team scope. Single-employee assignment.'}
            {isITAdmin && 'Full hardware lifecycle control across your IT Team scope. Transfer ledger and status tracking.'}
            {isSuperAdmin && 'Organization-wide IT inventory across all locations and companies. 42-column Excel processing.'}
          </p>
        </div>

        {/* Global Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Sheet</span>
            </button>
            <button
              onClick={() => setViewMode('CARDS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                viewMode === 'CARDS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            icon={RefreshCw}
            disabled={isLoading}
            className="text-xs font-semibold rounded-xl"
          >
            Refresh
          </Button>

          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={isExporting || assets.length === 0}
                icon={Download}
                className="text-xs font-semibold rounded-xl"
              >
                {isExporting ? 'Exporting...' : 'Export Excel (42 Cols)'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportModalOpen(true)}
                icon={Upload}
                className="text-xs font-semibold rounded-xl border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                Import Excel
              </Button>

              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomFieldsModalOpen(true)}
                  icon={Sliders}
                  className="text-xs font-semibold rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                >
                  Custom Fields ({customFields.length})
                </Button>
              )}

              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setAssetToEdit(null);
                  setIsAssetFormOpen(true);
                }}
                icon={Plus}
                className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-xs"
              >
                Register Asset
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Computers</span>
          <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{metrics.total}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Active In Use</span>
          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.activeCount}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">In Stock Pool</span>
          <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{metrics.inStockCount}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Under Repair</span>
          <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{metrics.underRepairCount}</span>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 block">Depreciated Value</span>
          <span className="text-base font-extrabold text-slate-800 dark:text-slate-200">
            ₹{metrics.totalDepreciatedValue.toLocaleString()}
          </span>
        </div>

        <button
          onClick={() => setAlertFilter(alertFilter === 'REPLACEMENT' ? 'ALL' : 'REPLACEMENT')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            alertFilter === 'REPLACEMENT'
              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Replacement Due
          </span>
          <span className="text-xl font-extrabold text-amber-700 dark:text-amber-300">{metrics.replacementAlerts}</span>
        </button>

        <button
          onClick={() => setAlertFilter(alertFilter === 'WARRANTY' ? 'ALL' : 'WARRANTY')}
          className={`p-3 rounded-2xl border text-left transition-all ${
            alertFilter === 'WARRANTY'
              ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300'
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Warranty Alerts
          </span>
          <span className="text-xl font-extrabold text-rose-700 dark:text-rose-300">{metrics.warrantyAlerts}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Empty State with Excel Starter Callout */}
      {!isLoading && assets.length === 0 && canManage && (
        <div className="p-8 bg-gradient-to-br from-indigo-50/60 via-slate-50 to-emerald-50/40 dark:from-indigo-950/20 dark:via-slate-900 dark:to-emerald-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mx-auto shadow-xs">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Initialize Organization Computer Inventory
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Start with the organization's existing Excel inventory workbook with all 42 columns, or register assets manually.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              onClick={() => setIsImportModalOpen(true)}
              className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 font-semibold"
            >
              Open Excel Workbook Importer
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Plus}
              onClick={() => {
                setAssetToEdit(null);
                setIsAssetFormOpen(true);
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Register Asset Manually
            </Button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search tag, S/N, employee, IP, model, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
        </div>

        {/* Type Filter */}
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Hardware Types</option>
            <option value="LAPTOP">Laptop</option>
            <option value="DESKTOP">Desktop</option>
            <option value="WORKSTATION">Workstation</option>
            <option value="SERVER">Server</option>
            <option value="MONITOR">Monitor</option>
            <option value="NETWORK_DEVICE">Network Device</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active (In Service)</option>
            <option value="Inactive">Inactive (In Stock)</option>
            <option value="Under Repair">Under Repair</option>
            <option value="Retired">Retired</option>
          </select>
        </div>

        {/* Location Filter */}
        <div>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Locations</option>
            {activeLocations.map((loc) => (
              <option key={loc.id} value={loc.name}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secondary Filter Flags: Include Retired Toggle & Count indicator */}
      <div className="flex flex-wrap items-center justify-between text-xs px-1 gap-2">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-800 dark:text-slate-200">{filteredAssets.length}</strong> of{' '}
            <strong className="text-slate-800 dark:text-slate-200">{assets.length}</strong> computers
          </span>

          {alertFilter !== 'ALL' && (
            <button
              onClick={() => setAlertFilter('ALL')}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              Clear {alertFilter} Filter
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 font-medium">
          <input
            type="checkbox"
            checked={includeRetired}
            onChange={(e) => setIncludeRetired(e.target.checked)}
            className="rounded text-indigo-600 focus:ring-indigo-500"
          />
          <span>Include Retired Computers (Permanent History Preserved)</span>
        </label>
      </div>

      {/* Asset Content: Table vs Card Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
          <p className="text-xs">Loading computer inventory & assignment ledgers...</p>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <Laptop className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Computer Assets Found</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isEmployee
              ? 'You do not have any company hardware assets assigned to your profile.'
              : 'No computers match your search and filter criteria.'}
          </p>
        </div>
      ) : viewMode === 'TABLE' ? (
        /* TABLE SPREADSHEET VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Asset ID / Tag</th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Asset Type</th>
                  <th className="py-3 px-3">Condition</th>
                  <th className="py-3 px-3">Assignee / User</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3">IP Adresss</th>
                  <th className="py-3 px-3">Serial Number</th>
                  <th className="py-3 px-3">Manufacturer / Model</th>
                  <th className="py-3 px-3">Depreciated (₹)</th>
                  <th className="py-3 px-3">Replacement Alert</th>
                  <th className="py-3 px-3">Warranty Alert</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-medium">
                {filteredAssets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedAssetForDetail(asset)}
                    className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {asset.assetTag}
                        </span>
                        {getStatusBadge(asset.status)}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {asset.company || asset.companyName || 'CORP'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {asset.assetType}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {asset.condition || 'Good'}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {asset.assignedUserName || asset.assignedEmployeeName ? (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-indigo-500" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {asset.assignedEmployeeName || asset.assignedUserName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">In Pool</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {asset.location || asset.locationName || 'N/A'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap text-indigo-600 dark:text-indigo-400 font-semibold">
                      {asset.ipAddress || (asset as any)['IP Adresss'] || '-'}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                      {asset.serialNumber}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {asset.manufacturer || 'OEM'} {asset.model}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">
                      {asset.depreciatedValue !== undefined && asset.depreciatedValue !== null
                        ? `₹${asset.depreciatedValue.toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getAlertBadge(asset.replacementAlert)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getAlertBadge(asset.warrantyAlert)}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedAssetForDetail(asset)}
                          className="px-2 py-1 text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
                        >
                          View Details
                        </button>
                        {canManage && asset.status !== 'Retired' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAssetToEdit(asset);
                              setIsAssetFormOpen(true);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Edit Asset"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelectedAssetForDetail(asset)}
              className="group p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5 transition-all hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm cursor-pointer"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-extrabold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                      {asset.assetTag}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      &bull; {asset.assetType}
                    </span>
                    {asset.condition && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {asset.condition}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {asset.name}
                  </h4>
                </div>

                <div className="flex items-center gap-1">
                  {getStatusBadge(asset.status)}
                  {canManage && asset.status !== 'Retired' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssetToEdit(asset);
                        setIsAssetFormOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit Asset"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Specs Box */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Hardware</span>
                  <span className="font-semibold truncate block">{asset.manufacturer || 'OEM'} {asset.model}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">IP Adresss</span>
                  <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                    {asset.ipAddress || (asset as any)['IP Adresss'] || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">CPU & RAM</span>
                  <span className="font-semibold truncate block">
                    {asset.processor || asset.specifications?.cpu || (asset.specifications?.ramGb ? `${asset.specifications.ramGb}GB` : 'N/A')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Depreciated Value</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {asset.depreciatedValue !== undefined && asset.depreciatedValue !== null
                      ? `₹${asset.depreciatedValue.toLocaleString()}`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Alerts Ribbon */}
              {(asset.replacementAlert || asset.warrantyAlert) && (
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {asset.replacementAlert && getAlertBadge(asset.replacementAlert)}
                  {asset.warrantyAlert && getAlertBadge(asset.warrantyAlert)}
                </div>
              )}

              {/* Personnel & Location */}
              <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[11px] truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    {asset.location || asset.locationName || 'Main Office'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] truncate font-semibold">
                    <Building className="w-3 h-3 text-slate-400 shrink-0" />
                    {asset.company || asset.companyName || 'CORP'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <span className="flex items-center gap-1.5 truncate">
                    <User className="w-3 h-3 text-indigo-500 shrink-0" />
                    {asset.assignedUserName || asset.assignedEmployeeName ? (
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {asset.assignedEmployeeName || asset.assignedUserName}
                      </span>
                    ) : (
                      <span className="italic text-slate-400">Unassigned (In Pool)</span>
                    )}
                  </span>

                  {asset.assignmentDate && (
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(asset.assignmentDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {/* 1. Excel Import Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={async () => {
          await loadData();
          showSuccess('Inventory updated from Excel workbook.');
        }}
      />

      {/* 2. Super Admin Custom Fields Modal */}
      <CustomFieldsModal
        isOpen={isCustomFieldsModalOpen}
        onClose={() => setIsCustomFieldsModalOpen(false)}
        onFieldsUpdated={loadData}
      />

      {/* 3. Asset Detail & Transfer Ledger Modal */}
      <AssetDetailModal
        asset={selectedAssetForDetail}
        isOpen={Boolean(selectedAssetForDetail)}
        onClose={() => setSelectedAssetForDetail(null)}
        onAssetUpdated={async () => {
          await loadData();
          if (selectedAssetForDetail) {
            const updated = assets.find((a) => a.id === selectedAssetForDetail.id);
            if (updated) setSelectedAssetForDetail(updated);
          }
        }}
        onEditClick={(asset) => {
          setSelectedAssetForDetail(null);
          setAssetToEdit(asset);
          setIsAssetFormOpen(true);
        }}
        canManage={canManage}
        employees={employees}
        customFields={customFields}
      />

      {/* 4. Asset Add / Edit Modal */}
      <AssetFormModal
        isOpen={isAssetFormOpen}
        onClose={() => {
          setIsAssetFormOpen(false);
          setAssetToEdit(null);
        }}
        onSaved={async () => {
          await loadData();
          showSuccess(assetToEdit ? 'Asset updated successfully.' : 'Asset registered successfully.');
        }}
        assetToEdit={assetToEdit}
        companies={activeCompanies}
        locations={activeLocations}
        departments={activeDepartments}
        itTeams={itTeams}
        employees={employees}
        customFields={customFields}
        isSuperAdmin={isSuperAdmin}
        currentUserTeamId={profile?.itTeamId}
      />
    </div>
  );
};
