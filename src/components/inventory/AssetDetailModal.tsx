import React, { useState } from 'react';
import { Asset, AssetAssignmentRecord, AssetCustomField } from '../../types';
import { updateAsset, deleteOrRetireAsset } from '../../services/assetService';
import { CANONICAL_ASSET_COLUMNS, CanonicalColumnMeta } from '../../utils/assetCalculations';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Laptop,
  User,
  MapPin,
  Building,
  Calendar,
  Clock,
  HardDrive,
  Cpu,
  Shield,
  Edit2,
  UserCheck,
  UserMinus,
  Archive,
  History,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  DollarSign,
  AlertCircle,
  Network,
  Wrench,
  Copy,
  Check,
  ListOrdered,
} from 'lucide-react';

interface AssetDetailModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onAssetUpdated: () => void;
  onEditClick: (asset: Asset) => void;
  canManage: boolean;
  employees: any[];
  customFields: AssetCustomField[];
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  asset,
  isOpen,
  onClose,
  onAssetUpdated,
  onEditClick,
  canManage,
  employees,
  customFields,
}) => {
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'HISTORY' | 'TRANSFER'>('DETAILS');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Transfer state
  const [transferTargetUserId, setTransferTargetUserId] = useState<string>('');
  const [transferEmployeeName, setTransferEmployeeName] = useState<string>('');
  const [transferUserName, setTransferUserName] = useState<string>('');
  const [transferNotes, setTransferNotes] = useState<string>('');

  // Retire confirm dialog
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);

  // 42 Canonical Order Stage Filter
  const [selectedStage, setSelectedStage] = useState<'ALL' | 'IDENTIFIERS_PERSONNEL' | 'HARDWARE_SPECS' | 'LIFECYCLE_CALCS' | 'PROCUREMENT_DATES'>('ALL');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyValue = (index: number, val: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen || !asset) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge variant="success">Active</Badge>;
      case 'Inactive':
        return <Badge variant="neutral">Inactive (In Stock)</Badge>;
      case 'Under Repair':
        return <Badge variant="warning">Under Repair</Badge>;
      case 'Retired':
        return <Badge variant="danger">Retired (Preserved)</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getAlertBadge = (alertText?: string | null, type: 'warranty' | 'replacement' = 'warranty') => {
    if (!alertText) return null;
    const lower = alertText.toLowerCase();
    if (lower.includes('expired') || lower.includes('overdue') || lower.includes('critical')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
          <AlertCircle className="w-3 h-3" />
          {alertText}
        </span>
      );
    }
    if (lower.includes('expiring') || lower.includes('due') || lower.includes('soon')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
          <AlertTriangle className="w-3 h-3" />
          {alertText}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
        <CheckCircle2 className="w-3 h-3" />
        {alertText}
      </span>
    );
  };

  const handleTransferOrReturn = async (returnToPool = false) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        assignedUserId: returnToPool ? null : transferTargetUserId || null,
        assignedUserName: returnToPool ? null : transferUserName.trim() || transferEmployeeName.trim() || undefined,
        assignedEmployeeName: returnToPool ? null : transferEmployeeName.trim() || undefined,
        assetUserName: returnToPool ? null : transferUserName.trim() || undefined,
        transferNotes: transferNotes.trim() || undefined,
        status: returnToPool ? 'Inactive' : 'Active',
      };

      const res = await updateAsset(asset.id, payload);
      if (res.success && res.asset) {
        setSuccessMsg(
          returnToPool
            ? 'Computer returned to inventory stock pool. Transfer ledger updated.'
            : `Computer successfully transferred. Assignment history updated.`
        );
        setTransferTargetUserId('');
        setTransferEmployeeName('');
        setTransferUserName('');
        setTransferNotes('');
        onAssetUpdated();
        setActiveTab('HISTORY');
      } else {
        setErrorMsg(res.error || 'Failed to update assignment.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating assignment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetireAsset = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await deleteOrRetireAsset(asset.id);
      if (res.success) {
        setShowRetireConfirm(false);
        setSuccessMsg(res.message || 'Asset retired. History permanently preserved.');
        onAssetUpdated();
      } else {
        setErrorMsg(res.error || 'Failed to retire asset.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error retiring asset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const historyRecords = (asset.assignmentHistory || []).slice().reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900">
                {asset.assetTag}
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                S/N: {asset.serialNumber}
              </span>
              {asset.condition && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {asset.condition}
                </span>
              )}
              {asset.newOrOld && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {asset.newOrOld}
                </span>
              )}
              {getStatusBadge(asset.status)}
            </div>
            <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">
              {asset.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {asset.manufacturer} {asset.model} &bull; {asset.assetType} &bull; {asset.company || asset.companyName || 'Standard Corp'} &bull; {asset.location || asset.locationName || 'Main Office'} {asset.department ? `&bull; ${asset.department}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManage && asset.status !== 'Retired' && (
              <Button
                variant="outline"
                size="sm"
                icon={Edit2}
                onClick={() => onEditClick(asset)}
                className="rounded-xl text-xs font-semibold"
              >
                Edit Asset
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('DETAILS')}
            className={`px-3 py-1.5 rounded-xl transition-colors ${
              activeTab === 'DETAILS'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All 42 Canonical Specifications & Details
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Assignment History Ledger ({historyRecords.length})
          </button>
          {canManage && asset.status !== 'Retired' && (
            <button
              onClick={() => setActiveTab('TRANSFER')}
              className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 ${
                activeTab === 'TRANSFER'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Transfer / Return
            </button>
          )}
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {/* TAB 1: DETAILS (STRICT 42-COLUMN ORDER FLOW) */}
          {activeTab === 'DETAILS' && (
            <div className="space-y-4">
              {/* Order Flow Banner & Stage Navigator */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-slate-50 to-blue-50/80 dark:from-indigo-950/40 dark:via-slate-900/60 dark:to-blue-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-3xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                        Strict 42-Column Canonical Order Flow
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        All computer hardware specifications, assignments, warranties, and financial attributes follow standard sequence #1 through #42.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 self-start sm:self-auto">
                    42 Canonical Fields Active
                  </span>
                </div>

                {/* Stage Filter Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setSelectedStage('ALL')}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      selectedStage === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    All 42 Columns (1-42)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStage('IDENTIFIERS_PERSONNEL')}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      selectedStage === 'IDENTIFIERS_PERSONNEL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    1-10: Identifiers & Personnel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStage('HARDWARE_SPECS')}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      selectedStage === 'HARDWARE_SPECS'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    11-26: Hardware Specs & Peripherals
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStage('LIFECYCLE_CALCS')}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      selectedStage === 'LIFECYCLE_CALCS'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    27-36: Lifecycle, Warranties & Analytics
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStage('PROCUREMENT_DATES')}
                    className={`px-2.5 py-1 rounded-xl transition-all ${
                      selectedStage === 'PROCUREMENT_DATES'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    37-42: Procurement, AMC & Dates
                  </button>
                </div>
              </div>

              {/* Alert Ribbons */}
              {(asset.replacementAlert || asset.warrantyAlert) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {asset.replacementAlert && (
                    <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200">#35</span>
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          Replacement Alert:
                        </span>
                      </div>
                      {getAlertBadge(asset.replacementAlert, 'replacement')}
                    </div>
                  )}
                  {asset.warrantyAlert && (
                    <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-200/80 dark:bg-blue-900 text-blue-900 dark:text-blue-200">#36</span>
                        <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                          Warranty Alert:
                        </span>
                      </div>
                      {getAlertBadge(asset.warrantyAlert, 'warranty')}
                    </div>
                  )}
                </div>
              )}

              {/* Sequential 42 Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {CANONICAL_ASSET_COLUMNS
                  .filter((col) => selectedStage === 'ALL' || col.category === selectedStage)
                  .map((col) => {
                    const rawVal = col.getValue(asset);
                    const stringVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
                    const hasValue = Boolean(stringVal && stringVal !== 'N/A' && stringVal !== '-');

                    // Badge theme based on column stage
                    const stageColor =
                      col.category === 'IDENTIFIERS_PERSONNEL'
                        ? 'border-indigo-200/70 dark:border-indigo-900/50 bg-indigo-50/20'
                        : col.category === 'HARDWARE_SPECS'
                        ? 'border-blue-200/70 dark:border-blue-900/50 bg-blue-50/20'
                        : col.category === 'LIFECYCLE_CALCS'
                        ? 'border-amber-200/70 dark:border-amber-900/50 bg-amber-50/20'
                        : 'border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/20';

                    const pillColor =
                      col.category === 'IDENTIFIERS_PERSONNEL'
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300'
                        : col.category === 'HARDWARE_SPECS'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'
                        : col.category === 'LIFECYCLE_CALCS'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300';

                    return (
                      <div
                        key={col.index}
                        className={`p-3 rounded-2xl border bg-white dark:bg-slate-900/70 shadow-2xs space-y-2 flex flex-col justify-between transition-all hover:border-indigo-400/80 hover:shadow-xs ${stageColor}`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded-md ${pillColor}`}>
                              #{col.index < 10 ? `0${col.index}` : col.index}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              {col.label}
                            </span>
                          </div>

                          {hasValue && (
                            <button
                              type="button"
                              onClick={() => handleCopyValue(col.index, stringVal)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title={`Copy ${col.label}`}
                            >
                              {copiedIndex === col.index ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Value Display */}
                        <div className="pt-0.5">
                          {col.format === 'currency' ? (
                            hasValue && !isNaN(Number(rawVal)) ? (
                              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                ₹{Number(rawVal).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">N/A</span>
                            )
                          ) : col.format === 'badge' ? (
                            col.name === 'Replacement Alert' ? (
                              getAlertBadge(stringVal, 'replacement') || <span className="text-slate-400 text-xs italic">Normal / N/A</span>
                            ) : col.name === 'Warranty Alert' ? (
                              getAlertBadge(stringVal, 'warranty') || <span className="text-slate-400 text-xs italic">N/A</span>
                            ) : col.name === 'Condition' ? (
                              <Badge variant={stringVal === 'Good' || stringVal === 'Working' ? 'success' : stringVal === 'Damaged' || stringVal === 'Scrap' ? 'danger' : 'neutral'}>
                                {stringVal || 'Good'}
                              </Badge>
                            ) : col.name === 'New (NH)/ Old (SH)' ? (
                              <Badge variant={stringVal.includes('New') ? 'info' : 'warning'}>
                                {stringVal || 'New (NH)'}
                              </Badge>
                            ) : col.name === 'Asset Type' ? (
                              <Badge variant="purple">{stringVal}</Badge>
                            ) : (
                              <Badge variant="neutral">{stringVal || '-'}</Badge>
                            )
                          ) : col.format === 'mono' ? (
                            hasValue ? (
                              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 break-all">
                                {stringVal}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Not assigned</span>
                            )
                          ) : col.format === 'date' ? (
                            hasValue ? (
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{stringVal}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Not set</span>
                            )
                          ) : (
                            /* Standard Text / Number */
                            hasValue ? (
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-words">
                                {stringVal}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">None recorded</span>
                            )
                          )}
                        </div>

                        {/* Subtle Footer hint */}
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                          {col.categoryLabel.split(':')[1]?.trim() || col.categoryLabel}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Custom Fields Extensibility */}
              {customFields.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Super Admin Custom Dynamic Fields (Extensible Schema)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    {customFields.map((cf) => {
                      const val = asset.customFields ? asset.customFields[cf.fieldKey] : undefined;
                      return (
                        <div key={cf.id} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">
                            {cf.label}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {val !== undefined && val !== null && val !== ''
                              ? typeof val === 'boolean'
                                ? val ? 'Yes' : 'No'
                                : String(val)
                              : <span className="text-slate-400 italic">Not set</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASSIGNMENT HISTORY LEDGER */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  Chronological assignment audit trail preserving employee transfers, initial allocations, and stock returns.
                </span>
              </div>

              {historyRecords.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No historical assignment transactions recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {historyRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={rec.action === 'INITIAL_ASSIGNMENT' ? 'success' : rec.action === 'TRANSFER' ? 'purple' : rec.action === 'STATUS_CHANGE' ? 'danger' : 'neutral'}>
                            {rec.action.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(rec.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Logged by: {rec.assignedByUserName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                        {rec.previousEmployeeName ? (
                          <>
                            <span className="text-slate-500">{rec.previousEmployeeName}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          </>
                        ) : null}
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {rec.currentEmployeeName || 'Returned to Stock Pool'}
                        </span>
                      </div>

                      {rec.notes && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                          &ldquo;{rec.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRANSFER / RETURN CONTROLS */}
          {activeTab === 'TRANSFER' && canManage && (
            <div className="space-y-5 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Transfer Hardware to Another Employee or Return to Stock
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Updating assignment will automatically record a permanent historical entry with previous employee, new assignee, and timestamp.
                </p>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Existing User Profile
                    </label>
                    <select
                      value={transferTargetUserId}
                      onChange={(e) => {
                        setTransferTargetUserId(e.target.value);
                        const emp = employees.find((u) => u.id === e.target.value);
                        if (emp) {
                          setTransferEmployeeName(emp.displayName || emp.name || '');
                          setTransferUserName(emp.displayName || emp.name || '');
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                    >
                      <option value="">-- Choose Employee Account --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.displayName || emp.name} ({emp.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Assigned Employee Name / Asset User Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Smith"
                      value={transferEmployeeName}
                      onChange={(e) => {
                        setTransferEmployeeName(e.target.value);
                        setTransferUserName(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Transfer Notes / Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Department transfer to Operations, equipment handed over."
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting || (!transferTargetUserId && !transferEmployeeName.trim())}
                    onClick={() => handleTransferOrReturn(false)}
                    className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
                  >
                    Transfer to Selected Employee
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting || (!asset.assignedUserId && !asset.assignedUserName && !asset.assignedEmployeeName)}
                    onClick={() => handleTransferOrReturn(true)}
                    className="rounded-xl text-xs font-semibold border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50"
                  >
                    Return to Stock Pool (Unassign)
                  </Button>
                </div>
              </div>

              {/* Danger Zone: Permanent Retire */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">
                  Decommission / Retire Computer
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Assets are never deleted. Retiring marks the computer as retired while permanently preserving all history, serial numbers, and logs.
                </p>

                {showRetireConfirm ? (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between gap-3">
                    <span className="text-xs text-rose-800 dark:text-rose-200 font-semibold">
                      Are you sure you want to decommission this asset?
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowRetireConfirm(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={handleRetireAsset}
                        className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        Confirm Retire
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Archive}
                    onClick={() => setShowRetireConfirm(true)}
                    className="rounded-xl text-xs font-semibold border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    Decommission / Retire Asset
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
