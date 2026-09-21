import { getStoredToken } from './authService';
import { parseResponseJson } from '../lib/apiClient';
import { Asset, AssetAssignmentRecord, AssetCustomField } from '../types';

export type { Asset, AssetAssignmentRecord, AssetCustomField };
export type StoredAsset = Asset;

function getAuthHeaders(isJson = true): Record<string, string> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchAssets(filters?: {
  status?: string;
  search?: string;
  locationId?: string;
  includeRetired?: boolean;
}): Promise<{ assets: Asset[]; totalCount?: number; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.locationId) params.append('locationId', filters.locationId);
    if (filters?.includeRetired) params.append('includeRetired', 'true');

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/assets${query}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { assets: [], error: data.error || 'Failed to fetch assets' };
    }
    return { assets: data.assets || [], totalCount: data.totalCount };
  } catch (err: any) {
    return { assets: [], error: err.message || 'Network error fetching assets' };
  }
}

export async function fetchAssetById(id: string): Promise<{ asset?: Asset; error?: string }> {
  try {
    const res = await fetch(`/api/assets/${id}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { error: data.error || 'Failed to fetch asset' };
    }
    return { asset: data.asset };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching asset' };
  }
}

export async function createAsset(payload: Partial<Asset>): Promise<{ success: boolean; asset?: Asset; error?: string }> {
  try {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to create asset' };
    }
    return { success: true, asset: data.asset };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating asset' };
  }
}

export async function updateAsset(
  id: string,
  payload: Partial<Asset> & { transferNotes?: string }
): Promise<{ success: boolean; asset?: Asset; error?: string }> {
  try {
    const res = await fetch(`/api/assets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update asset' };
    }
    return { success: true, asset: data.asset };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating asset' };
  }
}

export async function deleteOrRetireAsset(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`/api/assets/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to retire asset' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error retiring asset' };
  }
}

// Custom Fields
export async function fetchCustomFields(): Promise<{ customFields: AssetCustomField[]; error?: string }> {
  try {
    const res = await fetch('/api/asset-custom-fields', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { customFields: [], error: data.error || 'Failed to fetch custom fields' };
    }
    return { customFields: data.customFields || [] };
  } catch (err: any) {
    return { customFields: [], error: err.message || 'Network error fetching custom fields' };
  }
}

export async function createCustomField(field: {
  label: string;
  fieldKey: string;
  fieldType: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT';
  options?: string[];
  isRequired?: boolean;
  description?: string;
}): Promise<{ success: boolean; customField?: AssetCustomField; error?: string }> {
  try {
    const res = await fetch('/api/asset-custom-fields', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(field),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to create custom field' };
    }
    return { success: true, customField: data.customField };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating custom field' };
  }
}

export async function updateCustomField(
  id: string,
  field: Partial<AssetCustomField>
): Promise<{ success: boolean; customField?: AssetCustomField; error?: string }> {
  try {
    const res = await fetch(`/api/asset-custom-fields/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(field),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update custom field' };
    }
    return { success: true, customField: data.customField };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating custom field' };
  }
}

// Excel Validation and Import
export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  duplicateCount: number;
  errorCount: number;
  results: Array<{
    rowNumber: number;
    data: Record<string, any>;
    errors: Array<{ column: string; value: any; message: string }>;
    isDuplicateInSheet: boolean;
    isDuplicateInDB: boolean;
    existingAssetId?: string;
  }>;
}

export interface ImportSummaryResult {
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ row: number; errors: Array<{ column: string; value: any; message: string }> }>;
}

export async function validateExcelRows(rows: any[]): Promise<{ success: boolean; summary?: ValidationSummary; error?: string }> {
  try {
    const res = await fetch('/api/assets/validate-excel', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rows }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to validate Excel rows' };
    }
    return { success: true, summary: data.summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error validating Excel rows' };
  }
}

export async function importExcelRows(
  rows: any[],
  overwriteExisting = false
): Promise<{ success: boolean; summary?: ImportSummaryResult; error?: string }> {
  try {
    const res = await fetch('/api/assets/import-excel', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rows, overwriteExisting }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to import Excel rows' };
    }
    return { success: true, summary: data.summary };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error importing Excel rows' };
  }
}

export async function importInitialWorkbook(): Promise<{
  success: boolean;
  message?: string;
  importedCount?: number;
  updatedCount?: number;
  totalAssets?: number;
  error?: string;
}> {
  try {
    const res = await fetch('/api/assets/import-initial-workbook', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to import initial workbook' };
    }
    return {
      success: true,
      message: data.message,
      importedCount: data.importedCount,
      updatedCount: data.updatedCount,
      totalAssets: data.totalAssets,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error importing initial workbook' };
  }
}

export async function downloadInventoryExcel(): Promise<void> {
  const token = getStoredToken();
  const res = await fetch('/api/assets/export-excel', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Failed to export inventory spreadsheet');
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `IT_Asset_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function fetchMyAssignedAsset(): Promise<{ asset?: Asset | null; error?: string }> {
  try {
    const res = await fetch('/api/assets/my-assigned', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { error: data.error || 'Failed to fetch assigned equipment' };
    }
    return { asset: data.asset || null };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching assigned equipment' };
  }
}

export async function fetchTicketSelectableAssets(): Promise<{
  myAsset?: Asset | null;
  otherAssets: Asset[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/assets/ticket-options', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { myAsset: null, otherAssets: [], error: data.error || 'Failed to fetch ticket equipment options' };
    }
    return {
      myAsset: data.myAsset || null,
      otherAssets: data.otherAssets || [],
    };
  } catch (err: any) {
    return { myAsset: null, otherAssets: [], error: err.message || 'Network error fetching ticket equipment options' };
  }
}

export async function fetchAssetTickets(assetId: string): Promise<{ tickets: any[]; totalCount: number; error?: string }> {
  try {
    const res = await fetch(`/api/assets/${assetId}/tickets`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { tickets: [], totalCount: 0, error: data.error || 'Failed to fetch tickets for asset' };
    }
    return { tickets: data.tickets || [], totalCount: data.totalCount || 0 };
  } catch (err: any) {
    return { tickets: [], totalCount: 0, error: err.message || 'Network error' };
  }
}
