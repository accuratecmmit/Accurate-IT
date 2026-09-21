import React, { useState } from 'react';
import { Asset, AssetAssignmentRecord, AssetCustomField } from '../../types';
import { updateAsset, deleteOrRetireAsset } from '../../services/assetService';
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
          {/* TAB 1: DETAILS */}
          {activeTab === 'DETAILS' && (
            <div className="space-y-4">
              {/* Alert Ribbons */}
              {(asset.replacementAlert || asset.warrantyAlert) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {asset.replacementAlert && (
                    <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Replacement Status:
                      </span>
                      {getAlertBadge(asset.replacementAlert, 'replacement')}
                    </div>
                  )}
                  {asset.warrantyAlert && (
                    <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                        Warranty Status:
                      </span>
                      {getAlertBadge(asset.warrantyAlert, 'warranty')}
                    </div>
                  )}
                </div>
              )}

              {/* Assignment Status Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-indigo-500" />
                    Current Personnel Assignment (1-to-1 Rule)
                  </span>
                  {asset.assignedUserName || asset.assignedEmployeeName ? (
                    <Badge variant="success">Currently Assigned</Badge>
                  ) : (
                    <Badge variant="neutral">In Inventory Pool</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Employee Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {asset.assignedEmployeeName || asset.assignedUserName || 'None (In Stock Pool)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Asset User Name</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm font-mono">
                      {asset.assetUserName || asset.assignedUserName || 'None'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Assignment Date</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {asset.assignmentDate
                        ? new Date(asset.assignmentDate).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Hardware Specifications Grid */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-indigo-500" />
                  Hardware & Component Specifications
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Manufacturer</span>
                    <span className="font-semibold">{asset.manufacturer || 'OEM'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Model</span>
                    <span className="font-semibold">{asset.model || 'Standard Model'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Processor</span>
                    <span className="font-semibold">{asset.processor || asset.specifications?.cpu || 'Standard CPU'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">IP Adresss</span>
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {asset.ipAddress || (asset as any)['IP Adresss'] || 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">RAM</span>
                    <span className="font-semibold">{asset.ram || (asset.specifications?.ramGb ? `${asset.specifications.ramGb} GB` : 'N/A')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Storage</span>
                    <span className="font-semibold">{asset.storage || (asset.specifications?.storageGb ? `${asset.specifications.storageGb} GB` : 'N/A')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Windows Version</span>
                    <span className="font-semibold">{asset.windowsVersion || asset.specifications?.os || 'Windows 11'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">MS Office</span>
                    <span className="font-semibold">{asset.msOffice || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">EScan Antivirus</span>
                    <span className="font-semibold">{asset.escan || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Motherboard</span>
                    <span className="font-semibold">{asset.motherboard || 'OEM System Board'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Display</span>
                    <span className="font-semibold">{asset.display || 'Built-in / Standard'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Display Size</span>
                    <span className="font-semibold">{asset.displaySize || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">LAN Card</span>
                    <span className="font-semibold">{asset.lanCard || 'Gigabit Ethernet'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">UPS / Battery</span>
                    <span className="font-semibold">{asset.upsBattery || 'Standard Battery'}</span>
                  </div>
                </div>
              </div>

              {/* Financial & Valuation Grid */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  Financial, Procurement & Valuation
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Purchase Cost (INR)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {asset.purchaseCost !== undefined && asset.purchaseCost !== null
                        ? `₹${asset.purchaseCost.toLocaleString()}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Depreciated Value (INR)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                      {asset.depreciatedValue !== undefined && asset.depreciatedValue !== null
                        ? `₹${asset.depreciatedValue.toLocaleString()}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendor</span>
                    <span className="font-semibold">{asset.vendor || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Invoice Number</span>
                    <span className="font-mono text-xs font-semibold">{asset.invoiceNumber || 'N/A'}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Purchase Date</span>
                    <span>{asset.purchaseDate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Asset Age (Yrs)</span>
                    <span className="font-bold">{asset.assetAgeYears !== undefined ? `${asset.assetAgeYears} yrs` : 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Expected Life (Yrs)</span>
                    <span className="font-semibold">{asset.expectedLifeYears ? `${asset.expectedLifeYears} yrs` : '5 yrs'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Expected Replacement</span>
                    <span className="font-semibold">{asset.expectedReplacementDate || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Maintenance, Warranty & AMC */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Warranty, AMC & Maintenance Lifecycle
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Warranty Start</span>
                    <span>{asset.warrantyStart || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Warranty End</span>
                    <span>{asset.warrantyEnd || asset.warrantyExpiryDate || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">AMC Start</span>
                    <span>{asset.amcStart || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">AMC End</span>
                    <span>{asset.amcEnd || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Last Service Date</span>
                    <span>{asset.lastServiceDate || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Remarks & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">Remarks</span>
                  <p className="text-slate-600 dark:text-slate-300 italic">
                    {asset.remarks || 'No remarks recorded for this asset.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">Administrative Notes</span>
                  <p className="text-slate-600 dark:text-slate-300 italic">
                    {asset.notes || 'No notes recorded.'}
                  </p>
                </div>
              </div>

              {/* Custom Fields Extensibility */}
              {customFields.length > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Super Admin Custom Fields
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
