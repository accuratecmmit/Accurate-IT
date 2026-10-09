/**
 * Asset Calculation Utilities & Strict Excel Mapping
 * 
 * Enforces the canonical 42-column Excel format in the exact required order:
 * Asset ID | Company | Asset Type | Asset Number | Condition | Assigned Employee Name |
 * Asset User Name | Department | Location | IP Adresss | Serial Number | Manufacturer |
 * Model | Processor | Purchase Date | New (NH)/ Old (SH) | Storage | RAM | WINDOWS VERSION |
 * MSOFFICE | ESCAN | Motherboard | Display | Display Size | Lan Card | Ups/ Battery |
 * Warranty Start | Warranty End | Last Service Date | Remarks | Asset Age (Yrs) |
 * Expected Life (Yrs) | Expected Replacement Date | Depreciated Value (INR) |
 * Replacement Alert | Warranty Alert | Vendor | Purchase Cost (INR) | Invoice Number |
 * AMC Start | AMC End | Purchase Date (Parsed)
 */

export const INVENTORY_EXCEL_COLUMNS = [
  'Asset ID',
  'Company',
  'Asset Type',
  'Asset Number',
  'Condition',
  'Assigned Employee Name',
  'Asset User Name',
  'Department',
  'Location',
  'IP Adresss',
  'Serial Number',
  'Manufacturer',
  'Model',
  'Processor',
  'Purchase Date',
  'New (NH)/ Old (SH)',
  'Storage',
  'RAM',
  'WINDOWS VERSION',
  'MSOFFICE',
  'ESCAN',
  'Motherboard',
  'Display',
  'Display Size',
  'Lan Card',
  'Ups/ Battery',
  'Warranty Start',
  'Warranty End',
  'Last Service Date',
  'Remarks',
  'Asset Age (Yrs)',
  'Expected Life (Yrs)',
  'Expected Replacement Date',
  'Depreciated Value (INR)',
  'Replacement Alert',
  'Warranty Alert',
  'Vendor',
  'Purchase Cost (INR)',
  'Invoice Number',
  'AMC Start',
  'AMC End',
  'Purchase Date (Parsed)',
] as const;

export type InventoryExcelColumnName = (typeof INVENTORY_EXCEL_COLUMNS)[number];

export interface AssetCalculations {
  assetAgeYears: number | null;
  expectedReplacementDate: string | null;
  depreciatedValueINR: number | null;
  replacementAlert: string | null;
  warrantyAlert: string | null;
  purchaseDateParsed: string | null;
}

/**
 * Safely parses any date representation into ISO YYYY-MM-DD.
 * Handles Excel serial numbers, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, and text dates.
 * Rejects invalid strings, NaN, and formula error strings like '#VALUE!'.
 * Never invents values.
 */
export function parseDateSafely(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined' || str.toLowerCase() === 'n/a') {
    return null;
  }

  // Detect formula errors
  if (str.startsWith('#') || str.includes('#VALUE!') || str.includes('#REF!') || str.includes('#N/A')) {
    return null;
  }

  // Handle Excel serial date numbers (e.g., 44561 -> 2022-01-01)
  if (typeof val === 'number' || (/^\d+(\.\d+)?$/.test(str) && Number(str) > 20000 && Number(str) < 70000)) {
    const num = Number(str);
    // Excel epoch starts 1899-12-30 (accounting for 1900 leap year bug)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = num * 86400 * 1000;
    const date = new Date(excelEpoch.getTime() + ms);
    if (!isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  // If already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str + 'T00:00:00Z');
    if (!isNaN(d.getTime())) return str;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }

  // Handle MM/DD/YYYY if Month > 12 was ruled out, or standard Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    // Sanity check year range (1980 - 2100)
    const year = parsed.getUTCFullYear();
    if (year >= 1980 && year <= 2100) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

/**
 * Calculates the current age of an asset in years rounded to 1 decimal place.
 */
export function calculateAssetAgeYears(purchaseDateParsed: string | null): number | null {
  if (!purchaseDateParsed) return null;
  const pDate = new Date(purchaseDateParsed + 'T00:00:00Z');
  if (isNaN(pDate.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - pDate.getTime();
  if (diffMs < 0) return 0;

  const years = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(years * 10) / 10);
}

/**
 * Calculates Expected Replacement Date based on Purchase Date + Expected Life (Years).
 */
export function calculateExpectedReplacementDate(
  purchaseDateParsed: string | null,
  expectedLifeYears: number | null
): string | null {
  if (!purchaseDateParsed || expectedLifeYears === null || expectedLifeYears === undefined || expectedLifeYears <= 0) {
    return null;
  }
  const pDate = new Date(purchaseDateParsed + 'T00:00:00Z');
  if (isNaN(pDate.getTime())) return null;

  const rDate = new Date(pDate);
  const wholeYears = Math.floor(expectedLifeYears);
  const fractionalMonths = Math.round((expectedLifeYears - wholeYears) * 12);

  rDate.setUTCFullYear(rDate.getUTCFullYear() + wholeYears);
  rDate.setUTCMonth(rDate.getUTCMonth() + fractionalMonths);

  return rDate.toISOString().slice(0, 10);
}

/**
 * Calculates Depreciated Value (INR) using straight-line depreciation down to 0.
 * Depreciated Value = Purchase Cost - (Annual Depreciation * Age in Years)
 */
export function calculateDepreciatedValue(
  purchaseCost: number | null | undefined,
  assetAgeYears: number | null | undefined,
  expectedLifeYears: number | null | undefined
): number | null {
  if (
    purchaseCost === null ||
    purchaseCost === undefined ||
    isNaN(purchaseCost) ||
    purchaseCost < 0 ||
    assetAgeYears === null ||
    assetAgeYears === undefined ||
    isNaN(assetAgeYears) ||
    !expectedLifeYears ||
    expectedLifeYears <= 0
  ) {
    return null;
  }

  const annualDepreciation = purchaseCost / expectedLifeYears;
  const currentVal = Math.max(0, Math.round(purchaseCost - annualDepreciation * assetAgeYears));
  return currentVal;
}

/**
 * Calculates Replacement Alert status:
 * - 'OVERDUE' if today is past the expected replacement date or age >= expected life
 * - 'REPLACEMENT DUE SOON' if replacement date is within 60 days
 * - 'NORMAL' if healthy
 * - null if insufficient data
 */
export function calculateReplacementAlert(
  expectedReplacementDate: string | null,
  assetAgeYears: number | null,
  expectedLifeYears: number | null
): string | null {
  if (expectedReplacementDate) {
    const replDate = new Date(expectedReplacementDate + 'T00:00:00Z');
    if (!isNaN(replDate.getTime())) {
      const now = new Date();
      const diffMs = replDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      if (diffDays < 0) return 'OVERDUE';
      if (diffDays <= 60) return 'REPLACEMENT DUE SOON';
      return 'NORMAL';
    }
  }

  if (assetAgeYears !== null && expectedLifeYears !== null && expectedLifeYears > 0) {
    if (assetAgeYears >= expectedLifeYears) return 'OVERDUE';
    if (expectedLifeYears - assetAgeYears <= 0.25) return 'REPLACEMENT DUE SOON';
    return 'NORMAL';
  }

  return null;
}

/**
 * Calculates Warranty Alert status:
 * - 'EXPIRED' if warranty end date is past
 * - 'EXPIRING SOON' if warranty end date is within 30 days
 * - 'UNDER WARRANTY' if active
 * - null if warranty end is missing
 */
export function calculateWarrantyAlert(warrantyEndVal: any): string | null {
  const parsedEnd = parseDateSafely(warrantyEndVal);
  if (!parsedEnd) return null;

  const endDate = new Date(parsedEnd + 'T23:59:59Z');
  if (isNaN(endDate.getTime())) return null;

  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 30) return 'EXPIRING SOON';
  return 'UNDER WARRANTY';
}

/**
 * Computes all 5 calculated fields + parsed purchase date safely for any asset.
 * Never invents values.
 */
export function computeAssetCalculations(input: {
  purchaseDate?: any;
  purchaseDateParsed?: any;
  purchaseCost?: any;
  expectedLifeYears?: any;
  warrantyEnd?: any;
  warrantyExpiryDate?: any;
}): AssetCalculations {
  const purchaseDateParsed =
    parseDateSafely(input.purchaseDateParsed) || parseDateSafely(input.purchaseDate);

  const assetAgeYears = calculateAssetAgeYears(purchaseDateParsed);

  // Parse expectedLifeYears (defaults to 4 if specified or numeric)
  let expectedLife: number | null = null;
  if (input.expectedLifeYears !== undefined && input.expectedLifeYears !== null && input.expectedLifeYears !== '') {
    const parsedLife = Number(input.expectedLifeYears);
    if (!isNaN(parsedLife) && parsedLife > 0) {
      expectedLife = parsedLife;
    }
  } else if (purchaseDateParsed) {
    // Standard hardware life is 4 years if not overridden
    expectedLife = 4;
  }

  const expectedReplacementDate = calculateExpectedReplacementDate(purchaseDateParsed, expectedLife);

  // Parse purchase cost
  let costNum: number | null = null;
  if (input.purchaseCost !== undefined && input.purchaseCost !== null && input.purchaseCost !== '') {
    const rawCost = String(input.purchaseCost).replace(/[^0-9.-]+/g, '');
    const parsedCost = Number(rawCost);
    if (!isNaN(parsedCost) && parsedCost >= 0) {
      costNum = parsedCost;
    }
  }

  const depreciatedValueINR = calculateDepreciatedValue(costNum, assetAgeYears, expectedLife);

  const replacementAlert = calculateReplacementAlert(expectedReplacementDate, assetAgeYears, expectedLife);

  const warrantyEndValue = input.warrantyEnd || input.warrantyExpiryDate;
  const warrantyAlert = calculateWarrantyAlert(warrantyEndValue);

  return {
    assetAgeYears,
    expectedReplacementDate,
    depreciatedValueINR,
    replacementAlert,
    warrantyAlert,
    purchaseDateParsed,
  };
}

export interface CanonicalColumnMeta {
  index: number;
  name: InventoryExcelColumnName;
  label: string;
  category: 'IDENTIFIERS_PERSONNEL' | 'HARDWARE_SPECS' | 'LIFECYCLE_CALCS' | 'PROCUREMENT_DATES';
  categoryLabel: string;
  format: 'text' | 'date' | 'currency' | 'badge' | 'mono' | 'number';
  getValue: (asset: any) => any;
}

export const CANONICAL_ASSET_COLUMNS: CanonicalColumnMeta[] = [
  {
    index: 1,
    name: 'Asset ID',
    label: 'Asset ID',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'mono',
    getValue: (a) => a.id || '',
  },
  {
    index: 2,
    name: 'Company',
    label: 'Company',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'text',
    getValue: (a) => a.company || a.companyName || '',
  },
  {
    index: 3,
    name: 'Asset Type',
    label: 'Asset Type',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'badge',
    getValue: (a) => a.assetType || 'LAPTOP',
  },
  {
    index: 4,
    name: 'Asset Number',
    label: 'Asset Number',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'mono',
    getValue: (a) => a.assetNumber || a.assetTag || '',
  },
  {
    index: 5,
    name: 'Condition',
    label: 'Condition',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'badge',
    getValue: (a) => a.condition || 'Good',
  },
  {
    index: 6,
    name: 'Assigned Employee Name',
    label: 'Assigned Employee Name',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'text',
    getValue: (a) => a.assignedEmployeeName || a.assignedUserName || '',
  },
  {
    index: 7,
    name: 'Asset User Name',
    label: 'Asset User Name',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'text',
    getValue: (a) => a.assetUserName || a.assignedUserName || '',
  },
  {
    index: 8,
    name: 'Department',
    label: 'Department',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'text',
    getValue: (a) => a.department || a.departmentName || '',
  },
  {
    index: 9,
    name: 'Location',
    label: 'Location',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'text',
    getValue: (a) => a.location || a.locationName || '',
  },
  {
    index: 10,
    name: 'IP Adresss',
    label: 'IP Adresss',
    category: 'IDENTIFIERS_PERSONNEL',
    categoryLabel: '1-10: Identifiers & Personnel',
    format: 'mono',
    getValue: (a) => a.ipAddress || (a as any)['IP Adresss'] || a.specifications?.ipAddress || '',
  },
  {
    index: 11,
    name: 'Serial Number',
    label: 'Serial Number',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'mono',
    getValue: (a) => a.serialNumber || '',
  },
  {
    index: 12,
    name: 'Manufacturer',
    label: 'Manufacturer',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.manufacturer || '',
  },
  {
    index: 13,
    name: 'Model',
    label: 'Model',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.model || '',
  },
  {
    index: 14,
    name: 'Processor',
    label: 'Processor',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.processor || a.specifications?.cpu || a.specifications?.processor || '',
  },
  {
    index: 15,
    name: 'Purchase Date',
    label: 'Purchase Date',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'date',
    getValue: (a) => a.purchaseDate || '',
  },
  {
    index: 16,
    name: 'New (NH)/ Old (SH)',
    label: 'New (NH)/ Old (SH)',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'badge',
    getValue: (a) => a.newOrOld || (a.condition?.includes('Old') || a.condition?.includes('SH') ? 'Old (SH)' : 'New (NH)'),
  },
  {
    index: 17,
    name: 'Storage',
    label: 'Storage',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.storage || (a.specifications?.storageGb ? `${a.specifications.storageGb} GB` : ''),
  },
  {
    index: 18,
    name: 'RAM',
    label: 'RAM',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.ram || (a.specifications?.ramGb ? `${a.specifications.ramGb} GB` : ''),
  },
  {
    index: 19,
    name: 'WINDOWS VERSION',
    label: 'Windows Version',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.windowsVersion || a.specifications?.os || '',
  },
  {
    index: 20,
    name: 'MSOFFICE',
    label: 'MS Office',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.msOffice || '',
  },
  {
    index: 21,
    name: 'ESCAN',
    label: 'EScan Antivirus',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.escan || '',
  },
  {
    index: 22,
    name: 'Motherboard',
    label: 'Motherboard',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.motherboard || '',
  },
  {
    index: 23,
    name: 'Display',
    label: 'Display',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.display || '',
  },
  {
    index: 24,
    name: 'Display Size',
    label: 'Display Size',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.displaySize || (a.specifications?.screenSizeInches ? `${a.specifications.screenSizeInches}"` : ''),
  },
  {
    index: 25,
    name: 'Lan Card',
    label: 'Lan Card',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.lanCard || '',
  },
  {
    index: 26,
    name: 'Ups/ Battery',
    label: 'Ups/ Battery',
    category: 'HARDWARE_SPECS',
    categoryLabel: '11-26: Hardware Specs & Components',
    format: 'text',
    getValue: (a) => a.upsBattery || '',
  },
  {
    index: 27,
    name: 'Warranty Start',
    label: 'Warranty Start',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'date',
    getValue: (a) => a.warrantyStart || '',
  },
  {
    index: 28,
    name: 'Warranty End',
    label: 'Warranty End',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'date',
    getValue: (a) => a.warrantyEnd || a.warrantyExpiryDate || '',
  },
  {
    index: 29,
    name: 'Last Service Date',
    label: 'Last Service Date',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'date',
    getValue: (a) => a.lastServiceDate || '',
  },
  {
    index: 30,
    name: 'Remarks',
    label: 'Remarks',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'text',
    getValue: (a) => a.remarks || a.notes || '',
  },
  {
    index: 31,
    name: 'Asset Age (Yrs)',
    label: 'Asset Age (Yrs)',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'number',
    getValue: (a) => (a.assetAgeYears !== undefined && a.assetAgeYears !== null ? `${a.assetAgeYears} yrs` : ''),
  },
  {
    index: 32,
    name: 'Expected Life (Yrs)',
    label: 'Expected Life (Yrs)',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'number',
    getValue: (a) => (a.expectedLifeYears !== undefined && a.expectedLifeYears !== null ? `${a.expectedLifeYears} yrs` : '4 yrs'),
  },
  {
    index: 33,
    name: 'Expected Replacement Date',
    label: 'Expected Replacement Date',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'date',
    getValue: (a) => a.expectedReplacementDate || '',
  },
  {
    index: 34,
    name: 'Depreciated Value (INR)',
    label: 'Depreciated Value (INR)',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'currency',
    getValue: (a) => (a.depreciatedValueINR !== undefined && a.depreciatedValueINR !== null ? a.depreciatedValueINR : (a.depreciatedValue !== undefined ? a.depreciatedValue : '')),
  },
  {
    index: 35,
    name: 'Replacement Alert',
    label: 'Replacement Alert',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'badge',
    getValue: (a) => a.replacementAlert || '',
  },
  {
    index: 36,
    name: 'Warranty Alert',
    label: 'Warranty Alert',
    category: 'LIFECYCLE_CALCS',
    categoryLabel: '27-36: Lifecycle, Warranties & Analytics',
    format: 'badge',
    getValue: (a) => a.warrantyAlert || '',
  },
  {
    index: 37,
    name: 'Vendor',
    label: 'Vendor',
    category: 'PROCUREMENT_DATES',
    categoryLabel: '37-42: Procurement, AMC & Parsed Dates',
    format: 'text',
    getValue: (a) => a.vendor || '',
  },
  {
    index: 38,
    name: 'Purchase Cost (INR)',
    label: 'Purchase Cost (INR)',
    category: 'PROCUREMENT_DATES',
    categoryLabel: '37-42: Procurement, AMC & Parsed Dates',
    format: 'currency',
    getValue: (a) => (a.purchaseCost !== undefined && a.purchaseCost !== null ? a.purchaseCost : ''),
  },
  {
    index: 39,
    name: 'Invoice Number',
    label: 'Invoice Number',
    category: 'PROCUREMENT_DATES',
    categoryLabel: '37-42: Procurement, AMC & Parsed Dates',
    format: 'mono',
    getValue: (a) => a.invoiceNumber || '',
  },
  {
    index: 40,
    name: 'AMC Start',
    label: 'AMC Start',
    category: 'PROCUREMENT_DATES',
    categoryLabel: '37-42: Procurement, AMC & Parsed Dates',
    format: 'date',
    getValue: (a) => a.amcStart || '',
  },
  {
    index: 41,
    name: 'AMC End',
    label: 'AMC End',
    category: 'PROCUREMENT_DATES',
    categoryLabel: '37-42: Procurement, AMC & Parsed Dates',
    format: 'date',
    getValue: (a) => a.amcEnd || '',
  },
  {
    index: 42,
    name: 'Purchase Date (Parsed)',
    label: 'Purchase Date (Parsed)',
    category: 'PROCUREMENT_DATES',
    categoryLabel: '37-42: Procurement, AMC & Parsed Dates',
    format: 'date',
    getValue: (a) => a.purchaseDateParsed || '',
  },
];

export function getAssetCanonicalValue(asset: any, columnName: InventoryExcelColumnName): any {
  const col = CANONICAL_ASSET_COLUMNS.find((c) => c.name === columnName);
  return col ? col.getValue(asset) : '';
}

