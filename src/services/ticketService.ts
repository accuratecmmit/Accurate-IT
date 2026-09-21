import { getStoredToken } from './authService';
import { parseResponseJson } from '../lib/apiClient';

export interface StoredTicketAttachment {
  id: string;
  ticketId: string;
  originalFileName: string;
  storedFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
  isPreviewable: boolean;
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole: string;
  uploadedAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedById?: string | null;
  deletedByName?: string | null;
}

export interface StoredTicketHistory {
  id: string;
  ticketId: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  details: string;
  fromValue?: string | null;
  toValue?: string | null;
  timestamp: string;
}

export interface StoredTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';
  status:
    | 'NEW'
    | 'ASSIGNED'
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'WAITING_FOR_USER'
    | 'PENDING_VENDOR'
    | 'PENDING_USER'
    | 'RESOLVED'
    | 'CLOSED'
    | 'CANCELLED';
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompanyId?: string;
  requesterLocationId?: string;
  requesterDepartmentId?: string;
  locationId?: string;
  locationName?: string;
  contactNumber?: string;
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  relatedAssetId?: string | null;
  relatedAssetTag?: string | null;
  relatedAssetName?: string | null;
  assetOverrideReason?: string | null;
  historicalAssetAssignment?: {
    assignedUserId?: string | null;
    assignedUserName?: string | null;
    assignedAtSnapshot?: string | null;
  } | null;
  attachmentIds?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  isInternalOnly: boolean;
  content: string;
  createdAt: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchTickets(): Promise<{ tickets: StoredTicket[]; error?: string }> {
  try {
    const res = await fetch('/api/tickets', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { tickets: [], error: data.error || 'Failed to fetch tickets' };
    }
    return { tickets: data.tickets || [] };
  } catch (err: any) {
    return { tickets: [], error: err.message || 'Network error fetching tickets' };
  }
}

export async function fetchTicketById(id: string): Promise<{
  ticket?: StoredTicket;
  comments?: TicketComment[];
  attachments?: StoredTicketAttachment[];
  history?: StoredTicketHistory[];
  error?: string;
}> {
  try {
    const res = await fetch(`/api/tickets/${id}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { error: data.error || 'Failed to fetch ticket' };
    }
    return {
      ticket: data.ticket,
      comments: data.comments || [],
      attachments: data.attachments || [],
      history: data.history || [],
    };
  } catch (err: any) {
    return { error: err.message || 'Network error fetching ticket details' };
  }
}

export async function createTicket(payload: {
  title: string;
  description: string;
  category: string;
  priority?: string;
  contactNumber?: string;
  locationId?: string;
  locationName?: string;
  assignedTeamId?: string;
  assignedTechnicianId?: string;
  relatedAssetId?: string;
  relatedAssetTag?: string;
  assetOverrideReason?: string;
  attachment?: {
    originalFileName: string;
    mimeType: string;
    fileData: string; // base64
  };
}): Promise<{ success: boolean; ticket?: StoredTicket; error?: string; requiresOverrideReason?: boolean }> {
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Failed to create ticket',
        requiresOverrideReason: data.requiresOverrideReason,
      };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error creating ticket' };
  }
}

export async function updateTicketLinkedAsset(
  ticketId: string,
  relatedAssetId: string | null,
  notes?: string
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/linked-asset`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ relatedAssetId, notes }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update linked asset' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating linked asset' };
  }
}

export async function editTicket(
  id: string,
  payload: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    contactNumber?: string;
    locationId?: string;
    relatedAssetId?: string;
  }
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update ticket' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating ticket' };
  }
}

export async function cancelTicket(
  id: string,
  reason?: string
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to cancel ticket' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error cancelling ticket' };
  }
}

export async function takeTicket(
  id: string
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}/take`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to take ticket' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error taking ticket' };
  }
}

export async function updateTicketStatus(
  id: string,
  status: string
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update ticket status' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating ticket status' };
  }
}

export async function updateTicketPriority(
  id: string,
  priority: string
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}/priority`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ priority }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to update priority' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating ticket priority' };
  }
}

export async function assignTicket(
  id: string,
  technicianId: string | null,
  isCorrection?: boolean
): Promise<{ success: boolean; ticket?: StoredTicket; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ technicianId, isCorrection }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to assign ticket' };
    }
    return { success: true, ticket: data.ticket };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error assigning ticket' };
  }
}

export async function addTicketComment(
  id: string,
  content: string,
  isInternalOnly = false
): Promise<{ success: boolean; comment?: TicketComment; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${id}/comments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content, isInternalOnly }),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to post comment' };
    }
    return { success: true, comment: data.comment };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error posting comment' };
  }
}

export async function uploadTicketAttachment(
  ticketId: string,
  payload: {
    originalFileName: string;
    mimeType: string;
    fileData: string;
  }
): Promise<{ success: boolean; attachment?: StoredTicketAttachment; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to upload attachment' };
    }
    return { success: true, attachment: data.attachment };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error uploading attachment' };
  }
}

export async function deleteTicketAttachment(
  ticketId: string,
  attachmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to delete attachment' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting attachment' };
  }
}

export async function fetchTicketHistory(
  ticketId: string
): Promise<{ success: boolean; history?: StoredTicketHistory[]; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/history`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to fetch ticket history' };
    }
    return { success: true, history: data.history || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching ticket history' };
  }
}

export async function fetchTicketComments(
  ticketId: string
): Promise<{ success: boolean; comments?: TicketComment[]; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to fetch ticket comments' };
    }
    return { success: true, comments: data.comments || [] };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error fetching ticket comments' };
  }
}

export interface SavedFilter {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  isShared: boolean;
  criteria: {
    keyword?: string;
    ticketNumber?: string;
    subject?: string;
    employee?: string;
    departmentId?: string;
    category?: string;
    priority?: string;
    status?: string;
    technicianId?: string;
    locationId?: string;
    dateField?: 'createdAt' | 'updatedAt';
    startDate?: string;
    endDate?: string;
  };
  sortConfig?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActiveTechnician {
  id: string;
  displayName: string;
  email: string;
  role: string;
  itTeamId: string | null;
  itTeamName: string | null;
  status: string;
}

export interface TicketQueryParams {
  page?: number;
  limit?: number;
  keyword?: string;
  ticketNumber?: string;
  subject?: string;
  employee?: string;
  departmentId?: string;
  category?: string;
  priority?: string;
  status?: string;
  technicianId?: string;
  locationId?: string;
  dateField?: 'createdAt' | 'updatedAt';
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TicketQueryResult {
  tickets: (StoredTicket & { slaStatus?: 'BREACHED' | 'WARNING' | 'ON_TRACK' | 'MET' })[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  activeSorting?: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  error?: string;
}

export function getAttachmentDownloadUrl(attachmentId: string): string {
  const token = getStoredToken();
  return `/api/attachments/${attachmentId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export function getAttachmentPreviewUrl(attachmentId: string): string {
  const token = getStoredToken();
  return `/api/attachments/${attachmentId}/preview${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

export async function fetchTicketsAdvanced(params: TicketQueryParams = {}): Promise<TicketQueryResult> {
  try {
    const urlParams = new URLSearchParams();
    if (params.page) urlParams.set('page', params.page.toString());
    if (params.limit) urlParams.set('limit', params.limit.toString());
    if (params.keyword) urlParams.set('keyword', params.keyword);
    if (params.ticketNumber) urlParams.set('ticketNumber', params.ticketNumber);
    if (params.subject) urlParams.set('subject', params.subject);
    if (params.employee) urlParams.set('employee', params.employee);
    if (params.departmentId && params.departmentId !== 'ALL') urlParams.set('departmentId', params.departmentId);
    if (params.category && params.category !== 'ALL') urlParams.set('category', params.category);
    if (params.priority && params.priority !== 'ALL') urlParams.set('priority', params.priority);
    if (params.status && params.status !== 'ALL') urlParams.set('status', params.status);
    if (params.technicianId && params.technicianId !== 'ALL') urlParams.set('technicianId', params.technicianId);
    if (params.locationId && params.locationId !== 'ALL') urlParams.set('locationId', params.locationId);
    if (params.dateField) urlParams.set('dateField', params.dateField);
    if (params.startDate) urlParams.set('startDate', params.startDate);
    if (params.endDate) urlParams.set('endDate', params.endDate);
    if (params.sortBy) urlParams.set('sortBy', params.sortBy);
    if (params.sortOrder) urlParams.set('sortOrder', params.sortOrder);

    const res = await fetch(`/api/tickets?${urlParams.toString()}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return {
        tickets: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
        error: data.error || 'Failed to fetch tickets',
      };
    }
    return {
      tickets: data.tickets || [],
      total: data.total || 0,
      page: data.page || 1,
      limit: data.limit || 10,
      totalPages: data.totalPages || 1,
      hasNextPage: Boolean(data.hasNextPage),
      hasPrevPage: Boolean(data.hasPrevPage),
      activeSorting: data.activeSorting,
    };
  } catch (err: any) {
    return {
      tickets: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      error: err.message || 'Network error fetching tickets',
    };
  }
}

export async function fetchActiveTechnicians(
  teamId?: string
): Promise<{ technicians: ActiveTechnician[]; error?: string }> {
  try {
    const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
    const res = await fetch(`/api/users/technicians${query}`, {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { technicians: [], error: data.error || 'Failed to fetch technicians' };
    }
    return { technicians: data.technicians || [] };
  } catch (err: any) {
    return { technicians: [], error: err.message || 'Network error fetching technicians' };
  }
}

export async function fetchSavedFilters(): Promise<{ savedFilters: SavedFilter[]; error?: string }> {
  try {
    const res = await fetch('/api/tickets/saved-filters', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { savedFilters: [], error: data.error || 'Failed to fetch saved filters' };
    }
    return { savedFilters: data.savedFilters || [] };
  } catch (err: any) {
    return { savedFilters: [], error: err.message || 'Network error fetching saved filters' };
  }
}

export async function createSavedFilter(data: {
  name: string;
  criteria: any;
  sortConfig?: any;
  isShared?: boolean;
}): Promise<{ success: boolean; savedFilter?: SavedFilter; error?: string }> {
  try {
    const res = await fetch('/api/tickets/saved-filters', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const parsed = await parseResponseJson(res);
    const result = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to save filter' };
    }
    return { success: true, savedFilter: result.savedFilter };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error saving filter' };
  }
}

export async function updateSavedFilter(
  id: string,
  data: Partial<SavedFilter>
): Promise<{ success: boolean; savedFilter?: SavedFilter; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/saved-filters/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    const parsed = await parseResponseJson(res);
    const result = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to update filter' };
    }
    return { success: true, savedFilter: result.savedFilter };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error updating filter' };
  }
}

export async function deleteSavedFilter(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/tickets/saved-filters/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const result = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: result.error || 'Failed to delete saved filter' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error deleting filter' };
  }
}

export async function fetchSortingPreference(): Promise<{
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  error?: string;
}> {
  try {
    const res = await fetch('/api/user/sorting-preference', {
      headers: getAuthHeaders(),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (res.ok && data.sortingPreference) {
      return data.sortingPreference;
    }
    return { sortBy: 'updatedAt', sortOrder: 'desc' };
  } catch (err: any) {
    return { sortBy: 'updatedAt', sortOrder: 'desc', error: err.message };
  }
}

export async function saveSortingPreference(pref: {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/user/sorting-preference', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(pref),
    });
    const parsed = await parseResponseJson(res);
    const data = parsed.data || {};
    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to persist sorting preference' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error persisting sorting preference' };
  }
}
