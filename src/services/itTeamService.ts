import { parseResponseJson } from '../lib/apiClient';
import { getStoredToken } from './authService';

export interface ITTeam {
  id: string;
  code: string;
  name: string;
  description: string;
  leadAdminId?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchITTeams(): Promise<{ teams: ITTeam[]; error?: string }> {
  try {
    const res = await fetch('/api/it-teams', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { teams: [], error: data.error || 'Failed to fetch IT teams' };
    }
    return { teams: data.teams || [] };
  } catch (err: any) {
    return { teams: [], error: err.message || 'Network error fetching IT teams' };
  }
}

export async function createITTeam(payload: {
  code: string;
  name: string;
  description?: string;
  leadAdminId?: string;
}): Promise<{ success: boolean; team?: ITTeam; error?: string }> {
  try {
    const res = await fetch('/api/it-teams', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to create IT Team' };
    }
    return { success: true, team: data.team };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating IT Team' };
  }
}

export async function assignUserToTeam(
  userId: string,
  itTeamId: string | null
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch('/api/admin/assign-team', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, itTeamId }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to assign user to IT team' };
    }
    return { success: true, message: data.message };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error assigning user to IT team' };
  }
}
