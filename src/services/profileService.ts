import { parseResponseJson } from '../lib/apiClient';
import { getStoredToken } from './authService';
import { UserProfile, UserProfileChangeRequest } from '../types';
import { StoredAsset } from './assetService';

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface ProfileResponse {
  profile?: UserProfile;
  assignedAssets?: StoredAsset[];
  changeRequests?: UserProfileChangeRequest[];
  error?: string;
}

/**
 * Fetch authenticated employee's profile, assigned hardware assets, and change request history.
 */
export async function fetchUserProfile(): Promise<ProfileResponse> {
  try {
    const res = await fetch('/api/user/profile', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { error: data.error || 'Failed to fetch user profile' };
    }
    return {
      profile: data.profile,
      assignedAssets: data.assignedAssets || [],
      changeRequests: data.changeRequests || [],
    };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching profile' };
  }
}

/**
 * Directly update employee mobile number (no IT Admin approval required).
 */
export async function updateMobileNumber(mobileNumber: string): Promise<{
  success: boolean;
  mobileNumber?: string;
  profile?: UserProfile;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/user/profile/mobile', {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ mobileNumber }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update mobile number' };
    }
    return {
      success: true,
      mobileNumber: data.mobileNumber,
      profile: data.profile,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating mobile number' };
  }
}

export interface ProfileChangeRequestInput {
  employeeName?: string;
  username?: string;
  departmentId?: string;
  designation?: string;
  assetTag?: string;
  locationId?: string;
  reason: string;
}

/**
 * Submit official profile change request for IT Admin review and approval.
 */
export async function submitProfileChangeRequest(
  payload: ProfileChangeRequestInput
): Promise<{
  success: boolean;
  changeRequest?: UserProfileChangeRequest;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/user/profile/change-request', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to submit profile change request' };
    }
    return {
      success: true,
      changeRequest: data.changeRequest,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error submitting change request' };
  }
}

/**
 * Fetch profile change requests (employees see only their own, admins see all).
 */
export async function fetchProfileChangeRequests(): Promise<{
  changeRequests: UserProfileChangeRequest[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/user/profile/change-requests', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { changeRequests: [], error: data.error || 'Failed to fetch change requests' };
    }
    return { changeRequests: data.changeRequests || [] };
  } catch (err: any) {
    return { changeRequests: [], error: err.message || 'Network error fetching change requests' };
  }
}

/**
 * IT Admin / Super Admin review: APPROVE or REJECT change request.
 */
export async function reviewProfileChangeRequest(
  id: string,
  action: 'APPROVE' | 'REJECT',
  reviewNotes?: string
): Promise<{
  success: boolean;
  changeRequest?: UserProfileChangeRequest;
  error?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`/api/admin/profile-change-requests/${id}/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action, reviewNotes }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || `Failed to ${action.toLowerCase()} request` };
    }
    return {
      success: true,
      changeRequest: data.changeRequest,
      message: data.message,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error reviewing change request' };
  }
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to mark all as read' };
    }
    return { success: true, count: data.count };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error marking all as read' };
  }
}
