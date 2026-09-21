import React, { useState, useEffect } from 'react';
import { Asset, AssetCustomField } from '../../types';
import { createAsset, updateAsset } from '../../services/assetService';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Laptop, Cpu, User, MapPin, Building, AlertTriangle, CheckCircle2, Shield, Calendar, Wrench, DollarSign } from 'lucide-react';

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

    const payload: Partial<Asset> = {
      assetTag: assetTag.trim().toUpperCase(),
      serialNumber: serialNumber.trim().toUpperCase(),
      name: name.trim() || `${manufacturer} ${model}`.trim() || assetTag.trim(),
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
      expectedLifeYears: Number(expectedLifeYears) || 5,

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
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {isEditing ? `Edit Hardware Asset: ${assetToEdit?.assetTag}` : 'Register New Hardware Inventory Asset'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete hardware specifications, master affiliations, single-employee assignment, and financial tracking.
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

        {/* Form Body */}
        <form id="asset-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Section 1: Identification & Profile */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                1. Identification & Classification
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Tag / ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="AST-00101"
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="PF2N9XYZ"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono uppercase focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Type
                </label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
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

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold"
                >
                  <option value="Active">Active (In Service)</option>
                  <option value="Inactive">Inactive (In Stock Pool)</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Retired">Retired</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Condition
                </label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="Good">Good</option>
                  <option value="Working">Working</option>
                  <option value="Fair">Fair</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Scrap">Scrap</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New (NH) / Old (SH)
                </label>
                <select
                  value={newOrOld}
                  onChange={(e) => setNewOrOld(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="New (NH)">New (NH)</option>
                  <option value="Old (SH)">Old (SH)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Name / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. ThinkPad T14 Gen 3"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location, Company & Department */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                2. Company, Location & Department
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Company
                </label>
                {companies.length > 0 ? (
                  <select
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      const c = companies.find((item) => item.id === e.target.value);
                      if (c) setCompanyName(c.name);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Location
                </label>
                {locations.length > 0 ? (
                  <select
                    value={locationId}
                    onChange={(e) => {
                      setLocationId(e.target.value);
                      const l = locations.find((item) => item.id === e.target.value);
                      if (l) setLocationName(l.name);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department
                </label>
                {departments.length > 0 ? (
                  <select
                    value={departmentId}
                    onChange={(e) => {
                      setDepartmentId(e.target.value);
                      const d = departments.find((item) => item.id === e.target.value);
                      if (d) setDepartmentName(d.name);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                    placeholder="e.g. IT, Finance, Operations"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Personnel & Employee Assignment */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                3. Single-Employee Assignment Tracking
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assign to User Account
                </label>
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
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="">-- Unassigned (Stock Pool) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.displayName || emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Employee Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={assignedEmployeeName}
                  onChange={(e) => setAssignedEmployeeName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Asset User Name (Sign-in / Label)
                </label>
                <input
                  type="text"
                  placeholder="e.g. jdoe"
                  value={assetUserName}
                  onChange={(e) => setAssetUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Detailed Hardware Specs & Components */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                4. Hardware Specifications & Components
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  placeholder="Lenovo, Dell, HP, Apple"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Model
                </label>
                <input
                  type="text"
                  placeholder="ThinkPad T14s"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Processor
                </label>
                <input
                  type="text"
                  placeholder="Intel i7-1270P / Ryzen 7"
                  value={processor}
                  onChange={(e) => setProcessor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  IP Adresss
                </label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  RAM
                </label>
                <input
                  type="text"
                  placeholder="16 GB"
                  value={ram}
                  onChange={(e) => setRam(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Storage
                </label>
                <input
                  type="text"
                  placeholder="512 GB SSD"
                  value={storage}
                  onChange={(e) => setStorage(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Windows Version
                </label>
                <input
                  type="text"
                  placeholder="Windows 11 Pro 64-bit"
                  value={windowsVersion}
                  onChange={(e) => setWindowsVersion(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  MS Office
                </label>
                <input
                  type="text"
                  placeholder="Office 2021 / M365"
                  value={msOffice}
                  onChange={(e) => setMsOffice(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  EScan Antivirus
                </label>
                <input
                  type="text"
                  placeholder="Installed / License #"
                  value={escan}
                  onChange={(e) => setEscan(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Motherboard
                </label>
                <input
                  type="text"
                  placeholder="OEM System Board"
                  value={motherboard}
                  onChange={(e) => setMotherboard(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Display / Panel
                </label>
                <input
                  type="text"
                  placeholder="IPS FHD Antiglare"
                  value={display}
                  onChange={(e) => setDisplay(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Display Size
                </label>
                <input
                  type="text"
                  placeholder='14" / 24"'
                  value={displaySize}
                  onChange={(e) => setDisplaySize(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  LAN Card
                </label>
                <input
                  type="text"
                  placeholder="Gigabit Ethernet"
                  value={lanCard}
                  onChange={(e) => setLanCard(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  UPS / Battery
                </label>
                <input
                  type="text"
                  placeholder="57Wh 4-Cell / APC 600VA"
                  value={upsBattery}
                  onChange={(e) => setUpsBattery(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Financial & Procurement */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                5. Financial, Procurement & Valuation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Purchase Cost (INR)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="65000"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vendor
                </label>
                <input
                  type="text"
                  placeholder="e.g. CompTech Solutions"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="INV-2023-8891"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Warranty, AMC & Maintenance */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                6. Warranty, AMC & Service Lifecycle
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Warranty Start
                </label>
                <input
                  type="date"
                  value={warrantyStart}
                  onChange={(e) => setWarrantyStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Warranty End
                </label>
                <input
                  type="date"
                  value={warrantyEnd}
                  onChange={(e) => setWarrantyEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  AMC Start
                </label>
                <input
                  type="date"
                  value={amcStart}
                  onChange={(e) => setAmcStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  AMC End
                </label>
                <input
                  type="date"
                  value={amcEnd}
                  onChange={(e) => setAmcEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Last Service Date
                </label>
                <input
                  type="date"
                  value={lastServiceDate}
                  onChange={(e) => setLastServiceDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Expected Life (Years)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={expectedLifeYears}
                  onChange={(e) => setExpectedLifeYears(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 7: Remarks & Notes */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              7. Remarks & Administrative Notes
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Replaced SSD in March 2024, working without issues."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Internal Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Asset scheduled for department audit in Q3."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 8: Custom Fields */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                8. Organization Custom Fields
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
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
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
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
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
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      ) : cf.fieldType === 'DATE' ? (
                        <input
                          type="date"
                          value={currVal}
                          onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={currVal}
                          placeholder={cf.description || ''}
                          onChange={(e) => handleCustomFieldChange(cf.fieldKey, e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
