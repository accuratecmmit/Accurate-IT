import React, { useState, useEffect, useMemo } from 'react';
import { Asset, AssetCustomField } from '../../types';
import { createAsset, updateAsset } from '../../services/assetService';
import { computeAssetCalculations } from '../../utils/assetCalculations';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Laptop,
  Cpu,
  User,
  MapPin,
  Building,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Calendar,
  Wrench,
  DollarSign,
  ListOrdered,
  Sparkles,
  HardDrive,
} from 'lucide-react';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  assetToEdit?: Asset | null;
  companies: any[];
  locations: any[];
  departments: any[];
  itTeams: any[];
  employees: any[];
  customFields: AssetCustomField[];
  isSuperAdmin: boolean;
  currentUserTeamId?: string;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  assetToEdit,
  companies = [],
  locations = [],
  departments = [],
  itTeams = [],
  employees = [],
  customFields = [],
  isSuperAdmin,
  currentUserTeamId,
}) => {
  const isEditing = Boolean(assetToEdit);

  // 1. Identifiers & Master Affiliation
  const [assetTag, setAssetTag] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<string>('LAPTOP');
  const [status, setStatus] = useState<Asset['status']>('Inactive');
  const [condition, setCondition] = useState('Good');
  const [newOrOld, setNewOrOld] = useState('New (NH)');

  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departmentName, setDepartmentName] = useState('');

  // 2. Personnel
  const [assignedUserId, setAssignedUserId] = useState('');
  const [assignedEmployeeName, setAssignedEmployeeName] = useState('');
  const [assetUserName, setAssetUserName] = useState('');
  const [assignedTeamId, setAssignedTeamId] = useState('');

  // 3. Hardware Specs
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [processor, setProcessor] = useState('');
  const [storage, setStorage] = useState('512 GB SSD');
  const [ram, setRam] = useState('16 GB');
  const [windowsVersion, setWindowsVersion] = useState('Windows 11 Pro');
  const [msOffice, setMsOffice] = useState('Office 2021');
  const [escan, setEscan] = useState('');
  const [motherboard, setMotherboard] = useState('');
  const [display, setDisplay] = useState('');
  const [displaySize, setDisplaySize] = useState('');
  const [lanCard, setLanCard] = useState('');
  const [upsBattery, setUpsBattery] = useState('');
  const [ipAddress, setIpAddress] = useState('');

  // 4. Financial & Procurement
  const [vendor, setVendor] = useState('');
  const [purchaseCost, setPurchaseCost] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');

  // 5. Lifecycle & Maintenance
  const [warrantyStart, setWarrantyStart] = useState('');
  const [warrantyEnd, setWarrantyEnd] = useState('');
  const [amcStart, setAmcStart] = useState('');
  const [amcEnd, setAmcEnd] = useState('');
  const [lastServiceDate, setLastServiceDate] = useState('');
  const [expectedLifeYears, setExpectedLifeYears] = useState<number>(5);

  // 6. Notes & Remarks
  const [remarks, setRemarks] = useState('');
  const [notes, setNotes] = useState('');

  // Dynamic Custom Fields State
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (assetToEdit) {
      setAssetTag(assetToEdit.assetTag || '');
      setSerialNumber(assetToEdit.serialNumber || '');
      setName(assetToEdit.name || '');
      setAssetType(assetToEdit.assetType || 'LAPTOP');
      setStatus(assetToEdit.status || 'Active');
      setCondition(assetToEdit.condition || 'Good');
      setNewOrOld(assetToEdit.newOrOld || 'New (NH)');

      setCompanyId(assetToEdit.companyId || (companies[0]?.id || ''));
      setCompanyName(assetToEdit.companyName || assetToEdit.company || '');
      setLocationId(assetToEdit.locationId || (locations[0]?.id || ''));
      setLocationName(assetToEdit.locationName || assetToEdit.location || '');
      setDepartmentId(assetToEdit.departmentId || '');
      setDepartmentName(assetToEdit.departmentName || assetToEdit.department || '');

      setAssignedUserId(assetToEdit.assignedUserId || '');
      setAssignedEmployeeName(assetToEdit.assignedEmployeeName || assetToEdit.assignedUserName || '');
      setAssetUserName(assetToEdit.assetUserName || assetToEdit.assignedUserName || '');
      setAssignedTeamId(assetToEdit.assignedTeamId || '');

      setManufacturer(assetToEdit.manufacturer || '');
      setModel(assetToEdit.model || '');
      setProcessor(assetToEdit.processor || assetToEdit.specifications?.cpu || assetToEdit.specifications?.processor || '');
      setStorage(assetToEdit.storage || (assetToEdit.specifications?.storageGb ? `${assetToEdit.specifications.storageGb} GB` : '512 GB SSD'));
      setRam(assetToEdit.ram || (assetToEdit.specifications?.ramGb ? `${assetToEdit.specifications.ramGb} GB` : '16 GB'));
      setWindowsVersion(assetToEdit.windowsVersion || assetToEdit.specifications?.os || assetToEdit.specifications?.operatingSystem || 'Windows 11 Pro');
      setMsOffice(assetToEdit.msOffice || '');
      setEscan(assetToEdit.escan || '');
      setMotherboard(assetToEdit.motherboard || '');
      setDisplay(assetToEdit.display || '');
      setDisplaySize(assetToEdit.displaySize || '');
      setLanCard(assetToEdit.lanCard || '');
      setUpsBattery(assetToEdit.upsBattery || '');
      setIpAddress(assetToEdit.ipAddress || assetToEdit.specifications?.ipAddress || '');

      setVendor(assetToEdit.vendor || '');
      setPurchaseCost(assetToEdit.purchaseCost !== undefined && assetToEdit.purchaseCost !== null ? String(assetToEdit.purchaseCost) : '');
      setInvoiceNumber(assetToEdit.invoiceNumber || '');
      setPurchaseDate(assetToEdit.purchaseDate || assetToEdit.purchaseDateParsed || '');

      setWarrantyStart(assetToEdit.warrantyStart || '');
      setWarrantyEnd(assetToEdit.warrantyEnd || assetToEdit.warrantyExpiryDate || '');
      setAmcStart(assetToEdit.amcStart || '');
      setAmcEnd(assetToEdit.amcEnd || '');
      setLastServiceDate(assetToEdit.lastServiceDate || '');
      setExpectedLifeYears(assetToEdit.expectedLifeYears || 5);

      setRemarks(assetToEdit.remarks || '');
      setNotes(assetToEdit.notes || '');
      setCustomFieldValues(assetToEdit.customFields || {});
    } else {
      setAssetTag('');
      setSerialNumber('');
      setName('');
      setAssetType('LAPTOP');
      setStatus('Inactive');
      setCondition('Good');
      setNewOrOld('New (NH)');

      setCompanyId(companies[0]?.id || '');
      setCompanyName(companies[0]?.name || '');
      setLocationId(locations[0]?.id || '');
      setLocationName(locations[0]?.name || '');
      setDepartmentId(departments[0]?.id || '');
      setDepartmentName(departments[0]?.name || '');

      setAssignedUserId('');
      setAssignedEmployeeName('');
      setAssetUserName('');
      setAssignedTeamId(isSuperAdmin ? (itTeams[0]?.id || '') : (currentUserTeamId || ''));

      setManufacturer('');
      setModel('');
      setProcessor('');
      setStorage('512 GB SSD');
      setRam('16 GB');
      setWindowsVersion('Windows 11 Pro');
      setMsOffice('Office 2021');
      setEscan('');
      setMotherboard('');
      setDisplay('');
      setDisplaySize('');
      setLanCard('');
      setUpsBattery('');
      setIpAddress('');

      setVendor('');
      setPurchaseCost('');
      setInvoiceNumber('');
      setPurchaseDate('');

      setWarrantyStart('');
      setWarrantyEnd('');
      setAmcStart('');
      setAmcEnd('');
      setLastServiceDate('');
      setExpectedLifeYears(5);

      setRemarks('');
      setNotes('');
      setCustomFieldValues({});
    }
    setErrorMsg(null);
  }, [assetToEdit, isOpen]);

  const liveCalcs = useMemo(() => {
    return computeAssetCalculations({
      purchaseDate,
      purchaseCost,
      expectedLifeYears,
      warrantyEnd,
    });
  }, [purchaseDate, purchaseCost, expectedLifeYears, warrantyEnd]);

  if (!isOpen) return null;

  const handleCustomFieldChange = (key: string, val: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetTag.trim() || !serialNumber.trim()) {
      setErrorMsg('Asset Tag / ID and Serial Number are strictly required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    // Resolve location ID and name
    let finalLocationId = locationId;
    let finalLocationName = locationName;
    if (!finalLocationId && locations.length > 0) {
      finalLocationId = locations[0].id;
      finalLocationName = locations[0].name;
    }
    if (!finalLocationId) {
      finalLocationId = 'loc_default';
    }

    // Resolve company ID and name
    let finalCompanyId = companyId;
    let finalCompanyName = companyName;
    if (!finalCompanyId && companies.length > 0) {
      finalCompanyId = companies[0].id;
      finalCompanyName = companies[0].name;
    }
    if (!finalCompanyId) {
      finalCompanyId = 'comp_default';
    }

    // Resolve department
    let finalDepartmentId = departmentId || null;
    let finalDepartmentName = departmentName || null;
    if (!finalDepartmentName && departments.length > 0 && finalDepartmentId) {
      const dep = departments.find((d) => d.id === finalDepartmentId);
      if (dep) finalDepartmentName = dep.name;
    }

    // Resolve assigned user info
    let finalAssignedUserId = assignedUserId || null;
    let finalAssignedUserName = assetUserName.trim() || assignedEmployeeName.trim() || null;
    if (finalAssignedUserId && !finalAssignedUserName) {
      const emp = employees.find((u) => u.id === finalAssignedUserId);
      if (emp) finalAssignedUserName = emp.displayName || emp.name;
    }

    // RAM and Storage numeric parses for specifications
    const ramMatch = ram.match(/(\d+)/);
    const ramGb = ramMatch ? parseInt(ramMatch[1], 10) : 16;
    const storageMatch = storage.match(/(\d+)/);
    const storageGb = storageMatch ? parseInt(storageMatch[1], 10) : 512;

    const cleanTag = assetTag.trim().toUpperCase();

    const payload: Partial<Asset> = {
      assetTag: cleanTag,
      assetNumber: cleanTag,
      serialNumber: serialNumber.trim().toUpperCase(),
      name: name.trim() || `${manufacturer} ${model}`.trim() || cleanTag,
      assetType: assetType as any,
      condition,
      newOrOld,
      status: finalAssignedUserName && status === 'Inactive' ? 'Active' : status,

      companyId: finalCompanyId,
      companyName: finalCompanyName || undefined,
      company: finalCompanyName || undefined,
      locationId: finalLocationId,
      locationName: finalLocationName || undefined,
      location: finalLocationName || undefined,
      departmentId: finalDepartmentId,
      departmentName: finalDepartmentName,
      department: finalDepartmentName,

      assignedTeamId: isSuperAdmin ? assignedTeamId || null : currentUserTeamId || null,
      assignedUserId: finalAssignedUserId,
      assignedUserName: finalAssignedUserName,
      assignedEmployeeName: assignedEmployeeName.trim() || finalAssignedUserName,
      assetUserName: assetUserName.trim() || finalAssignedUserName,

      manufacturer: manufacturer.trim(),
      model: model.trim(),
      processor: processor.trim(),
      storage: storage.trim(),
      ram: ram.trim(),
      windowsVersion: windowsVersion.trim(),
      msOffice: msOffice.trim(),
      escan: escan.trim(),
      motherboard: motherboard.trim(),
      display: display.trim(),
      displaySize: displaySize.trim(),
      lanCard: lanCard.trim(),
      upsBattery: upsBattery.trim(),
      ipAddress: ipAddress.trim(),

      vendor: vendor.trim() || null,
      purchaseCost: purchaseCost ? parseFloat(purchaseCost) : null,
      invoiceNumber: invoiceNumber.trim() || null,
      purchaseDate: purchaseDate || null,

      warrantyStart: warrantyStart || null,
      warrantyEnd: warrantyEnd || null,
      warrantyExpiryDate: warrantyEnd || null,
      amcStart: amcStart || null,
      amcEnd: amcEnd || null,
      lastServiceDate: lastServiceDate || null,
      expectedLifeYears: Number(expectedLifeYears) || 4,

      remarks: remarks.trim() || null,
      notes: notes.trim() || null,
      customFields: customFieldValues,

      specifications: {
        cpu: processor.trim() || undefined,
        processor: processor.trim() || undefined,
        ramGb,
        storageGb,
        storageType: storage.includes('HDD') ? 'HDD' : 'SSD',
        os: windowsVersion.trim() || undefined,
        operatingSystem: windowsVersion.trim() || undefined,
        ipAddress: ipAddress.trim() || undefined,
      },
    };

    try {
      if (isEditing && assetToEdit) {
        const res = await updateAsset(assetToEdit.id, payload);
        if (res.success) {
          onSaved();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to update asset');
        }
      } else {
        const res = await createAsset(payload);
        if (res.success) {
          onSaved();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to register asset');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {isEditing ? `Edit Hardware Asset: ${assetToEdit?.assetTag}` : 'Register New Hardware Inventory Asset'}
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                  Strict 42-Column Flow
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Form inputs follow the exact sequential 42-column order: Identification (#1-#5), Personnel & Network (#6-#10), Specs (#11-#26), Lifecycle & Calculations (#27-#36), Procurement (#37-#42).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body - Structured in Exact Sequential Order 1 to 42 */}
        <form id="asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* SECTION 1: Columns 1 to 5 - Identification & Master Affiliation */}
          <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stage 1: Identification & Classification (Columns #1 to #5)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Cols 1-5
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {/* Col 1: Asset ID */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#01</span> Asset ID
                </label>
                <input
                  type="text"
                  disabled
                  value={assetToEdit?.id || 'AST-AUTO-GENERATED'}
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* Col 2: Company */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#02</span> Company *
                </label>
                {companies.length > 0 ? (
                  <select
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      const c = companies.find((item) => item.id === e.target.value);
                      if (c) setCompanyName(c.name);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Col 3: Asset Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#03</span> Asset Type
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="LAPTOP">Laptop</option>
                  <option value="DESKTOP">Desktop</option>
                  <option value="WORKSTATION">Workstation</option>
                  <option value="SERVER">Server</option>
                  <option value="MONITOR">Monitor</option>
                  <option value="PRINTER">Printer</option>
                  <option value="NETWORK_DEVICE">Network Device</option>
                  <option value="OTHER">Other Peripheral</option>
                </select>
              </div>

              {/* Col 4: Asset Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#04</span> Asset Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="AST-00101"
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 5: Condition */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#05</span> Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="Good">Good</option>
                  <option value="Working">Working</option>
                  <option value="Fair">Fair</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Scrap">Scrap</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Columns 6 to 10 - Personnel Allocation & Network */}
          <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stage 2: Personnel Allocation & Network (Columns #6 to #10)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Cols 6-10
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {/* Col 6: Assigned Employee Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#06</span> Assigned Employee Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={assignedEmployeeName}
                  onChange={(e) => setAssignedEmployeeName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 7: Asset User Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#07</span> Asset User Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. rsharma"
                  value={assetUserName}
                  onChange={(e) => setAssetUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              {/* Col 8: Department */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#08</span> Department
                </label>
                {departments.length > 0 ? (
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      const d = departments.find((item) => item.id === e.target.value);
                      if (d) setDepartmentName(d.name);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. IT, Finance"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Col 9: Location */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#09</span> Location
                </label>
                {locations.length > 0 ? (
                  <select
                    value={locationId}
                    onChange={(e) => {
                      setLocationId(e.target.value);
                      const l = locations.find((item) => item.id === e.target.value);
                      if (l) setLocationName(l.name);
                    }}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Select Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter location / office"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>

              {/* Col 10: IP Adresss */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-indigo-600 font-mono">#10</span> IP Adresss
                </label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Quick account linker helper */}
            {employees.length > 0 && (
              <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Quick Bind User:</span>
                <select
                  value={assignedUserId}
                  onChange={(e) => {
                    setAssignedUserId(e.target.value);
                    const emp = employees.find((u) => u.id === e.target.value);
                    if (emp) {
                      setAssignedEmployeeName(emp.displayName || emp.name || '');
                      setAssetUserName(emp.displayName || emp.name || '');
                    }
                  }}
                  className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">-- Unassigned (Stock Pool) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.displayName || emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* SECTION 3: Columns 11 to 16 - Hardware Identity & Age Classification */}
          <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stage 3: Hardware Identity & Age Classification (Columns #11 to #16)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Cols 11-16
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              {/* Col 11: Serial Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#11</span> Serial Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="PF2N9XYZ"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 12: Manufacturer */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#12</span> Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="Lenovo, Dell, HP"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 13: Model */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#13</span> Model
                </label>
                <input
                  type="text"
                  placeholder="ThinkPad T14 Gen 3"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 14: Processor */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#14</span> Processor
                </label>
                <input
                  type="text"
                  placeholder="Intel i7-12700H"
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 15: Purchase Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#15</span> Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 16: New (NH)/ Old (SH) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#16</span> New (NH)/ Old (SH)
                </label>
                <select
                  value={newOrOld}
                  onChange={(e) => setNewOrOld(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="New (NH)">New (NH)</option>
                  <option value="Old (SH)">Old (SH)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 4: Columns 17 to 26 - Hardware Specifications & Components */}
          <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stage 4: Hardware Components & Peripherals (Columns #17 to #26)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                Cols 17-26
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Col 17: Storage */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#17</span> Storage
                </label>
                <input
                  type="text"
                  placeholder="512 GB SSD"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 18: RAM */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#18</span> RAM
                </label>
                <input
                  type="text"
                  placeholder="16 GB"
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 19: WINDOWS VERSION */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#19</span> Windows Version
                </label>
                <input
                  type="text"
                  placeholder="Windows 11 Pro"
                  value={windowsVersion}
                  onChange={(e) => setWindowsVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 20: MSOFFICE */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#20</span> MS Office
                </label>
                <input
                  type="text"
                  placeholder="Office 2021"
                  value={msOffice}
                  onChange={(e) => setMsOffice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 21: ESCAN */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#21</span> EScan Antivirus
                </label>
                <input
                  type="text"
                  placeholder="Installed / License"
                  value={escan}
                  onChange={(e) => setEscan(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 22: Motherboard */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#22</span> Motherboard
                </label>
                <input
                  type="text"
                  placeholder="OEM System Board"
                  value={motherboard}
                  onChange={(e) => setMotherboard(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 23: Display */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#23</span> Display
                </label>
                <input
                  type="text"
                  placeholder="IPS FHD Antiglare"
                  value={display}
                  onChange={(e) => setDisplay(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 24: Display Size */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#24</span> Display Size
                </label>
                <input
                  type="text"
                  placeholder='14.0" / 24.0"'
                  value={displaySize}
                  onChange={(e) => setDisplaySize(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 25: Lan Card */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#25</span> LAN Card
                </label>
                <input
                  type="text"
                  placeholder="Gigabit Ethernet"
                  value={lanCard}
                  onChange={(e) => setLanCard(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 26: Ups/ Battery */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-blue-600 font-mono">#26</span> UPS / Battery
                </label>
                <input
                  type="text"
                  placeholder="57Wh 4-Cell"
                  value={upsBattery}
                  onChange={(e) => setUpsBattery(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Columns 27 to 36 - Lifecycle, Warranties & Live Analytics */}
          <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stage 5: Lifecycle, Warranties & Automated Analytics (Columns #27 to #36)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                Cols 27-36
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Col 27: Warranty Start */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-amber-600 font-mono">#27</span> Warranty Start
                </label>
                <input
                  type="date"
                  value={warrantyStart}
                  onChange={(e) => setWarrantyStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 28: Warranty End */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-amber-600 font-mono">#28</span> Warranty End
                </label>
                <input
                  type="date"
                  value={warrantyEnd}
                  onChange={(e) => setWarrantyEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 29: Last Service Date */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-amber-600 font-mono">#29</span> Last Service Date
                </label>
                <input
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 32: Expected Life (Yrs) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-amber-600 font-mono">#32</span> Expected Life (Yrs)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={expectedLifeYears}
                  onChange={(e) => setExpectedLifeYears(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            {/* Col 30: Remarks */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                <span className="text-amber-600 font-mono">#30</span> Remarks
              </label>
              <input
                type="text"
                placeholder="Operational remarks, RAM upgrade history, display condition..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            {/* Live Calculated Analytics Ribbon (Cols 31, 33, 34, 35, 36) */}
            <div className="p-3 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider block">
                ⚡ Automated Live Calculations (Updates dynamically from purchase date & cost)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    <span className="font-mono text-amber-600">#31</span> Asset Age (Yrs)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {liveCalcs.assetAgeYears !== null ? `${liveCalcs.assetAgeYears} yrs` : 'N/A'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    <span className="font-mono text-amber-600">#33</span> Replacement Date
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {liveCalcs.expectedReplacementDate || 'N/A'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    <span className="font-mono text-amber-600">#34</span> Depreciated Value
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {liveCalcs.depreciatedValueINR !== null ? `₹${liveCalcs.depreciatedValueINR.toLocaleString()}` : 'N/A'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    <span className="font-mono text-amber-600">#35</span> Replacement Alert
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    {liveCalcs.replacementAlert || 'NORMAL'}
                  </span>
                </div>
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    <span className="font-mono text-amber-600">#36</span> Warranty Alert
                  </span>
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    {liveCalcs.warrantyAlert || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Columns 37 to 42 - Procurement, AMC & Parsed Dates */}
          <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Stage 6: Procurement, AMC & Parsed Dates (Columns #37 to #42)
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                Cols 37-42
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              {/* Col 37: Vendor */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-emerald-600 font-mono">#37</span> Vendor
                </label>
                <input
                  type="text"
                  placeholder="e.g. CompTech Corp"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 38: Purchase Cost (INR) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-emerald-600 font-mono">#38</span> Cost (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="65000"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              {/* Col 39: Invoice Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-emerald-600 font-mono">#39</span> Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="INV-2023-991"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 40: AMC Start */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-emerald-600 font-mono">#40</span> AMC Start
                </label>
                <input
                  type="date"
                  value={amcStart}
                  onChange={(e) => setAmcStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 41: AMC End */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-emerald-600 font-mono">#41</span> AMC End
                </label>
                <input
                  type="date"
                  value={amcEnd}
                  onChange={(e) => setAmcEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* Col 42: Purchase Date (Parsed) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  <span className="text-emerald-600 font-mono">#42</span> Parsed Date
                </label>
                <input
                  type="text"
                  disabled
                  value={liveCalcs.purchaseDateParsed || 'Awaiting Valid Date'}
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Internal Notes & Dynamic Custom Fields */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              Internal Administration Notes
            </span>
            <textarea
              rows={2}
              placeholder="e.g. Asset scheduled for quarterly audit or technician inspection."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Organization Dynamic Custom Fields
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customFields.map((cf) => {
                  const currVal = customFieldValues[cf.fieldKey] ?? '';

                  return (
                    <div key={cf.id}>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {cf.label} {cf.isRequired && '*'}
                      </label>
                      {cf.fieldType === 'SELECT' ? (
                        <select
                          value={currVal}
                          onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                        >
                          <option value="">-- Select {cf.label} --</option>
                          {(cf.options || []).map((opt, i) => (
                            <option key={i} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : cf.fieldType === 'BOOLEAN' ? (
                        <select
                          value={currVal === true ? 'true' : currVal === false ? 'false' : ''}
                          onChange={(e) =>
                            handleCustomFieldChange(
                              cf.fieldKey,
                              e.target.value === 'true' ? true : e.target.value === 'false' ? false : ''
                            )
                          }
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                        >
                          <option value="">-- Select --</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : cf.fieldType === 'NUMBER' ? (
                        <input
                          type="number"
                          value={currVal}
                          onChange={(e) => handleCustomFieldChange(cf.fieldKey, Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      ) : cf.fieldType === 'DATE' ? (
                        <input
                          type="date"
                          value={currVal}
                          onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={currVal}
                          placeholder={cf.description || ''}
                          onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs font-semibold"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="asset-form"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-xs"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Asset' : 'Register Computer Asset'}
          </Button>
        </div>
      </div>
    </div>
  );
};
